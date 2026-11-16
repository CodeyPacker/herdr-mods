import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { listRow, rowText } from "./kit/list.js";
import { tag } from "./kit/pane.js";
import { languages } from "./languages/index.js";

/**
 * @param {import("./kit/theme.js").Theme} t
 * @param {{ enabled: string[], selected: number, busy: boolean,
 *   choose: (id: string, cx: import("gpui-kit").Context) => void }} options
 */
export function languagePanel(t, { enabled, selected, busy, choose }) {
  return v_flex().id("syntax-languages").flex_1().min_h(0).p(18).gap(12)
    .child(div().text_size(22).font_semibold().child("What do you want to practice?"))
    .child(div().text_color(t.muted).child("Choose a language, then a topic and exercise. You can keep several languages ready to use."))
    .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar().gap(6)
      .children(languages.map((language, index) => {
        const ready = enabled.includes(language.id);
        return listRow(t, { id: `language-${language.id}`, on: index === selected, tall: true,
          click: cx => { if (!busy) choose(language.id, cx); } })
          .child(div().w(18).text_color(t.dim).child(String(index + 1)))
          .child(rowText(t, language.name, `${language.topics.length} ${language.topics.length === 1 ? "topic" : "topics"} · ${language.exercises.length} exercises`, true))
          .child(tag(t, ready ? "Ready" : "Set up"));
      })))
    .child(div().text_size(12).text_color(t.muted).child(languages.some(language => !enabled.includes(language.id))
      ? "Choose Set up to add a language. Your other languages and progress stay saved."
      : "Choose any language. Each keeps its own answers and progress."))
    .child(div().text_size(11).text_color(t.dim).child("j/k move · enter choose · l languages"));
}
