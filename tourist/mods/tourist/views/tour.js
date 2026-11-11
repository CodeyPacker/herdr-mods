// One tour stop: header, the code excerpt, the explanation, and the key bar. On PR tours
// a file list sits on the left, and a file the tour skips can be opened in a stop's place.
import { div } from "gpui-kit";
import { v_flex, h_flex, Editor, TextView, Scrollbar, h_resizable, v_resizable, resizable_panel } from "gpui-base";
import { settings } from "herdr";
import { button, spinner, textInput } from "../ui.js";
import { diffView } from "./diff.js";
import { checkCounts } from "../checks.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function tourView(v, t) {
  const plan = v.plan, s = plan.stops[v.idx];
  const other = v.other, file = other ?? s.file;
  const header = other ? h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().flex_none().px(6).py(1).rounded(5).bg(t.raised).text_size(11).text_color(t.accent)
      .child(v.files?.side.some(f => f.file === other) ? "Tests, docs and generated" : "Also changed"))
    .child(div().flex_1().min_w(0).truncate().font_semibold().child(other.split("/").pop()))
    .child(div().max_w(200).truncate().text_size(11.5).text_color(t.dim).child(plan.title ?? ""))
    : h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().text_size(11.5).text_color(t.dim).child(`${v.idx + 1} / ${plan.stops.length}`))
    .when(Boolean(s.group), el => el.child(div().flex_none().max_w(180).truncate().px(6).py(1).rounded(5).bg(t.raised)
      .text_size(11).text_color(t.accent).child(String(s.group))))
    .child(div().flex_1().min_w(0).truncate().font_semibold().child(s.title))
    .when(Boolean(v.pr?.sinceOid), el => el.child(div().flex_none().px(6).py(1).rounded(5).bg(t.raised).text_size(11).text_color(t.accent)
      .child(`since your review at ${v.pr.sinceOid.slice(0, 7)}`)))
    .when(Boolean(plan.savedAt), el => el.child(div().flex_none().text_size(11).text_color(t.dim).child("saved review · r plans again")))
    .child(div().max_w(200).truncate().text_size(11.5).text_color(t.dim).child(plan.title ?? ""));
  const badge = checksBadge(v, t);
  if (badge) header.child(badge);
  const fileLine = h_flex().id("file").px(14).py(6).gap(8).items_center().cursor_pointer()
    .hover(st => st.bg(t.hover)).on_click(() => v.openInEditor())
    .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.accent).font_family(settings().font_family).child(file))
    .child(div().flex_shrink_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(v.pr
      ? `${other ? "whole diff" : `lines ${s.start}–${s.end}`}  ·  click a line to comment, shift-click to extend${v.comments.length ? ` (${v.comments.length} saved)` : ""}  ·  o opens the PR`
      : `lines ${s.start}–${s.end}  ·  o opens`));
  // On PR tours each diff line takes a comment. A re-review's removed lines are from the old
  // commit, so comments and threads on the base's side don't belong on them.
  const newSide = list => v.pr?.sinceOid ? list.filter(c => c.side !== "old") : list;
  const comments = v.pr ? {
    file, list: newSide(v.comments), input: v.commentInput, threads: newSide(v.threads),
    threadReply: v.threadReply, threadInput: v.threadInput, threadBusy: v.threadBusy, threadError: v.threadError,
    openResolved: v.openResolved, onReply: (th, cx) => v.startThreadReply(th, cx), onResolve: (th, cx) => v.toggleResolved(th, cx),
    onExpand: th => v.toggleResolvedOpen(th),
    open: v.commenting?.file === file ? v.commenting : null,
    onRow: (r, cx, how) => v.startComment(r, cx, how), onDelete: (c, cx) => v.deleteComment(c, cx),
    onEdit: (c, cx) => v.startEdit(c, cx),
  } : null;
  const code = div().flex_1().min_h(0).mx(14).mb(4).rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
    .child(v.diff ? diffView(other ? `diff-file-${other}` : `diff-${v.idx}`, v.diff, t, comments,
        { ...(v.diffMarks ?? { stops: [], stopRows: null }), linkRows: v.linkRows, onStop: (i, cx) => v.show(i, cx) },
        v.scrollReq ?? { handle: v.diffScroll, step: 0 })
      : v.code ? Editor.new(v.code).size_full()
      : div().p(10).text_size(12).text_color(t.dim).child(v.codeError ?? "Loading…"));
  const key = other ? `file-${other}` : String(v.idx);
  const noteList = other ? plan.fileNotes?.[other] ?? [] : s.notes;
  const notes = noteList.map((n, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
    .child(div().text_size(11.5).font_semibold().text_color(t.accent).child(n.label))
    .child(md(v, `note-${key}-${i}`, n.text)));
  // Cap the line length so long explanations stay readable in wide panes.
  const body = v_flex().w_full().max_w(680).gap(10)
    .when(!other && v.idx === 0 && Boolean(plan.summary), el => el.child(v_flex().p(10).gap(4).rounded(8).bg(t.raised)
      .child(div().text_size(11.5).font_semibold().text_color(t.accent).child("Tour summary"))
      .child(md(v, "summary", String(plan.summary)))))
    .when(!other, el => el.child(md(v, `body-${v.idx}`, String(s.body ?? ""))))
    .when(Boolean(other) && noteList.length === 0 && !v.busy, el => el.child(div().text_size(12).text_color(t.dim)
      .child("The tour doesn't stop here. Press e for a short explanation, or a to ask about this file.")))
    .children(notes)
    .when(Boolean(v.busy), el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
      .child(spinner(t))
      .child(div().text_size(12).child(`${v.busy}…`))));
  // A plain scroll area driven by v.explainScroll, with the scrollbar drawn over it, the same way
  // the diff scrolls. Its second child is an empty marker at the end: asking reveals it.
  const explainId = `explain-${key}`;
  const explain = div().relative().flex_1().min_h(0)
    .child(v_flex().id(explainId).size_full().overflow_y_scroll().track_scroll(v.explainScroll).px(14).py(12)
      .child(body).child(div().h(1)))
    .child(Scrollbar.vertical(explainId).absolute().inset_0());
  // The ask box is only drawn while asking, so tour keys can never land in it.
  const ask = div().px(14).pb(8).child(textInput(t, v.input, true));
  const free = !v.busy;
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "prev", "Previous", "k", Boolean(v.moveTarget(-1)), (_e, cx) => { v.move(-1, cx); cx.notify(); }))
    .child(button(t, "next", nextLabel(v), "j", Boolean(v.moveTarget(1)), (_e, cx) => { v.move(1, cx); cx.notify(); }))
    .when(Boolean(other), el => el.child(button(t, "explainfile", "Explain", "e", free, (_e, cx) => { v.explainFile(cx); cx.notify(); })))
    .child(button(t, "deeper", "Deeper", "d", free, (_e, cx) => { v.deeper(cx); cx.notify(); }))
    .child(button(t, "tech", "More technical", "t", free, (_e, cx) => { v.technical(cx); cx.notify(); }))
    .child(button(t, "askbtn", "Ask", "a", free, (_e, cx) => { v.startAsking(cx); cx.notify(); }))
    .when(Boolean(v.pr), el => el.child(button(t, "review", v.comments.length ? `Post review (${v.comments.length})` : "Review", "p",
      v.comments.length > 0 || !v.pr.mine, (_e, cx) => { v.startReview(cx); cx.notify(); })))
    .when(Boolean(v.pr?.mine), el => el.child(button(t, "fix",
      v.fix?.phase === "running" ? "Fixing…" : v.fix && v.fix.phase !== "pushed" ? "View fix" : `Fix ${v.comments.length} comment${v.comments.length === 1 ? "" : "s"}`,
      "f", Boolean(v.fix && v.fix.phase !== "pushed") || (v.comments.length > 0 && free), (_e, cx) => { v.startFix(cx); cx.notify(); })))
    .when(Boolean(v.pr), el => el.child(button(t, "checks", "Checks", "c", true, (_e, cx) => { v.openChecks(cx); cx.notify(); })))
    .when(Boolean(v.pr?.mine), el => el.child(button(t, "merge", "Merge", "m", true, (_e, cx) => { v.startMerge(cx); cx.notify(); })))
    .child(button(t, "layout", v.isSplit() ? "Stacked" : "Split", "s", true, (_e, cx) => { v.toggleSplit(); cx.notify(); }))
    .when(Boolean(v.pr), el => el.child(button(t, "files", v.showFiles ? "Hide files" : "Files", "b", true, (_e, cx) => { v.showFiles = !v.showFiles; cx.notify(); })))
    .child(button(t, "restart", "New tour", "q", true, (_e, cx) => { v.reset(cx); cx.notify(); }));
  // Code and explanation sit in a resizable group: drag the line between them.
  // The group remembers each layout's sizes under its id.
  const codeSide = v_flex().size_full().min_h(0).min_w(0).overflow_hidden().child(fileLine).child(code);
  const textSide = v_flex().size_full().min_h(0).child(explain).when(v.asking, el => el.child(ask));
  // A group keeps the first size it sees and then whatever the user drags to. Split starts with the
  // code at 70% of the pane (the pane is wide by then: its width is what picks split). Stacked starts
  // from a fixed height rather than one measured before the code has loaded. Renaming a group
  // id drops the size it remembered.
  const rail = v.pr && v.showFiles ? fileList(v, t) : null;
  const panes = v.isSplit()
    ? h_resizable("tour-split-70").size_full()
      .child(resizable_panel().size(Math.round((v.width - (rail ? RAIL_WIDTH : 0)) * 0.7) || 560).size_range(200).child(codeSide.pb(8)))
      .child(resizable_panel().size_range(240).child(textSide))
    : v_resizable("tour-stack").size_full()
      .child(resizable_panel().size(360).size_range(80).child(codeSide))
      .child(resizable_panel().size_range(80).child(textSide));
  return v_flex().flex_1().min_h(0).child(header)
    .child(v.pr
      // The file list and the tour sit in a resizable group: drag the line between them. The
      // list's panel is hidden rather than removed when b hides it, so its width is kept.
      ? h_resizable("tour-files").w_full().flex_1().min_h(0)
        .child(resizable_panel().size(RAIL_WIDTH).size_range(140, 560).visible(Boolean(rail)).child(rail ?? div()))
        .child(resizable_panel().size_range(300).child(div().size_full().min_w(0).child(panes)))
      : h_flex().flex_1().min_h(0).child(div().flex_1().min_w(0).h_full().child(panes)))
    .child(bar);
}

