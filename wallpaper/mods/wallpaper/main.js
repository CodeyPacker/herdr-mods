// Wallpaper: picks the Herdr background from a folder of pictures, then the panes' opacity.
// Opened by a key (mod.open:wallpaper) or by the herdr-background Claude skill.
//
// Step 1, the pictures: moving through them sets each one as the background at once.
// Step 2, the opacity: left and right change how much of the picture shows behind the
// terminals, at once too.
// Step 3, the borders: left and right pick the theme's color, light or dark, at once too.
// Enter keeps it all. Esc, or closing the window, puts back what was there.
// It opens as a window, not a dialog, so the window behind it is not dimmed during the preview.
//
// The change goes through layout.set, which shows it at once and saves the layout file.
// See-through panes: the terminals are clear (terminal_opacity 0) and the pane frame is the theme's
// background at the opacity, so there is one fill with the frame's round corners. (Herdr draws a
// terminal's own background square, and twice with the frame's.) The picker also records
// { layout, opacity } in shared state ("backgrounds.seeThrough"): mods with panels and bars follow
// it, and the Islands chrome mod writes the frame's color again when the theme changes.
// Herdr only reads pictures from its own folder, so the chosen one is copied into backgrounds/.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { run, layout, props, closeOverlay, checking, theme, appHome, home, exec, pickFolder, readTextFile, writeTextFile, notify, window, nextCommand, setShared, shared } from "herdr";

import * as fs from "fs/promises";

/** The shared record of see-through panes, read by the mods: { layout, opacity 0..1 } or null. */
const SEE_THROUGH = "backgrounds.seeThrough";

const IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];
const COLUMNS = 4;
/** Thumbnails are cut to this size, 16:10 like most screens. */
const THUMB = { w: 320, h: 200 };
/** One step of the opacity, in percent. */
const STEP = 5;
/** Where this mod keeps its folder choice and thumbnails, inside Herdr's folder. */
const DATA = "data/wallpaper";

/** @param {string} name */
const isImage = (name) => IMAGE_TYPES.some((ext) => name.toLowerCase().endsWith(ext));

/** A short stable name for a file's thumbnail, from its path. @param {string} text */
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Copies a file. Herdr's fs has no copyFile.
 * On Windows, fs.writeFile writes binary data as an empty file, so Windows' copy command does it.
 * @param {string} from @param {string} to
 */
async function copyFile(from, to) {
  if (window().platform === "windows") {
    const win = (/** @type {string} */ p) => p.replace(/\//g, "\\");
    const r = await exec("cmd", ["/d", "/c", "copy", "/b", "/y", win(from), win(to)]);
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || `copy failed (${r.code})`).trim());
    return;
  }
  await fs.writeFile(to, await fs.readFile(from));
}

/** The border choices. Light and dark are faint, so they suit most pictures. */
const BORDERS = [
  { id: "theme", label: "Theme", color: "border" },
  { id: "light", label: "Light", color: "#ffffff26" },
  { id: "dark", label: "Dark", color: "#00000059" },
];
/** A #rrggbb color at an opacity (0..1), as #rrggbbaa. @param {string} c @param {number} o */
const fade = (c, o) => /^#[0-9a-f]{6}$/i.test(c) ? c + Math.round(Math.max(0, o) * 255).toString(16).padStart(2, "0") : c;

const BORDER_COLORS = BORDERS.map((b) => b.color);

/** The layout's border choice, read from the main pane's frame. @param {any} tree */
function borderOf(tree) {
  const c = find(tree, "main")?.content?.pane?.border?.color;
  return BORDERS.find((b) => b.id !== "theme" && b.color === c)?.id ?? "theme";
}

/** @param {any} node @param {string} id @returns {any} */
function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Sets every border and divider that uses the theme's border color, or one of the choices,
 * to `color`. Borders in other colors (an accent focus ring) stay. @param {any} node @param {string} color
 */
function recolorBorders(node, color) {
  if (Array.isArray(node)) { node.forEach((n) => recolorBorders(n, color)); return; }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if ((key === "border" || key === "divider" || key === "focus") && value && typeof value === "object"
      && BORDER_COLORS.includes(value.color)) value.color = color;
    recolorBorders(value, color);
  }
}

