// The practice screen: the exercise, the last run's result, hints, and after a pass the repo's code.
import { div } from "gpui-kit";
import { v_flex, h_flex, Editor, TextView, Scrollbar } from "gpui-base";
import { settings } from "herdr";
import { paneHeader, paneBar, banner } from "../kit/pane.js";
import { spinner, textInput } from "../kit/controls.js";
import { button, codeBlock, noteLabel } from "../ui.js";

const mono = () => String(settings().font_family ?? "");

/** A read-only editor in a bordered box of fixed height, for code inside the scroll area. */
function editorBox(t, state, lines) {
  return div().h(Math.min(Math.max(lines, 3), 24) * 18 + 16).rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
    .child(Editor.new(state).size_full());
}

/** The status line under the prompt. */
function status(v, t) {
  const pr = v.pr, r = pr.result;
  if (pr.running) return h_flex().gap(8).items_center().text_color(t.dim).child(spinner(t)).child(div().child(pr.queued ? "running… (one more queued)" : "running…"));
  if (pr.runError) return div().text_color(t.ansi1).child(pr.runError);
  if (!r) return div().text_color(t.dim).child(v.practicePassed(pr.ex.id) ? "not run yet  ·  passed before" : "not run yet");
  if (r.timedOut) return div().text_color(t.ansi1).child("took too long, is there an endless loop?");
  if (!r.compiled) return div().text_color(t.ansi1).child("does not compile");
  if (r.passed) return div().text_color(t.ansi2).child("passed");
  if (r.crash) return div().text_color(t.ansi1).child("crashed");
  if (pr.ex.kind === "program") return div().text_color(t.ansi1).child("output does not match");
  return div().text_color(t.ansi1).child(`${r.checks.filter(c => c.ok).length} of ${r.checks.length} checks passed`);
}

/** Compiler errors, checks, and the outputs of the last run. */
function results(v, t) {
  const r = v.pr.result, ex = v.pr.ex;
  const col = v_flex().gap(4);
  if (!r || v.pr.running) return col;
  for (const e of r.errors) col.child(div().text_size(12).text_color(t.ansi1).font_family(mono())
    .child(`${e.line ? `line ${e.line}: ` : ""}${e.code ? `${e.code} ` : ""}${e.text}`));
  for (const b of r.broken) col.child(div().text_size(12).text_color(t.ansi1)
    .child(`check "${b.check}" could not compile: ${b.text}`));
  if (r.broken.length) col.child(div().text_size(11.5).text_color(t.dim)
    .child("A check that cannot compile usually means a type or member is missing or has another name or shape."));
  for (const c of r.checks) col.child(h_flex().gap(8).items_start().text_size(12.5)
    .child(div().flex_none().text_color(c.ok ? t.ansi2 : t.ansi1).child(c.ok ? "✓" : "✗"))
    .child(v_flex().flex_1().min_w(0).child(c.name)
      .when(Boolean(c.why), el => el.child(div().text_size(11.5).text_color(t.dim).child(c.why)))));
  if (r.crash) col.child(v_flex().gap(4).child(noteLabel(t, "It crashed")).child(codeBlock(t, r.crash, true)));
  if (ex.kind === "program" && r.compiled && !r.timedOut) col
    .child(noteLabel(t, "Expected output")).child(codeBlock(t, r.expected || " ", true))
    .child(noteLabel(t, "Your output")).child(codeBlock(t, r.actual || "(nothing printed)", true));
  return col;
}

