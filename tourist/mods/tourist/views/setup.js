// The two setup steps: what to tour, then how deep.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { SCOPES, DEPTHS } from "../constants.js";
import { option, textInput } from "../ui.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function setupView(v, t) {
  const g = v.git;
  const noChanges = g.changed.length === 0;
  const section = (title) => div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child(title);
  const head = v_flex()
    .child(div().text_size(16).font_semibold().child("Tourist"))
    .child(div().pt(2).text_size(11.5).text_color(t.dim).child(g.root ? `${g.root} · ${g.branch}` : "Finding the repo…"))
    .when(Boolean(v.agent), el => el.child(h_flex().id("agent").pt(2).gap(4).text_size(11.5).text_color(t.dim)
      .when(v.agents.length > 1, el => el.cursor_pointer().on_click((_e, cx) => { v.switchAgent(); cx.notify(); }))
      .child(`Tour by ${v.agentName()}`)
      .when(v.agents.length > 1, el => el.child(div().text_color(t.accent).child("· a switches")))));
  // A click works like moving there and pressing enter.
  const click = (i) => (_e, cx) => { v.leaveBox(); v.cursor = i; v.pick(cx); cx.notify(); };
  let rows, title, help;
  if (v.step === 1) {
    title = "Step 1 of 2 · What to tour";
    rows = SCOPES.map((s, i) => {
      const hint = s.id === "branch" ? (g.base ? (noChanges ? `no changes vs ${g.base}` : `${g.changed.length} files vs ${g.base}`) : "no base branch found")
        : s.id === "commit" ? (g.head || s.hint) : s.hint;
      return option(t, `scope-${s.id}`, s.key, s.label, hint, v.cursor === i, click(i));
    });
    const onFeature = SCOPES[v.cursor]?.id === "feature";
    if (onFeature) rows.splice(v.cursor + 1, 0, div().pl(40).pr(10).pt(2).pb(6).child(textInput(t, v.featureInput, v.typing === "feature")));
    help = v.typing === "feature" ? "type the feature · enter next · tab or esc back to the list"
      : onFeature ? "j/k move · tab types · enter next" : "j/k move · enter next";
  } else {
    const s = SCOPES.find(s => s.id === v.scope);
    title = "Step 2 of 2 · How deep";
    rows = DEPTHS.map((d, i) => option(t, `depth-${d.id}`, d.key, d.label, d.text.split(". ")[0], v.cursor === i, click(i)));
    rows.unshift(div().pb(8).text_size(12).text_color(t.muted)
      .child(`Touring: ${s?.label ?? ""}${v.scope === "feature" ? ` · "${v.featureInput.value().trim()}"` : ""}`));
    help = "j/k move · enter starts the tour · esc back";
  }
  return v_flex().id("setup").flex_1().min_h(0).overflow_y_scrollbar().p(18)
    .child(head)
    .child(section(title))
    .children(rows)
    .child(div().pt(14).text_size(11.5).text_color(t.dim).child(help));
}
