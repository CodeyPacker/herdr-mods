// The quiz: one question at a time, then the result screen.
import { div } from "gpui-kit";
import { v_flex, h_flex, TextView, Scrollbar } from "gpui-base";
import { paneHeader, paneTitle, paneDetail, paneBar, banner } from "../kit/pane.js";
import { listRow } from "../kit/list.js";
import { letterBadge } from "../kit/letters.js";
import { button, codeBlock, noteLabel } from "../ui.js";

const LETTERS = ["A", "B", "C", "D"];

/** A scroll area driven by `handle`, with an empty marker first so showing a new screen can reveal the top. */
function scrollArea(id, handle, body) {
  return div().relative().flex_1().min_h(0)
    .child(v_flex().id(id).size_full().overflow_y_scroll().track_scroll(handle).px(14).py(12)
      .child(div().h(1)).child(body))
    .child(Scrollbar.vertical(id).absolute().inset_0());
}

/** One question. `v` is the Tutor view. */
export function quizView(v, t) {
  const mod = v.mod, quiz = mod.quiz, i = v.quiz.i, q = quiz[i], pick = v.quiz.picks[i];
  const locked = pick !== undefined;
  const header = paneHeader(t).child(paneTitle(t, `Question ${i + 1} of ${quiz.length}`)).child(paneDetail(t, mod.title));
  const rows = q.choices.map((c, n) => {
    const right = locked && n === q.answer, wrong = locked && n === pick && n !== q.answer;
    const color = right ? t.ansi2 : wrong ? t.ansi1 : null;
    return listRow(t, { id: `choice-${i}-${n}`, on: false, tall: true, click: locked ? undefined : cx => { v.answer(n, cx); cx.notify(); } })
      .when(Boolean(color), el => el.border_1().border_color(color))
      .child(letterBadge(t, LETTERS[n], "", Boolean(color)))
      .child(div().flex_1().min_w(0).text_color(color ?? t.foreground).child(TextView.markdown(`choice-${mod.id}-${q.id}-${n}`, String(c))))
      .when(right, el => el.child(div().flex_none().text_size(11.5).text_color(t.ansi2).child(pick === q.answer ? "right" : "the answer")))
      .when(wrong, el => el.child(div().flex_none().text_size(11.5).text_color(t.ansi1).child("your pick")));
  });
  const from = Number.isInteger(q.stop) ? mod.stops[q.stop] : null;
  const body = v_flex().w_full().max_w(680).gap(10)
    .child(TextView.markdown(`prompt-${mod.id}-${q.id}`, String(q.prompt)))
    .when(Boolean(q.code), el => el.child(codeBlock(t, q.code)))
    .child(v_flex().gap(4).children(rows))
    .when(locked, el => el.child(v_flex().gap(4).p(10).rounded(8).bg(t.raised)
      .child(noteLabel(t, pick === q.answer ? "Right" : "Not quite"))
      .child(TextView.markdown(`why-${mod.id}-${q.id}`, String(q.why)).selectable())
      .when(Boolean(from), el => el.child(div().text_size(11.5).text_color(t.dim).child(`from stop ${q.stop + 1}: ${from?.title}`)))));
  const last = i === quiz.length - 1;
  const bar = paneBar(t)
    .child(button(t, "answer", "Answer", "a b c d", !locked, () => {}))
    .child(button(t, "continue", last ? "See result" : "Next question", "enter", locked, cx => { v.continueQuiz(cx); cx.notify(); }))
    .child(button(t, "leave", "Leave quiz", "esc", true, cx => { v.leaveQuiz(cx); cx.notify(); }));
  return v_flex().size_full().min_h(0).child(header).child(scrollArea(`quiz-${mod.id}`, v.quizScroll, body)).child(bar);
}

/** The score, pass or not, and what was missed. `v` is the Tutor view. */
export function resultView(v, t) {
  const mod = v.mod, r = v.result;
  const header = paneHeader(t).child(paneTitle(t, "Quiz result")).child(paneDetail(t, mod.title));
  const missed = r.missed.map((id, k) => {
    const q = mod.quiz.find(x => x.id === id);
    const from = Number.isInteger(q.stop) ? mod.stops[q.stop] : null;
    return v_flex().gap(4).pt(8).border_t_1().border_color(t.border)
      .child(h_flex().gap(8).items_start()
        .child(div().flex_none().w(18).text_color(from && k < 9 ? t.accent : t.dim).font_semibold().child(from && k < 9 ? String(k + 1) : "·"))
        .child(div().flex_1().min_w(0).child(TextView.markdown(`missed-${mod.id}-${id}`, String(q.prompt)))))
      .child(div().pl(26).text_size(12).text_color(t.ansi2).child(TextView.markdown(`missed-a-${mod.id}-${id}`, `Answer: ${q.choices[q.answer]}`)))
      .when(Boolean(from), el => el.child(div().pl(26).text_size(11.5).text_color(t.dim).child(`from stop ${q.stop + 1}: ${from?.title}`)));
  });
  const body = v_flex().w_full().max_w(680).gap(10)
    .child(div().text_size(28).font_semibold().child(`${r.score} / ${mod.quiz.length}`))
    .child(banner(t, r.passed ? "Passed. 80% or more is a pass." : "Not passed yet. 80% or more is a pass.", r.passed ? t.ansi2 : t.ansi3))
    .when(r.missed.length > 0, el => el.child(noteLabel(t, "Missed")).children(missed));
  const nextLabel = v.nextModuleId() ? "Next module" : "Modules";
  const bar = paneBar(t)
    .child(button(t, "retry", "Retry", "r", true, cx => { v.startQuiz(cx); cx.notify(); }))
    .child(button(t, "nextmod", nextLabel, "enter", true, cx => { v.afterResult(cx); cx.notify(); }))
    .child(button(t, "modules", "Modules", "m", true, cx => { v.goHome(cx); cx.notify(); }))
    .when(r.missed.length > 0, el => el.child(button(t, "jump", "Go to a missed stop", "1–9", true, () => {})));
  return v_flex().size_full().min_h(0).child(header).child(scrollArea(`result-${mod.id}`, v.quizScroll, body)).child(bar);
}