/** The node whose content is the shown tab, which frames the panes. @param {any} node @returns {any} */
function tabBlock(node) {
  if (!node || typeof node !== "object") return null;
  if (node.content && typeof node.content === "object" && "tab" in node.content) return node;
  for (const child of node.children ?? []) {
    const found = tabBlock(child);
    if (found) return found;
  }
  return null;
}

/** Copies a layout tree. @param {any} tree */
const copy = (tree) => JSON.parse(JSON.stringify(tree));

/** Removes each pane's own background color, which would hide the picture. @param {any} node */
function dropPaneBackgrounds(node) {
  if (Array.isArray(node)) { node.forEach(dropPaneBackgrounds); return; }
  if (!node || typeof node !== "object") return;
  if (node.pane && typeof node.pane === "object") delete node.pane.background;
  Object.values(node).forEach(dropPaneBackgrounds);
}

export default class Wallpaper extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    /** @type {"pictures" | "opacity" | "borders"} */
    this.step = "pictures";
    this.folder = `${home()}/Pictures/herdr`;
    /** @type {string[]} picture file names in the folder */
    this.names = [];
    /** @type {Record<string, string>} file name to its thumbnail, relative to Herdr's folder */
    this.thumbs = {};
    this.at = 0;
    /** Percent of the theme color the terminals are drawn with: 100 hides the picture behind them. */
    this.opacity = 100;
    /** The borders' color: an id in BORDERS. */
    this.border = "theme";
    this.loading = true;
    this.error = "";
    /** The layout as it was when the dialog opened, put back unless the change is kept. */
    this.original = copy(layout());
    /** The shared see-through record as it was, put back with the layout. */
    this.originalSee = shared(SEE_THROUGH) ?? null;
    this.kept = false;
    this.applied = false;
    this.handle.focus();
    if (checking()) return; // herdr-app check runs init for real: don't touch the layout then
    // The dialog takes the keyboard a moment after it opens.
    cx.timer.after(100, () => this.handle.focus());
    const bg = this.original?.background;
    this.current = bg && typeof bg === "object" && typeof bg.image === "string" ? bg.image.split("/").pop() : "";
    const see = /** @type {any} */ (this.originalSee);
    this.opacity = see && see.layout === shared("layout") && Number(see.opacity) < 1 ? Math.round(Number(see.opacity) * 100) : 100;
    this.border = borderOf(this.original);
    cx.spawn(async (cx) => {
      const saved = await readTextFile(`${appHome()}/${DATA}/settings.json`).catch(() => null);
      try { if (saved) this.folder = JSON.parse(saved).folder || this.folder; } catch { /* keep the default */ }
      await this.load(cx);
    });
    // `herdr-app do wallpaper.<key>` presses that key: left, right, up, down, enter, b, f.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c) this.key({ keystroke: c }, cx);
        cx.notify();
      }
    });
  }

  /** Reads the folder's pictures and makes their thumbnails. @param {any} cx */
  async load(cx) {
    this.loading = true;
    this.error = "";
    this.names = [];
    cx.notify();
    let entries = [];
    try {
      entries = await fs.readdir(this.folder);
    } catch {
      this.loading = false;
      this.error = `No folder at ${this.folder}. Press f to choose one.`;
      cx.notify();
      return;
    }
    this.names = entries.filter(isImage).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const now = this.names.indexOf(this.current);
    this.at = now >= 0 ? now : 0;
    this.loading = false;
    if (!this.names.length) this.error = `No pictures in ${this.folder}. Add some, or press f to choose another folder.`;
    this.scroll.scroll_to_item(Math.floor(this.at / COLUMNS));
    cx.notify();
    await fs.mkdir(`${appHome()}/${DATA}/thumbs`, { recursive: true }).catch(() => {});
    this.made = new Set(await fs.readdir(`${appHome()}/${DATA}/thumbs`).catch(() => []));
    // A few at a time, so the first rows show soon.
    const queue = [...this.names];
    const worker = async () => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
        const thumb = await this.thumbnail(name);
        if (thumb) { this.thumbs[name] = thumb; cx.notify(); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  /**
   * Makes a picture's thumbnail once. It is named after the picture's path, so a picture
   * replaced under the same name keeps its old thumbnail until data/wallpaper/thumbs is emptied.
   * @param {string} name @returns {Promise<string>}
   */
  async thumbnail(name) {
    const src = `${this.folder}/${name}`;
    try {
      const file = `${hash(src)}.png`;
      const rel = `${DATA}/thumbs/${file}`;
      const out = `${appHome()}/${rel}`;
      if (this.made.has(file)) return rel;
      if (window().platform === "macos") {
        const r = await exec("sips", ["-s", "format", "png", "--resampleHeight", String(THUMB.h), "--cropToHeightWidth", String(THUMB.h), String(THUMB.w), src, "--out", out]);
        if (r.code === 0) return rel;
      }
      // No sips here: the picture itself, drawn small.
      await copyFile(src, out);
      return rel;
    } catch {
      return "";
    }
  }

  /** Shows the picture under the cursor with the chosen opacity. @param {any} cx */
  async apply(cx) {
    const name = this.names[this.at];
    if (!name) return;
    try {
      // On Windows, only when missing: backgrounds/ can be a link out of Herdr's folder (to dotfiles,
      // say), and Herdr refuses mkdir there even when the folder already exists.
      const skip = window().platform === "windows" && await fs.exists(`${appHome()}/backgrounds`);
      if (!skip) await fs.mkdir(`${appHome()}/backgrounds`, { recursive: true });
      await copyFile(`${this.folder}/${name}`, `${appHome()}/backgrounds/${name}`);
    } catch (e) {
      this.error = `Could not copy ${name}: ${e instanceof Error ? e.message : String(e)}`;
      cx.notify();
      return;
    }
    // Built from the layout as it was, so going back to 100% gives the panes their colors back.
    const tree = copy(this.original);
    const fit = tree.background && typeof tree.background === "object" && tree.background.fit ? tree.background.fit : "cover";
    tree.background = { image: `backgrounds/${name}`, fit };
    const see = this.opacity < 100;
    // See-through: clear terminals over a frame of the theme's background at the opacity.
    // Solid: solid terminals, and the theme's background under mods without a fill (like Tourist).
    tree.terminal_opacity = see ? 0 : 1;
    dropPaneBackgrounds(tree);
    const pane = tabBlock(tree)?.content?.pane;
    if (pane && typeof pane === "object") pane.background = see ? fade(String(theme().background), this.opacity / 100) : "background";
    recolorBorders(tree, BORDERS.find((b) => b.id === this.border)?.color ?? "border");
    run("layout.set", { layout: tree });
    // setShared also makes every mod draw again, which a layout change alone doesn't.
    setShared(SEE_THROUGH, see ? { layout: shared("layout"), opacity: this.opacity / 100 } : null);
    this.applied = true;
  }

  /** @param {number} to @param {any} cx */
  select(to, cx) {
    if (!this.names.length) return;
    const at = Math.max(0, Math.min(to, this.names.length - 1));
    if (at === this.at && this.applied) return;
    this.at = at;
    this.scroll.scroll_to_item(Math.floor(at / COLUMNS));
    cx.spawn(async (cx) => { await this.apply(cx); cx.notify(); });
    cx.notify();
  }

  /** @param {number} by percent @param {any} cx */
  nudge(by, cx) {
    const next = Math.max(0, Math.min(100, this.opacity + by));
    if (next === this.opacity) return;
    this.opacity = next;
    cx.spawn(async (cx) => { await this.apply(cx); cx.notify(); });
    cx.notify();
  }

  /** Left and right on the borders step. @param {number} by @param {any} cx */
  moveBorder(by, cx) {
    const i = BORDERS.findIndex((b) => b.id === this.border);
    const next = Math.max(0, Math.min(BORDERS.length - 1, i + by));
    if (next === i) return;
    this.border = BORDERS[next].id;
    cx.spawn(async (cx) => { await this.apply(cx); cx.notify(); });
    cx.notify();
  }

  /** Asks for another folder of pictures and remembers it. @param {any} cx */
  chooseFolder(cx) {
    cx.spawn(async (cx) => {
      const folder = await pickFolder({ prompt: "Choose the folder of background pictures" });
      if (!folder) return;
      this.folder = folder;
      await fs.mkdir(`${appHome()}/${DATA}`, { recursive: true }).catch(() => {});
      await writeTextFile(`${appHome()}/${DATA}/settings.json`, JSON.stringify({ folder }, null, 2) + "\n").catch(() => null);
      await this.load(cx);
      this.handle.focus();
    });
  }

  /** Enter on the borders step: keeps the change and closes. @param {any} cx */
  keep(cx) {
    cx.spawn(async (cx) => {
      if (!this.applied) await this.apply(cx);
      this.kept = true;
      notify({ title: "Background set", body: `${this.names[this.at]} at ${this.opacity}%, ${this.border} borders`, level: "success", timeout: 2000 });
      this.closeWindow();
    });
  }

  closeWindow() {
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
  }

  /** Puts the layout back unless the change was kept. */
  async close(_cx) {
    if (!this.kept && this.applied) { run("layout.set", { layout: this.original }); setShared(SEE_THROUGH, this.originalSee); }
  }

  /** @param {{ keystroke: string }} e @param {any} cx */
  key(e, cx) {
    const k = e.keystroke;
    let used = true;
    // A window gets esc itself. Closing puts the layout back (see close).
    if (k === "escape") this.closeWindow();
    else if (this.step === "pictures") {
      if (k === "left" || k === "h") this.select(this.at - 1, cx);
      else if (k === "right" || k === "l") this.select(this.at + 1, cx);
      else if (k === "up" || k === "k") this.select(this.at - COLUMNS, cx);
      else if (k === "down" || k === "j") this.select(this.at + COLUMNS, cx);
      else if (k === "f") this.chooseFolder(cx);
      else if (k === "enter" && this.names.length) {
        this.step = "opacity";
        if (!this.applied) cx.spawn(async (cx) => { await this.apply(cx); cx.notify(); });
        cx.notify();
      } else used = false;
    } else if (this.step === "opacity") {
      if (k === "left" || k === "h" || k === "down" || k === "j") this.nudge(-STEP, cx);
      else if (k === "right" || k === "l" || k === "up" || k === "k") this.nudge(STEP, cx);
      else if (k === "shift-left" || k === "shift-h") this.nudge(-1, cx);
      else if (k === "shift-right" || k === "shift-l") this.nudge(1, cx);
      else if (k === "enter") { this.step = "borders"; cx.notify(); }
      else if (k === "backspace" || k === "b") { this.step = "pictures"; cx.notify(); }
      else used = false;
    } else {
      if (k === "left" || k === "h") this.moveBorder(-1, cx);
      else if (k === "right" || k === "l") this.moveBorder(1, cx);
      else if (k === "enter") this.keep(cx);
      else if (k === "backspace" || k === "b") { this.step = "opacity"; cx.notify(); }
      else used = false;
    }
    if (used) cx.stop_propagation?.();
  }

  /** A key and what it does, for the line at the bottom. @param {any} t @param {string} key @param {string} what */
  hint(t, key, what) {
    return h_flex().gap(4).child(div().text_color(t.accent).child(key)).child(div().text_color(t.dim).child(what));
  }

  /** @param {any} t */
  grid(t) {
    const rows = [];
    for (let i = 0; i < this.names.length; i += COLUMNS) rows.push(this.names.slice(i, i + COLUMNS).map((name, j) => ({ name, i: i + j })));
    return v_flex().id("bg-grid").flex_1().min_h(0).gap(12).overflow_y_scrollbar().track_scroll(this.scroll)
      .children(rows.map((row, r) => h_flex().id(`bg-row-${r}`).flex_none().gap(12).children(row.map(({ name, i }) => {
        const on = i === this.at;
        const thumb = this.thumbs[name];
        return v_flex().id(`bg-${i}`).w(196).flex_none().gap(6).p(4).rounded(10).border_2()
          .border_color(on ? t.accent : "#00000000").cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.step = "pictures"; this.select(i, cx); this.handle.focus(); })
          .child(div().w(186).h(116).rounded(6).overflow_hidden().bg(t.raised)
            .when(Boolean(thumb), (el) => el.child(image(thumb).w(186).h(116))))
          .child(h_flex().gap(4).text_size(12)
            .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(name))
            .when(name === this.current, (el) => el.child(div().flex_none().text_color(t.dim).child("now"))));
      }))));
  }

  /** @param {any} t */
  opacityPanel(t) {
    const width = 520;
    return v_flex().flex_1().items_center().justify_center().gap(18)
      .child(div().text_size(13).text_color(t.muted).child(this.names[this.at] ?? ""))
      .child(div().text_size(40).font_semibold().text_color(t.foreground).child(`${this.opacity}%`))
      .child(div().w(width).h(8).rounded(4).bg(t.raised)
        .child(div().w(Math.round(width * this.opacity / 100)).h(8).rounded(4).bg(t.accent)))
      .child(h_flex().w(width).justify_between().text_size(12).text_color(t.dim)
        .child("0%: the picture shows fully behind the terminals").child("100%: solid"));
  }

  /** @param {any} t */
  bordersPanel(t) {
    return v_flex().flex_1().items_center().justify_center().gap(18)
      .child(div().text_size(13).text_color(t.muted).child(`${this.names[this.at] ?? ""} at ${this.opacity}%`))
      .child(h_flex().gap(10).items_center()
        .children(BORDERS.map((b) => {
          const on = b.id === this.border;
          return h_flex().id(`bg-border-${b.id}`).h(36).px(18).text_size(14).items_center().rounded(8).border_1()
            .border_color(on ? t.accent : t.border).bg(on ? t.selected : t.raised)
            .text_color(on ? t.foreground : t.muted).cursor_pointer().hover((s) => s.border_color(t.accent))
            .on_click((_e, cx) => {
              this.border = b.id;
              cx.spawn(async (cx) => { await this.apply(cx); cx.notify(); });
              this.handle.focus();
            })
            .child(b.label);
        })));
  }

  render(_cx) {
    const t = theme();
    const pictures = this.step === "pictures";
    const hints = pictures
      ? [["arrows/hjkl", "pick (shows at once)"], ["enter", "next: opacity"], ["f", "folder"], ["esc", "cancel"]]
      : this.step === "opacity"
        ? [["left/right", `${STEP}%`], ["shift", "1%"], ["enter", "next: borders"], ["b", "back to pictures"], ["esc", "cancel"]]
        : [["left/right", "pick"], ["enter", "keep"], ["b", "back to opacity"], ["esc", "cancel"]];
    const title = pictures ? "Background" : this.step === "opacity" ? "Pane opacity" : "Borders";
    return v_flex().id("wallpaper").size_full().p(20).gap(14).bg(t.popover).text_size(13)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .child(h_flex().flex_none().gap(10).items_center()
        .child(div().text_size(16).font_semibold().text_color(t.foreground).child(title))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(this.folder))
        .when(pictures, (el) => el.child(h_flex().id("bg-folder").flex_none().h(28).px(10).items_center().rounded(8).border_1()
          .border_color(t.border).bg(t.raised).text_color(t.foreground).cursor_pointer().hover((s) => s.border_color(t.accent))
          .on_click((_e, cx) => this.chooseFolder(cx)).child("Folder…"))))
      .child(this.loading ? div().flex_1().text_color(t.dim).child("Loading…")
        : this.error ? div().flex_1().text_color(t.blocked).child(this.error)
        : pictures ? this.grid(t) : this.step === "opacity" ? this.opacityPanel(t) : this.bordersPanel(t))
      .child(h_flex().flex_none().gap(16).text_size(12).children(hints.map(([k, w]) => this.hint(t, k, w))));
  }
}
