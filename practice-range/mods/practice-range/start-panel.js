// The first screen: pick how to learn. Practice drills by language, or a guided course.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { card } from "./kit/pane.js";
import { pageLegend } from "./setup/parts.js";

/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */

/** The two choices, in order. Their index is the selection and the number key. */
export const START_CHOICES = /** @type {const} */ ([
  { id: "languages", title: "Drills", detail: "Short coding exercises by language, checked when you save." },
  { id: "courses", title: "Courses", detail: "Read lessons step by step, with questions and examples to run." },
]);

/**
 * @param {Theme} t
 * @param {{ selected: number, choose: (id: "languages" | "courses", cx: Context) => void, select: (index: number, cx: Context) => void }} options
 */
export function startPanel(t, { selected, choose, select }) {
  return v_flex().id("practice-start").flex_1().min_h(0)
    .child(v_flex().flex_1().min_h(0).items_center().justify_center().p(24)
      .child(h_flex().gap(16).flex_wrap().justify_center().items_stretch()
        .children(START_CHOICES.map((choice, index) => card(t, { id: `start-${choice.id}`, on: index === selected, click: cx => { select(index, cx); choose(choice.id, cx); } })
          .w(280).p(24).gap(8)
          .child(div().text_size(18).font_semibold().child(choice.title))
          .child(div().text_size(13).text_color(t.muted).child(choice.detail))))))
    .child(pageLegend(t, [["h/l", "move"], ["enter", "open"], ["1/2", "open"], ["?", "setup"]]));
}
