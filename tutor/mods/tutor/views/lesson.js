// One stop: header, the code excerpt, the explanation with chat answers under it, and the key bar.
// The layout follows Tourist's tour view, without anything about pull requests.
import { div } from "gpui-kit";
import { v_flex, h_flex, Editor, TextView, Scrollbar, h_resizable, v_resizable, resizable_panel } from "gpui-base";
import { settings } from "herdr";
import { spinner, textInput } from "../kit/controls.js";
import { paneHeader, paneBar } from "../kit/pane.js";
import { button, noteLabel } from "../ui.js";
import { COMPARE } from "../constants.js";

/** `v` is the Tutor view: its state is read here and its methods run on clicks. */
export function lessonView(v, t) {
  const mod = v.mod, s = mod.stops[v.idx], key = `${mod.id}-${v.idx}`;
  const header = paneHeader(t)
    .child(div().flex_none().text_size(11.5).text_color(t.dim).child(`${v.idx + 1} / ${mod.stops.length}`))
    .child(div().flex_1().min_w(0).truncate().font_semibold().child(s.title))
    .child(div().max_w(240).truncate().text_size(11.5).text_color(t.dim).child(mod.title));
  const fileLine = h_flex().id("file").px(14).py(6).gap(8).items_center().cursor_pointer()
    .hover(st => st.bg(t.hover)).on_click(() => v.openEditor())
    .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.accent).font_family(String(settings().font_family ?? "")).child(s.file))
    .child(div().flex_shrink_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(`lines ${s.start}–${s.end}  ·  o opens`));
  const code = div().flex_1().min_h(0).mx(14).mb(4).rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
    .child(v.code ? Editor.new(v.code).size_full()
      : div().p(10).text_size(12).text_color(v.codeError ? t.ansi1 : t.dim).child(v.codeError ?? "Loading…"));
  const notes = (v.notes[v.idx] ?? []).map((n, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
    .child(noteLabel(t, n.label))
    .child(TextView.markdown(`note-${key}-${i}`, n.text).selectable()));
  // Cap the line length so long explanations stay readable in wide panes.
  const body = v_flex().w_full().max_w(680).gap(10)
    .when(v.idx === 0 && Boolean(mod.intro), el => el.child(v_flex().p(10).gap(4).rounded(8).bg(t.raised)
      .child(noteLabel(t, "This module"))
      .child(TextView.markdown(`intro-${mod.id}`, String(mod.intro)).selectable())))
    .child(TextView.markdown(`body-${key}`, String(s.body ?? "")).selectable())
    .children(notes)
    .when(Boolean(v.busy), el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
      .child(spinner(t)).child(div().text_size(12).child(`${v.busy}…  esc stops`))))
    .when(v.claude === false, el => el.child(div().text_size(11.5).text_color(t.dim)
      .child("Chat is off: the claude CLI is not on PATH. Lessons and quizzes still work.")));
  // A plain scroll area driven by v.explainScroll, with empty markers first and last:
  // showing a stop reveals the first, asking reveals the last.
  const explainId = `explain-${key}`;
  const explain = div().relative().flex_1().min_h(0)
    .child(v_flex().id(explainId).size_full().overflow_y_scroll().track_scroll(v.explainScroll).px(14).py(12)
      .child(div().h(1)).child(body).child(div().h(1)))
    .child(Scrollbar.vertical(explainId).absolute().inset_0());
  // The ask box is only drawn while asking, so lesson keys can never land in it.
  const ask = div().px(14).pb(8).child(textInput(t, v.input, true));
  const chat = v.canAsk();
  const last = v.idx === mod.stops.length - 1;
  const bar = paneBar(t)
    .child(button(t, "prev", "Previous", "k", v.idx > 0, cx => { v.move(-1, cx); cx.notify(); }))
    .child(button(t, "next", last ? "Quiz" : "Next", "j", true, cx => { v.move(1, cx); cx.notify(); }))
    .child(button(t, "askbtn", "Ask", "a", chat, cx => { v.startAsking(cx); cx.notify(); }))
    .child(button(t, "deeper", "Deeper", "d", chat, cx => { v.deeper(cx); cx.notify(); }))
    .child(button(t, "compare", `Like ${COMPARE}`, "t", chat, cx => { v.likeKnown(cx); cx.notify(); }))
    .child(button(t, "quiz", "Quiz", "q", true, cx => { v.startQuiz(cx); cx.notify(); }))
    .child(button(t, "practice", "Practice", "p", v.canPractice(mod.id), cx => { v.openPractice(mod.id, cx, "lesson"); cx.notify(); }))
    .child(button(t, "openfile", "Open", "o", true, () => v.openEditor()))
    .child(button(t, "layout", v.isSplit() ? "Stacked" : "Split", "s", true, cx => { v.toggleSplit(); cx.notify(); }))
    .child(button(t, "home", "Modules", "esc", true, cx => { v.goHome(cx); cx.notify(); }))
    .when(Boolean(v.flash), el => el.child(div().text_size(11.5).text_color(t.dim).child(v.flash)));
  const codeSide = v_flex().size_full().min_h(0).min_w(0).overflow_hidden().child(fileLine).child(code);
  const textSide = v_flex().size_full().min_h(0).child(explain).when(v.asking, el => el.child(ask));
  // Split starts with the code at 70% of the pane. Stacked starts from a fixed code height.
  const panes = v.isSplit()
    ? h_resizable("tutor-split-70").size_full()
      .child(resizable_panel().size(Math.round(v.width * 0.7) || 560).size_range(200).child(codeSide.pb(8)))
      .child(resizable_panel().size_range(240).child(textSide))
    : v_resizable("tutor-stack").size_full()
      .child(resizable_panel().size(360).size_range(80).child(codeSide))
      .child(resizable_panel().size_range(80).child(textSide));
  return v_flex().flex_1().min_h(0).child(header)
    .child(h_flex().flex_1().min_h(0).child(div().flex_1().min_w(0).h_full().child(panes)))
    .child(bar);
}
