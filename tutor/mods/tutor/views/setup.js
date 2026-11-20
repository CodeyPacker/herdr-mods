// The setup screen: pick a codebase and a language for a new course, or open a course on disk.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { paneHeader, paneTitle, paneDetail, paneBar, sectionLabel } from "../kit/pane.js";
import { listRow, rowText } from "../kit/list.js";
import { textInput } from "../kit/controls.js";
import { LANGUAGES } from "../languages.js";
import { EDITORS, AGENTS } from "../settings.js";
import { learnerOf } from "../learner.js";
import { button } from "../ui.js";

/** `v` is the Tutor view: its state is read here and its methods run on clicks. */
export function setupView(v, t) {
  const s = v.setup, lang = LANGUAGES[s.lang], many = Object.keys(LANGUAGES).length > 1;
  const me = learnerOf({ known: v.setupKnown() }, lang);
  const knownText = me.known.length ? me.known.join(", ") : "nothing yet";
  const compareText = me.compare ? `lessons compare to ${me.compare}` : me.known.length ? `you know ${lang.name} already` : "lessons start from scratch";
  const header = paneHeader(t).child(paneTitle(t, "Tutor"))
    .child(paneDetail(t, "Learn a language from a codebase you pick"));
  const field = (label, value, keys) => h_flex().gap(10).px(12).py(2).items_center().text_size(12.5)
    .child(div().flex_none().w(80).text_color(t.dim).child(label))
    .child(div().flex_1().min_w(0).truncate().child(value))
    .child(div().flex_none().text_size(11.5).text_color(t.dim).child(keys));
  // Sized to its content, so it also draws in a dialog. The spacer below pushes the keys down in a pane.
  const body = v_flex().w_full().px(10).pb(10).gap(2)
    .child(sectionLabel(t, "New course").px(12))
    .child(listRow(t, { id: "setup-new", on: s.at === 0, tall: true, click: cx => { s.at = 0; v.setupEnter(cx); cx.notify(); } })
      .child(rowText(t, `Build a ${lang.name} course`, s.path ? `from ${s.path}` : "Pick a folder first: e types one, b browses")))
    .child(field("Codebase", s.path || "none yet", "e edit  ·  b browse"))
    .when(s.editing, el => el.child(div().px(12).py(4).child(textInput(t, v.pathInput, true))))
    .child(field("Language", lang.name, many ? "l changes" : "more later"))
    .child(field("You know", `${knownText}  ·  ${compareText}`, "w edit"))
    .when(s.editingKnown, el => el.child(div().px(12).py(4).child(textInput(t, v.knownInput, true))))
    .child(field("Editor", EDITORS[v.settings.editor], "v changes"))
    .child(field("Agent", `${AGENTS[v.settings.agent]}${v.agentOk === false ? "  ·  not found on PATH" : ""}`, "a changes"))
    .child(div().px(12).pt(6).text_size(11.5).text_color(t.dim)
      .child(`${AGENTS[v.settings.agent]} reads the repo and plans 10 to 20 modules, pinned to its current commit. Each module is written the first time you open it, and its practice the first time you press p. Nothing in the repo is changed. What you know is kept with each course; the editor and agent are shared by all of them.`));
  if (s.courses.length) {
    body.child(sectionLabel(t, "Your courses").px(12));
    s.courses.forEach((c, i) => {
      const name = LANGUAGES[c.course.language]?.name ?? c.course.language;
      body.child(listRow(t, { id: `setup-${c.slug}`, on: s.at === i + 1, tall: true, click: cx => { s.at = i + 1; v.setupEnter(cx); cx.notify(); } })
        .child(rowText(t, `${c.course.name}  ·  ${name}`, `${c.course.modules.length} modules  ·  ${c.course.root} at ${String(c.course.commit).slice(0, 7)}`))
        .when(c.slug === v.slug, el => el.child(div().flex_none().text_size(11.5).text_color(t.accent).child("current"))));
    });
  }
  const bar = paneBar(t)
    .child(button(t, "setup-go", s.at === 0 ? "Build" : "Open", "enter", s.at > 0 || Boolean(s.path), cx => { v.setupEnter(cx); cx.notify(); }))
    .child(button(t, "setup-edit", "Edit folder", "e", true, cx => { v.editPath(cx); cx.notify(); }))
    .child(button(t, "setup-browse", "Browse", "b", true, cx => { v.browse(cx); cx.notify(); }))
    .child(button(t, "setup-lang", "Language", "l", many, cx => { v.nextLanguage(); cx.notify(); }))
    .child(button(t, "setup-known", "You know", "w", true, cx => { v.editKnown(cx); cx.notify(); }))
    .child(button(t, "setup-editor", "Editor", "v", true, cx => { v.nextEditor(); cx.notify(); }))
    .child(button(t, "setup-agent", "Agent", "a", true, cx => { v.nextAgent(cx); cx.notify(); }))
    .child(button(t, "setup-move", "Move", "j k", s.courses.length > 0, () => {}))
    .child(button(t, "setup-back", "Back", "esc", Boolean(v.course), cx => { v.goHome(cx); cx.notify(); }));
  return v_flex().size_full().min_h(0).child(header).child(body).child(div().flex_1()).child(bar);
}
