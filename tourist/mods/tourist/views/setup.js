// The setup steps: what to tour, which pull request (PR tours only), then how deep.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { SCOPES, DEPTHS, PASSES } from "../constants.js";
import { ago } from "../since.js";
import { option } from "../ui.js";
import { spinner, textInput } from "../kit/controls.js";
import { sectionLabel } from "../kit/pane.js";
import { legend } from "../kit/legend.js";
import { listNote } from "../kit/list.js";
import { SIZE } from "../kit/theme.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function setupView(v, t) {
  const g = v.git;
  const noChanges = g.changed.length === 0;
  const note = (text) => listNote(t, text);
  const head = v_flex()
    .child(div().text_size(SIZE.title).font_semibold().child("Tourist"))
    .when(Boolean(g.root), el => el.child(div().pt(2).text_size(SIZE.small).text_color(t.dim).child(`${g.root} · ${g.branch}`)))
    .when(Boolean(v.agent), el => el.child(h_flex().id("agent").pt(2).gap(4).text_size(SIZE.small).text_color(t.dim)
      .when(v.agents.length > 1, el => el.cursor_pointer().on_click((_e, cx) => { v.switchAgent(); cx.notify(); }))
      .child(`Tour by ${v.agentName()}`)
      .when(v.agents.length > 1, el => el.child(div().text_color(t.accent).child("· a switches")))));
  // Nothing can be picked until the repo and the agents are found (a second or two).
  if (!g.root) return v_flex().id("setup").flex_1().min_h(0).p(SIZE.framePad).child(head)
    .child(h_flex().pt(18).gap(10).items_center().text_size(12.5).text_color(t.muted)
      .child(spinner(t).text_size(16)).child("Finding the repo and agents…"));
  // A click works like moving there and pressing enter.
  const click = (i) => (_e, cx) => { v.leaveBox(); v.cursor = i; v.pick(cx); cx.notify(); };
  // On the first step, the count follows the highlighted scope.
  const steps = v.steps(v.step === "scope" ? SCOPES[v.cursor]?.id : v.scope);
  const stepTitle = (name) => `Step ${steps.indexOf(v.step) + 1} of ${steps.length} · ${name}`;
  /** @type {import("../kit/legend.js").Hint[]} */
  let help;
  let rows, title;
  if (v.step === "scope") {
    title = stepTitle("What to tour");
    rows = SCOPES.map((s, i) => {
      const hint = s.id === "branch" ? (g.base ? (noChanges ? `no changes vs ${g.base}` : `${g.changed.length} files vs ${g.base}`) : "no base branch found")
        : s.id === "commit" ? (g.head || s.hint) : s.hint;
      return option(t, `scope-${s.id}`, s.key, s.label, hint, v.cursor === i, click(i));
    });
    const onFeature = SCOPES[v.cursor]?.id === "feature";
    if (onFeature) rows.splice(v.cursor + 1, 0, div().pl(44).pr(12).pt(2).pb(6).child(textInput(t, v.featureInput, v.typing === "feature")));
    help = v.typing === "feature" ? [["enter", "next"], ["tab/esc", "back to the list"]]
      : onFeature ? [["j/k", "move"], ["tab", "type the feature"], ["enter", "next"]] : [["j/k", "move"], ["enter", "next"]];
  } else if (v.step === "pr") {
    title = stepTitle("Which pull request");
    const prs = v.prs ?? [];
    rows = prs.map((p, i) => option(t, `pr-${p.number}`, i < 9 ? String(i + 1) : "·", `#${p.number} ${p.title}`,
      `${p.author?.login ?? ""} · ${p.headRefName} → ${p.baseRefName} · ${p.changedFiles} files +${p.additions} −${p.deletions}${p.isDraft ? " · draft" : ""}`,
      v.cursor === i, click(i)));
    if (v.prsError) rows = [note(v.prsError)];
    else if (!v.prs) rows = [note("Loading open pull requests…")];
    else if (prs.length === 0) rows = [note("No open pull requests in this repo.")];
    if (v.sinceLoading) rows.push(listNote(t, spinner(t)).child(`Checking your last review of #${v.prNumber}…`));
    help = [["j/k", "move"], ["1-9", "pick"], ["enter", "next"], ["esc", "back"]];
  } else if (v.step === "pass") {
    title = stepTitle("What to review");
    const at = v.since?.at ? `, ${ago(v.since.at)}` : "";
    rows = PASSES.map((p, i) => option(t, `pass-${p.id}`, p.key, p.label,
      p.id === "since" ? `you reviewed it at ${v.since?.oid.slice(0, 7)}${at}. Only the PR's files that changed since.` : p.hint,
      v.cursor === i, click(i)));
    help = [["j/k", "move"], ["s/w", "pick"], ["enter", "next"], ["esc", "back"]];
  } else {
    const s = SCOPES.find(s => s.id === v.scope);
    const pr = v.prs?.find(p => p.number === v.prNumber);
    title = stepTitle("How deep");
    rows = DEPTHS.map((d, i) => option(t, `depth-${d.id}`, d.key, d.label, d.text.split(". ")[0], v.cursor === i, click(i)));
    rows.unshift(div().pb(8).text_size(12).text_color(t.muted)
      .child(`Touring: ${s?.label ?? ""}${v.scope === "feature" ? ` · "${v.featureInput.value().trim()}"` : ""}${pr ? ` · #${pr.number} ${pr.title}` : ""}${v.steps().includes("pass") && v.pass === "since" ? " · changes since your last review" : ""}`));
    help = [["j/k", "move"], ["enter", "start the tour"], ["esc", "back"]];
  }
  return v_flex().id("setup").flex_1().min_h(0).overflow_y_scrollbar().p(SIZE.framePad)
    .child(head)
    .child(sectionLabel(t, title))
    .children(rows)
    .child(div().pt(SIZE.frameGap).child(legend(t, help)));
}
