// Setup's editor page: Neovim or VS Code, each with whether this computer has it.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { spinner } from "../kit/controls.js";
import { card, badge } from "../kit/pane.js";
import { statusTag, pageTop, pageBody, cardGrid, inGrid, cardTitle, pageLegend } from "./parts.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {"neovim" | "vscode"} Editor */

/** @param {Editor} editor */
export function editorName(editor) { return editor === "neovim" ? "Neovim" : "VS Code"; }

/** @type {{ id: Editor, key: string, mark: string, color: string, command: string, about: string }[]} */
const EDITORS = [
  { id: "neovim", key: "1", mark: "N", color: "ansi2", command: "nvim", about: "Opens beside the panel in this tab, on the file to edit. Save to check." },
  { id: "vscode", key: "2", mark: "VS", color: "ansi4", command: "code", about: "Opens in its own window when you press o. Save to check." },
];

/**
 * @param {Theme} t
 * @param {{ flow: import("./flow.js").SetupFlow, editor: Editor | null, saved: boolean, busy: boolean,
 *   compact: boolean, choose: (editor: Editor, cx: Context) => void }} options
 *   `saved`: the choice is saved as the default in practice-range.json
 */
export function editorPage(t, { flow, editor, saved, busy, compact, choose }) {
  const scan = flow.tools;
  return v_flex().flex_1().min_h(0)
    .child(pageBody("setup-editor")
      .child(pageTop(t, { label: "SETUP · EDITOR", title: "Choose your editor", intro: "Write answers in the editor you already use. Your choice is saved as the default.", compact }))
      .child(cardGrid().children(EDITORS.map(item => {
        const found = scan?.editors[item.id].found ?? false;
        const status = !scan ? spinner(t) : found ? statusTag(t, "Found", "ready") : statusTag(t, "Not found", "needed");
        return inGrid(card(t, { id: `setup-editor-${item.id}`, on: editor === item.id, click: cx => { if (!busy) choose(item.id, cx); } })
          .child(cardTitle(t, badge(item.mark, t[item.color] ?? t.accent, 30), editorName(item.id),
            found ? scan?.editors[item.id].version ?? "" : `The ${item.command} command`, status))
          .child(div().text_size(12).text_color(t.muted).child(item.about))
          .when(Boolean(scan) && !found, element => element.child(div().text_size(12).text_color(t.dim)
            .child(`Install ${editorName(item.id)} so ${item.command} --version works in a terminal, restart Herdr, then check again.`))), 220);
      })))
      .when(Boolean(editor) && saved, element => element.child(div().text_size(12).text_color(t.done).child(`${editorName(/** @type {Editor} */ (editor))} is your default editor.`))))
    .child(pageLegend(t, [["1", "Neovim"], ["2", "VS Code"], ["r", "check again"], ["esc", "back"]]));
}