/** `v` is the Tutor view: its state is read here and its methods run on clicks. */
export function practiceView(v, t) {
  const pr = v.pr, ex = pr.ex, mod = v.mod, key = ex.id;
  const header = paneHeader(t)
    .child(div().flex_none().text_size(11.5).text_color(t.dim).child(`Practice ${pr.i + 1} / ${pr.exs.length}`))
    .child(div().flex_1().min_w(0).truncate().font_semibold().child(ex.title))
    .child(div().max_w(240).truncate().text_size(11.5).text_color(t.dim).child(mod.title))
    .child(v.shortcuts.button(t));
  // The key that opens the file, or the button's name when its key is turned off.
  const edit = v.shown("practice-edit", "e") || "Edit";
  const passed = Boolean(pr.result?.passed);
  const hints = pr.hints.map((h, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
    .child(noteLabel(t, h.label)).child(TextView.markdown(`hint-${key}-${i}`, h.text).selectable()));
  const lg = ex.source, repo = v.course.name, file = v.lang.practice.file;
  const body = v_flex().w_full().max_w(720).gap(10)
    .child(TextView.markdown(`prompt-${key}`, String(ex.prompt)).selectable())
    .child(div().text_size(11.5).text_color(t.dim)
      .child(v.settings.editor === "vscode"
        ? `${edit} opens ${file} in VS Code. Each save runs it.`
        : `${edit} opens ${file} in Neovim on the right. Each save runs it. Keys reach Tutor only when its pane has the keyboard: move between panes with Herdr's pane keys.`))
    .child(div().text_size(13).font_semibold().child(status(v, t)))
    .child(results(v, t))
    .children(hints)
    .when(Boolean(pr.hinting), el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
      .child(spinner(t)).child(div().text_size(12).child(`${pr.hinting}…  esc stops`))))
    .when(v.agentOk === false, el => el.child(div().text_size(11.5).text_color(t.dim)
      .child(`Hints and questions are off: the ${v.settings.agent} CLI is not on PATH.`)))
    .when(Boolean(pr.solution), el => el.child(v_flex().gap(6)
      .child(noteLabel(t, "The solution"))
      .child(editorBox(t, pr.solution, String(ex.solution).split("\n").length))))
    .when(passed, el => el.child(v_flex().gap(6).pt(4)
      .child(banner(t, `Passed. Here is how ${repo} writes ${ex.concept}.`, t.ansi2))
      .child(h_flex().id("source-file").gap(8).cursor_pointer().hover(st => st.bg(t.hover)).on_click(() => v.openPracticeSource())
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.accent).font_family(mono()).child(lg.file))
        .child(div().flex_none().text_size(11.5).text_color(t.dim).child(`lines ${lg.start}–${lg.end}  ·  ${v.shown("open-file", "o") || "click"} opens`)))
      .child(pr.source ? editorBox(t, pr.source, lg.end - lg.start + 1)
        : div().text_size(12).text_color(pr.sourceError ? t.ansi1 : t.dim).child(pr.sourceError ?? "Loading…"))
      .child(div().text_size(12).text_color(t.dim).child(`Compare: what does ${repo} add or do differently from your version, and why?`))));
  const id = `practice-${key}`;
  const scroll = div().relative().flex_1().min_h(0)
    .child(v_flex().id(id).size_full().overflow_y_scroll().track_scroll(v.practiceScroll).px(14).py(12)
      .child(div().h(1)).child(body).child(div().h(1)))
    .child(Scrollbar.vertical(id).absolute().inset_0());
  const bar = paneBar(t);
  if (pr.confirm) {
    const what = pr.confirm === "solution" ? "Show the full solution? It counts as giving up on this one." : `Put the starter back in ${file}? Your code, hints and answers are cleared.`;
    bar.child(div().text_size(12).text_color(t.ansi1).child(what))
      .child(button(t, "confirm-yes", "Yes", "y", true, cx => { v.practiceConfirm("y", cx); cx.notify(); }))
      .child(button(t, "confirm-no", "Cancel", "any key", true, cx => { pr.confirm = null; cx.notify(); }));
  } else {
    const hint = v.canAsk();
    bar.child(button(t, "pedit", "Edit", v.shown("practice-edit", "e"), true, cx => { v.practiceEdit(cx); cx.notify(); }))
      .child(button(t, "prun", "Run", v.shown("practice-run", "r"), true, cx => { v.practiceRun(cx); cx.notify(); }))
      .child(button(t, "phint", "Hint", v.shown("practice-hint", "h"), hint, cx => { v.practiceHint(cx); cx.notify(); }))
      .child(button(t, "pask", "Ask", v.shown("ask", "a"), hint, cx => { v.startAsking(cx); cx.notify(); }))
      .child(button(t, "psol", "Solution", v.shown("practice-solution", "x"), true, cx => { pr.confirm = "solution"; cx.notify(); }))
      .child(button(t, "preset", "Reset", v.shown("practice-reset", "c"), true, cx => { pr.confirm = "reset"; cx.notify(); }))
      .child(button(t, "pprev", "Previous", "k", pr.i > 0, cx => { v.practiceMove(-1, cx); cx.notify(); }))
      .child(button(t, "pnext", "Next", "j", pr.i < pr.exs.length - 1, cx => { v.practiceMove(1, cx); cx.notify(); }))
      .child(button(t, "psource", `Open in ${repo}`, v.shown("open-file", "o"), passed, cx => v.openPracticeSource(cx)))
      .child(button(t, "pback", "Back", "esc", true, cx => { v.practiceBack(cx); cx.notify(); }));
  }
  // The ask box is only drawn while asking, so practice keys can never land in it.
  const ask = div().px(14).pb(8).child(textInput(t, v.input, true));
  return v_flex().flex_1().min_h(0).child(header).child(scroll).when(v.asking, el => el.child(ask)).child(bar);
}
