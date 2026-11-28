// Setup's first page: one card per part (languages, editor, layout, AI tutor), each showing how
// it stands. Any card opens its page, in any order. Start is ready once a language and an
// editor are.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { keyButton, spinner } from "../kit/controls.js";
import { card, badge } from "../kit/pane.js";
import { languages } from "../languages/index.js";
import { packBadge, statusTag, pageTop, pageBody, cardGrid, inGrid, cardTitle, pageLegend } from "./parts.js";
import { editorName } from "./editor-page.js";
import { tutorName } from "./tutor-page.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */

/**
 * What still stops practice from starting, as one sentence, or "" when nothing does.
 * @param {import("./flow.js").SetupFlow} flow @param {"neovim" | "vscode" | null} editor
 */
export function startBlocker(flow, editor) {
  if (!flow.tools) return flow.scanningTools ? "Checking this computer…" : "Check this computer first.";
  const language = flow.readyLanguages().length > 0;
  const found = Boolean(editor) && flow.editorFound(/** @type {"neovim" | "vscode"} */ (editor));
  if (!language && !found) return "Install a language and choose an editor to start.";
  if (!language) return "Install a language to start.";
  if (!editor) return "Choose an editor to start.";
  if (!found) return `${editorName(editor)} isn't installed. Install it or choose the other editor.`;
  return "";
}

/** Two boxes in the layout's proportions: the panel and Neovim. @param {Theme} t @param {import("../types.js").Layout} layout */
export function layoutSketch(t, layout) {
  const panel = div().h_full().rounded(4).bg(t.accent).opacity(0.55).w(`${Math.round(layout.width * 100)}%`);
  const editor = div().h_full().flex_1().rounded(4).bg(t.muted).opacity(0.3);
  return h_flex().w(132).h(56).flex_none().p(5).gap(4).rounded(6).border_1().border_color(t.border).bg(t.surface)
    .children(layout.side === "left" ? [panel, editor] : [editor, panel]);
}

/**
 * @param {Theme} t
 * @param {{ flow: import("./flow.js").SetupFlow, editor: "neovim" | "vscode" | null,
 *   tutor: import("../tutor/config.js").TutorConfig, layout: import("../types.js").Layout, busy: boolean,
 *   open: (page: "languages" | "editor" | "layout" | "tutor", cx: Context) => void, start: (cx: Context) => void,
 *   rescan: (cx: Context) => void, learn: (cx: Context) => void }} options
 */
export function setupHub(t, { flow, editor, tutor, layout, busy, open, start, rescan, learn }) {
  const scan = flow.tools;
  const ready = flow.readyLanguages();
  const blocker = startBlocker(flow, editor);
  const checking = !scan && flow.scanningTools;
  /** The numbered square on each card. @param {number} n @param {string} color a theme key */
  const step = (n, color) => badge(String(n), t[color] ?? t.accent, 30);

  const languagesCard = card(t, { id: "setup-card-languages", click: cx => open("languages", cx) })
    .child(cardTitle(t, step(1, "ansi4"), "Languages",
      checking ? "Checking…" : ready.length === languages.length ? "All installed" : `${ready.length} ready · ${languages.length - ready.length} to install`,
      checking ? spinner(t) : statusTag(t, ready.length ? "Ready" : "Install one", ready.length ? "ready" : "needed")))
    .child(h_flex().gap(8).flex_wrap().children(languages.map(pack => h_flex().gap(6).items_center()
      .child(packBadge(t, pack, 22))
      .child(div().text_size(12).text_color(flow.languageReady(pack.id) ? t.foreground : t.dim).child(pack.name)))));

  const found = editor ? flow.editorFound(editor) : false;
  const editorCard = card(t, { id: "setup-card-editor", click: cx => open("editor", cx) })
    .child(cardTitle(t, step(2, "ansi2"), "Editor",
      editor ? `${editorName(editor)}${found ? ` · ${scan?.editors[editor].version}` : ""}` : "Neovim or VS Code",
      checking ? spinner(t) : statusTag(t, !editor ? "Choose" : found ? "Ready" : "Not found", editor && found ? "ready" : "needed")))
    .child(h_flex().gap(6).flex_wrap()
      .child(statusTag(t, flow.editorFound("neovim") ? "Neovim found" : "No Neovim", flow.editorFound("neovim") ? "ready" : "neutral"))
      .child(statusTag(t, flow.editorFound("vscode") ? "VS Code found" : "No VS Code", flow.editorFound("vscode") ? "ready" : "neutral")));

  const layoutCard = card(t, { id: "setup-card-layout", click: cx => open("layout", cx) })
    .child(cardTitle(t, step(3, "ansi6"), "Layout",
      `Panel ${layout.side} · ${Math.round(layout.width * 100)}%${layout.compact ? " · compact" : ""}`,
      statusTag(t, "Optional", "neutral")))
    .child(layoutSketch(t, layout));

  const tutorCard = card(t, { id: "setup-card-tutor", click: cx => open("tutor", cx) })
    .child(cardTitle(t, step(4, "ansi5"), "AI tutor",
      tutor.enabled && tutor.provider ? tutorName(tutor.provider) : "Off",
      statusTag(t, tutor.enabled ? "On" : "Optional", tutor.enabled ? "ready" : "neutral")))
    .child(div().text_size(12).text_color(t.muted).child("Ask questions about an exercise. Only sends anything when you ask."));

  return v_flex().flex_1().min_h(0)
    .child(pageBody("setup-hub")
      .child(pageTop(t, { label: "SETUP", title: "Set up your practice range", intro: "Follow guided courses or practice coding with drills.", compact: layout.compact }))
      .when(Boolean(flow.scanError), element => element.child(div().text_size(12).text_color(t.blocked).child(`Could not check this computer: ${flow.scanError}`)))
      .child(cardGrid()
        .child(inGrid(languagesCard)).child(inGrid(editorCard))
        .child(inGrid(layoutCard)).child(inGrid(tutorCard)))
      .child(h_flex().gap(10).items_center().flex_wrap()
        .child(keyButton(t, "setup-start", "enter", "Start drills", !busy && !blocker, start))
        .when(Boolean(blocker), element => element.child(div().text_size(12).text_color(t.muted).child(blocker))))
      .child(h_flex().gap(10).items_center().flex_wrap()
        .child(keyButton(t,"setup-courses","","Browse courses",!busy,learn))
        .child(div().text_size(12).text_color(t.muted).child("Start reading without setup."))))
    .child(pageLegend(t, [["1–4", "open a card"], ["enter", "start"], ["r", "check again"], [",", "settings"]]).id("setup-hub-legend")
      .child(div().flex_1())
      .child(keyButton(t, "setup-rescan", "r", flow.scanningTools ? "Checking…" : "Check again", !flow.scanningTools, rescan)));
}
