// Bits shared by jump and procs: hint letters, rows, space headers, the guide card.
// A mod can only import from its own folder, so each one carries a copy of this file.
// Edit the one in run/ and copy it over.

import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme } from "herdr";

/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").ClickEvent} ClickEvent */
/** @typedef {import("gpui-kit").NativeElement} El */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {Record<string, Color>} Theme */
/** @typedef {{ at: number, typed: string }} NavState */
/** @typedef {{ hint?: string }} Hinted */
/** @typedef {(e: ClickEvent, cx: Context) => void} Click */
/** @typedef {{ spaces: Record<string, string>, tabs: Record<string, string> }} HintConfig */

/** The app's theme colors, typed as colors the builders accept. @returns {Theme} */
export function colors() {
  return /** @type {Theme} */ (theme());
}

// Home row first, then everything else. One letter each until we run out, then pairs.
const HOME = "asdfghjkl";
const REST = "qwertyuiopzxcvbnm";

/**
 * Hand out a hint per item, skipping `reserved` letters. `preferred[i]` is what
 * the user asked for in their config and wins if it's free. The rest fill in
 * from the alphabet, never starting with a preferred letter, so typing yours
 * always lands where you expect.
 * @param {number} count
 * @param {string} [reserved]
 * @param {(string | null | undefined)[]} [preferred]
 * @returns {string[]}
 */
export function hints(count, reserved = "", preferred = []) {
  /** @type {(string | null)[]} */
  const out = new Array(count).fill(null);
  /** @type {Set<string>} */
  const taken = new Set();
  for (let i = 0; i < count; i++) {
    const p = String(preferred[i] ?? "").toLowerCase();
    if (/^[a-z]+$/.test(p) && ![...p].some((c) => reserved.includes(c)) && !taken.has(p)) { out[i] = p; taken.add(p); }
  }
  // If someone picked "ab", nobody else gets plain "a" or typing it would stop there.
  const starts = new Set([...taken].map((h) => h[0]));
  const letters = [...(HOME + REST)].filter((c) => !reserved.includes(c) && !starts.has(c));
  const need = out.filter((h) => !h).length;
  /** @type {string[]} */
  const pool = [];
  if (need <= letters.length) pool.push(...letters);
  else for (const a of letters) for (const b of letters) pool.push(a + b);
  let next = 0;
  return out.map((h) => h ?? pool[next++] ?? "");
}

export const SPIN = "mods/workspace-chrome/spinner.svg";

/**
 * The colored dot in front of a row.
 * @param {Theme} t
 * @param {string | null} status working | blocked | done | idle | running | exited | null
 */
export function glyph(t, status) {
  if (status === "working") return svg(SPIN).size(12).flex_none().text_color(t.working).spin(900);
  // Running green, dead red. Agent statuses use whatever the theme says.
  /** @type {Record<string, Color>} */
  const tone = { blocked: t.blocked, done: t.done, idle: t.idle, running: t.ansi2, exited: t.ansi1 };
  const color = tone[status ?? ""] ?? t.dim;
  const ch = status === "idle" ? "○" : status ? "●" : "·";
  return div().w(12).flex_none().text_color(color).child(ch);
}

/**
 * The hint badge at a row's end.
 * @param {Theme} t
 * @param {string} hint
 * @param {string} typed the letters typed so far, shown highlighted
 * @param {boolean} [pinned] the person chose this letter, so it's drawn in the accent color
 */
export function badge(t, hint, typed, pinned = false) {
  const lit = typed && hint.startsWith(typed) ? typed.length : 0;
  return h_flex()
    .flex_none()
    .h(18)
    .px(5)
    .rounded(4)
    .bg(t.raised)
    .border_1()
    .border_color(pinned ? t.accent : t.border)
    .text_size(11)
    .font_semibold()
    .children([...hint].map((c, i) => div().text_color(i < lit || pinned ? t.accent : t.muted).child(c)));
}

export const ROW_H = 30;

/**
 * A row: glyph, title, detail, and the hint at the end. `on` is the active one.
 * @param {Theme} t
 * @param {{ id: string, hint: string, typed: string, pinned?: boolean, on: boolean, status: string | null, title: string, detail?: string, onClick: Click }} r
 */
export function tile(t, { id, hint, typed, pinned, on, status, title, detail, onClick }) {
  return h_flex()
    .id(id)
    .w_full()
    .h(ROW_H)
    .flex_none()
    .px(10)
    .gap(8)
    .items_center()
    .rounded(7)
    .when(on, (el) => el.bg(t.selected))
    .cursor_pointer()
    .hover((s) => s.bg(on ? t.selected : t.hover))
    .on_click(onClick)
    .child(glyph(t, status))
    .child(div().flex_none().max_w(260).truncate().text_color(t.foreground).when(on, (d) => d.font_semibold()).child(title))
    .child(div().flex_1().truncate().text_size(11).text_color(t.dim).child(detail ?? ""))
    .child(badge(t, hint, typed, pinned));
}

/**
 * A space header: avatar letter, name, and its hint.
 * @param {Theme} t
 * @param {{ id: string, hint: string, typed: string, pinned?: boolean, name: string, color: Color, onClick: Click }} h
 */
export function header(t, { id, hint, typed, pinned, name, color, onClick }) {
  return h_flex()
    .id(id)
    .w_full()
    .px(10)
    .pt(8)
    .pb(2)
    .gap(8)
    .items_center()
    .text_size(11)
    .font_semibold()
    .text_color(t.dim)
    .cursor_pointer()
    .on_click(onClick)
    .child(h_flex().size(18).rounded(5).bg(color).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...name][0]?.toUpperCase() ?? "?"))
    .child(div().flex_1().truncate().text_color(t.muted).child(name))
    .child(badge(t, hint, typed, pinned));
}

