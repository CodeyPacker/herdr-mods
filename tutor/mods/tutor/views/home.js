// The module list, grouped by part, with each module's progress on the right.
import { div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { paneHeader, paneTitle, paneDetail, paneBar, banner, sectionLabel } from "../kit/pane.js";
import { letterRow } from "../kit/letters.js";
import { rowText, listNote } from "../kit/list.js";
import { spinner } from "../kit/controls.js";
import { button } from "../ui.js";
import { MOVE_NOTICE } from "../constants.js";

/** `v` is the Tutor view: its state is read here and its methods run on clicks. */
export function homeView(v, t) {
  const course = v.course, list = course?.modules ?? [];
  const done = list.filter(m => v.isDone(m.id)).length;
  const header = paneHeader(t).child(paneTitle(t, "Tutor"))
    .child(paneDetail(t, course ? `${course.name}  ·  ${v.lang?.name ?? course.language}  ·  ${done} of ${list.length} modules done  ·  pinned at ${String(course.commit).slice(0, 7)}` : ""))
    .child(v.shortcuts.button(t));
  const body = v_flex().id("home-list").size_full().overflow_y_scroll().track_scroll(v.homeScroll).px(10).pb(10);
  // scroll_to_item counts direct children, so remember which child each module's row is.
  v.rowChild = [];
  let child = 0;
  const add = el => { body.child(el); child++; };
  // A course that is gone: say how to start a new one, by the key that is on now.
  const newKey = v.shown("new-course");
  const startNew = !v.courseGone ? "" : newKey ? ` Press ${newKey} to start a new one.` : " Start a new one with the New course button.";
  if (v.courseError) add(div().pt(10).child(banner(t, `${v.courseError}${startNew}`, t.ansi1)));
  else if (!course) add(listNote(t, h_flex().gap(8).child(spinner(t)).child("Loading the course…")));
  if (v.repoError) add(div().pt(10).child(banner(t, v.repoError, t.ansi1)));
  add(div().px(12).pt(6).text_size(11.5).text_color(t.dim).child(MOVE_NOTICE));
  for (const part of course?.parts ?? []) {
    const mods = list.map((m, i) => ({ m, i })).filter(x => x.m.part === part.id);
    if (!mods.length) continue;
    add(sectionLabel(t, part.title).px(12));
    for (const { m, i } of mods) {
      v.rowChild[i] = child;
      add(letterRow(t, { id: `mod-${m.id}`, letters: v.letters[i] ?? "", typed: v.nav.typed, on: i === v.nav.at, tall: true,
        click: cx => { v.nav.at = i; v.openModule(m.id, cx); cx.notify(); } })
        .child(rowText(t, `${m.id.slice(0, 2)}  ${m.title}`, m.summary))
        .child(moduleState(v, t, m.id)));
    }
  }
  const scroll = div().relative().flex_1().min_h(0).child(body).child(Scrollbar.vertical("home-list").absolute().inset_0());
  const bar = paneBar(t);
  if (v.confirmReset) bar.child(div().text_size(12).text_color(t.ansi1).child("Reset all progress?"))
    .child(button(t, "reset-yes", "Yes, reset", "y", true, cx => { v.resetProgress(cx); cx.notify(); }))
    .child(button(t, "reset-no", "Cancel", "any key", true, cx => { v.confirmReset = false; cx.notify(); }));
  else bar.child(button(t, "open", "Open", "enter", list.length > 0, cx => { v.openAt(cx); cx.notify(); }))
    .child(button(t, "practice", "Practice", v.shown("practice", "p"), v.canPractice(list[v.nav.at]?.id), cx => {
      const m = list[v.nav.at]; if (m) v.openPractice(m.id, cx, "home"); cx.notify(); }))
    .when(v.canRange(list[v.nav.at]?.id), el => el.child(button(t, "range", "Practice Range", v.shown("practice-range", "g"), true, cx => {
      const m = list[v.nav.at]; if (m) v.goRange(m.id, cx); cx.notify(); })))
    .child(button(t, "move", "Move", "j k", true, () => {}))
    .child(button(t, "reset", "Reset progress", v.shown("reset-progress", "r"), Boolean(course), cx => { v.confirmReset = true; cx.notify(); }))
    .child(button(t, "newcourse", "New course", v.shown("new-course", "n"), true, cx => { v.openSetup(cx); cx.notify(); }));
  if (v.flash) bar.child(div().text_size(11.5).text_color(t.dim).child(v.flash));
  if (v.saveError) bar.child(div().text_size(11.5).text_color(t.ansi1).child(`Could not save progress: ${v.saveError}`));
  return v_flex().size_full().min_h(0).child(header).child(scroll).child(bar);
}

/** "3/6", "done", and the best quiz score, on the right of a module's row. */
function moduleState(v, t, id) {
  const p = v.progress?.modules?.[id], mod = v.mods[id];
  const parts = [];
  if (!mod && !v.modErrors[id]) parts.push(div().text_color(t.dim).child("not written yet"));
  else if (v.isDone(id)) parts.push(div().text_color(t.ansi2).child("done"));
  else if (p?.seen?.length && mod) parts.push(div().text_color(t.muted).child(`${p.seen.length}/${mod.stops.length}`));
  if (p?.quiz && mod) parts.push(div().text_color(p.quiz.passed ? t.ansi2 : t.dim).child(`quiz ${p.quiz.best}/${mod.quiz.length}`));
  const exs = v.exercises[id] ?? [];
  if (exs.length && p?.practice) {
    const passed = exs.filter(ex => p.practice[ex.id]?.passed).length;
    parts.push(div().text_color(passed === exs.length ? t.ansi2 : t.dim).child(`practice ${passed}/${exs.length}`));
  }
  if (v.modErrors[id]) parts.push(div().text_color(t.ansi1).child("broken file"));
  return h_flex().flex_none().gap(10).text_size(11.5).children(parts);
}