const RAIL_WIDTH = 210;

/** The agent's markdown, with file:line references as links that move the code panel. */
function md(v, id, text) {
  return TextView.markdown(id, v.linkify(text)).selectable().on_link_click((url, cx) => { v.clickLink(url, cx); cx.notify(); });
}

/** The PR's CI state in the header: failing, running or passed. Click opens the checks. Null with no checks. */
function checksBadge(v, t) {
  const list = v.checks?.list;
  if (!v.pr || !list?.length) return null;
  const n = checkCounts(list);
  const [text, color] = n.fail ? [`✗ ${n.fail} failing`, t.ansi1] : n.pending ? [`● ${n.pending} running`, t.ansi3] : [`✓ ${n.pass} passed`, t.ansi2];
  return div().id("checks-badge").flex_none().px(6).py(1).rounded(5).bg(t.raised).text_size(11).text_color(color).cursor_pointer()
    .hover(st => st.bg(t.hover)).on_click((_e, cx) => { v.openChecks(cx); cx.notify(); }).child(text);
}

/** "Next" while there's more, "Next file" when it leaves the stops for the other files, "Last file" or "Last stop" at the end. */
function nextLabel(v) {
  const to = v.moveTarget(1);
  if (!to) return v.other ? "Last file" : "Last stop";
  return to.file && !v.other ? "Next file" : "Next";
}