/**
 * Shared key handling for the list. Mutates `state` and tells the caller what
 * happened: "done" (we ate it), "hit" (a hint matched), "act" (enter),
 * "close" (escape), or null (not ours).
 * @param {NavState} state
 * @param {KeyEvent} e
 * @param {Hinted[]} items every hinted thing in order
 * @returns {"done" | "hit" | "act" | "close" | null}
 */
export function navigate(state, e, items) {
  const k = e.key;
  if (k === "escape") {
    if (state.typed) { state.typed = ""; return "done"; }
    return "close";
  }
  // ctrl-n / ctrl-p for the emacs and readline crowd.
  if (e.keystroke === "ctrl-n") { state.at = Math.min(items.length - 1, state.at + 1); state.typed = ""; return "done"; }
  if (e.keystroke === "ctrl-p") { state.at = Math.max(0, state.at - 1); state.typed = ""; return "done"; }
  if (e.modifiers.control || e.modifiers.alt || e.modifiers.platform) return null;
  // j/k are reserved in both mods, so they're safe to use for movement here.
  if (k === "down" || k === "j") { state.at = Math.min(items.length - 1, state.at + 1); state.typed = ""; return "done"; }
  if (k === "up" || k === "k") { state.at = Math.max(0, state.at - 1); state.typed = ""; return "done"; }
  if (k === "enter") return "act";
  if (/^[a-z]$/.test(k) && !e.modifiers.shift) {
    const typed = state.typed + k;
    const exact = items.findIndex((it) => it.hint === typed);
    if (exact >= 0) { state.at = exact; state.typed = ""; return "hit"; }
    if (items.some((it) => it.hint?.startsWith(typed))) { state.typed = typed; return "done"; }
    state.typed = "";
    return null;
  }
  return null;
}

// Same avatar colors the built-in sidebar uses, so spaces look the same everywhere.
/** @type {Record<string, Color>} */
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

/**
 * @param {Theme} t
 * @param {SpaceInfo} s
 * @param {Record<string, string> | undefined} colors shared("space.colors")
 * @returns {Color}
 */
export function spaceColor(t, s, colors) {
  if (s.name === "~") return t.dim;
  const c = colors?.[s.id] ?? "ansi6";
  return c.startsWith("#") ? /** @type {Color} */ (c) : (MARK[c] ?? t[c]);
}

/**
 * The key hint line at the bottom.
 * @param {Theme} t
 * @param {[string, string][]} pairs key, what it does
 */
export function hintLine(t, pairs) {
  return h_flex()
    .flex_wrap()
    .gap(12)
    .text_size(11)
    .children(pairs.map(([k, what]) => h_flex().gap(4).child(div().text_color(t.accent).font_semibold().child(k)).child(div().text_color(t.dim).child(what))));
}

// Your own hint letters live in ~/.config/herdr-app/hints.json, shared by jump and procs:
//   { "spaces": { "Logos": "l" }, "tabs": { "Logos/Code": "c" } }
// Spaces by name, tabs as "space/tab". Reserved letters get ignored.
export const HINTS_FILE = "hints.json";

/**
 * @param {typeof import("herdr").readTextFile} readTextFile
 * @param {typeof import("herdr").appHome} appHome
 * @returns {Promise<HintConfig>}
 */
export async function readHintConfig(readTextFile, appHome) {
  try {
    const text = await readTextFile(appHome() + "/" + HINTS_FILE);
    const json = text ? JSON.parse(text) : {};
    return { spaces: json.spaces ?? {}, tabs: json.tabs ?? {} };
  } catch {
    return { spaces: {}, tabs: {} };
  }
}

/** The help key: ? on any layout. @param {KeyEvent} e */
export function isHelpKey(e) {
  return e.key === "?" || e.key_char === "?" || e.keystroke === "shift-/";
}

/**
 * The first-run guide card. Yellow so it gets noticed, ? badge, one row per key.
 * @param {Theme} t
 * @param {{ intro: string, rows: [string, string][] }} g
 */
export function guide(t, g) {
  const yellow = t.ansi3 ?? t.accent;
  /** @param {Color} c @param {string} a @returns {Color} */
  const tint = (c, a) => (/^#[0-9a-f]{6}$/i.test(c) ? /** @type {Color} */ (c + a) : c);
  /** @param {string} k */
  const key = (k) =>
    div().flex_none().min_w(58).px(6).h(18).rounded(4).bg(tint(yellow, "22")).border_1().border_color(tint(yellow, "55")).text_size(11).font_semibold().text_color(t.foreground).child(k);
  return h_flex()
    .w_full()
    .items_start()
    .p(12)
    .gap(12)
    .rounded(8)
    .bg(tint(yellow, "16"))
    .border_1()
    .border_color(tint(yellow, "66"))
    .text_size(12)
    .child(h_flex().flex_none().size(20).mt(1).rounded(10).border_1().border_color(yellow).items_center().justify_center().text_size(12).font_bold().text_color(yellow).child("?"))
    .child(
      h_flex().flex_1().flex_wrap().gap(6)
        .child(div().w_full().mb(2).text_size(12.5).font_semibold().text_color(t.foreground).child(g.intro))
        .children(g.rows.map(([k, what]) => h_flex().w_full().gap(10).items_center().when(!!k, (el) => el.child(key(k))).child(div().flex_1().text_color(t.muted).child(what))))
        .child(div().w_full().mt(2).text_size(11).text_color(t.dim).child("? hides this. Press it again any time.")),
    );
}
