// The screens shown while the agent plans, and when a tour stops on an error.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { SCOPES } from "../constants.js";
import { spinner } from "../kit/controls.js";
import { legend } from "../kit/legend.js";
import { SIZE } from "../kit/theme.js";

export function planningView(v, t) {
  const scope = SCOPES.find(s => s.id === v.scope)?.label ?? "";
  return v_flex().flex_1().items_center().justify_center().gap(8).p(24)
    .child(spinner(t).text_size(22))
    .child(div().font_medium().child(v.planNote ? `${v.planNote}…` : `${v.agentName()} is planning the tour`))
    .child(div().text_size(11.5).text_color(t.dim).child(`${scope} · ${v.depth}. Usually 30 to 90 seconds, longer for a whole repo.`))
    .child(div().pt(6).child(legend(t, [["q/esc", "cancel"]])));
}

export function errorView(v, t) {
  return v_flex().flex_1().p(SIZE.framePad).gap(10)
    .child(div().font_semibold().text_color(t.ansi1).child("Tour stopped"))
    .child(div().text_size(12).text_color(t.muted).child(v.error ?? ""))
    .child(legend(t, [["enter/q", "start over"]]));
}