/** The PR's files: the tour's in stop order, then the rest of the code, then tests, docs and generated files. */
function fileList(v, t) {
  const rail = v_flex().id("files").size_full().overflow_y_scrollbar().py(6)
    .border_r_1().border_color(t.border);
  const g = v.files;
  if (!g) return rail.child(div().px(12).py(4).text_size(11.5).text_color(t.dim).child("Loading files…"));
  const current = v.currentFile(), mono = settings().font_family;
  const all = [...g.tour, ...g.also, ...g.side], seen = all.filter(f => v.isViewed(f.file)).length;
  const notes = new Map();
  for (const c of v.comments) notes.set(c.file, (notes.get(c.file) ?? 0) + 1);
  const label = text => div().px(12).pt(4).pb(2).text_size(11).text_color(t.dim).child(text);
  const divider = () => div().mx(0).my(6).border_t_1().border_color(t.border);
  const row = (f, id) => {
    const name = f.file.split("/").pop(), dir = f.file.slice(0, f.file.length - name.length);
    const on = f.file === current, viewed = v.isViewed(f.file), count = notes.get(f.file) ?? 0;
    return h_flex().id(id).gap(6).items_center().pr(10).pl(on ? 8 : 10).py(4).cursor_pointer().text_size(12)
      .when(on, el => el.border_l_2().border_color(t.accent).bg(t.raised))
      .hover(st => st.bg(t.hover)).on_click((_e, cx) => { v.openFile(f, cx); cx.notify(); })
      // The check marks the file viewed without opening it.
      .child(div().id(`${id}-v`).w(14).flex_none().text_size(11).text_color(viewed ? t.ansi2 : t.dim).font_family(mono)
        .on_click((_e, cx) => { cx.stop_propagation(); v.toggleViewed(f.file, cx); cx.notify(); })
        .child(viewed ? "✓" : f.stop !== undefined ? String(f.stop + 1) : f.status))
      .child(h_flex().flex_1().min_w(0).overflow_hidden().whitespace_nowrap()
        .when(Boolean(dir), el => el.child(div().flex_shrink_1().min_w(0).truncate().text_color(t.dim).child(dir)))
        .child(div().flex_none().text_color(viewed ? t.dim : t.foreground).child(name)))
      .when(count > 0, el => el.child(div().flex_none().px(5).rounded(4).bg(t.raised).text_size(10.5).text_color(t.accent)
        .font_family(mono).child(String(count))))
      .child(h_flex().flex_none().gap(4).text_size(11).font_family(mono)
        .when(Boolean(f.add), el => el.child(div().text_color(t.ansi2).child(`+${f.add}`)))
        .when(Boolean(f.del), el => el.child(div().text_color(t.ansi1).child(`−${f.del}`))));
  };
  const groups = [["In the tour", g.tour, "t"], ["Also changed", g.also, "a"], ["Tests, docs and generated", g.side, "s"]].filter(([, list]) => list.length);
  rail.child(div().px(12).pb(4).text_size(11).text_color(seen === all.length && seen ? t.ansi2 : t.dim)
    .child(seen === all.length && seen ? `All ${seen} viewed` : `${seen} of ${all.length} viewed · v marks · j/k move`));
  groups.forEach(([name, list, k], i) => {
    if (i > 0) rail.child(divider());
    rail.child(label(name)).children(list.map((f, j) => row(f, `file-${k}-${j}`)));
  });
  return rail;
}
