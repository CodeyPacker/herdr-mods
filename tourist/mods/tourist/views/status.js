// The screens shown while the agent plans, and when a tour stops on an error.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { SCOPES } from "../constants.js";
import { spinner } from "../ui.js";

export function planningView(v, t) {
  const scope = SCOPES.find(s => s.id === v.scope)?.label ?? "";
  return v_flex().flex_1().items_center().justify_center().gap(8).p(24)
    .child(spinner(t).text_size(22))
    .child(div().font_medium().child(v.planNote ? `${v.planNote}…` : `${v.agentName()} is planning the tour`))
    .child(div().text_size(11.5).text_color(t.dim).child(`${scope} · ${v.depth}. Usually 30 to 90 seconds, longer for a whole repo.`))
    .child(div().pt(6).text_size(11.5).text_color(t.dim).child("q or esc cancels"));
}

export function errorView(v, t) {
  return v_flex().flex_1().p(18).gap(10)
    .child(div().font_semibold().text_color(t.ansi1).child("Tour stopped"))
    .child(div().text_size(12).text_color(t.muted).child(v.error ?? ""))
    .child(div().text_size(11.5).text_color(t.dim).child("enter or q to start over"));
}
