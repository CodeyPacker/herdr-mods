// The languages screen: a card per language pack, with what it needs, how far you've come, and
// drill, install and course actions. Ready packs open their topics. Packs that use npm install from here. A pack that
// needs software you install yourself links to its download page.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { keyButton, spinner, meter } from "./kit/controls.js";
import { card, banner } from "./kit/pane.js";
import { languages } from "./languages/index.js";
import { bundledCourses } from "./courses/catalog.js";
import { packBadge, packColor, statusTag, pageTop, pageBody, cardGrid, inGrid, cardTitle, pageLegend } from "./setup/parts.js";

/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./languages/types.js").LanguagePack} LanguagePack */

/**
 * What enter does on a pack's card, from its state: practice when ready, install when npm can,
 * else open the download page. "" while it can't do anything (checking or installing).
 * @param {LanguagePack} pack @param {import("./setup/flow.js").SetupFlow} flow
 * @returns {"practice" | "install" | "download" | ""}
 */
export function packAction(pack, flow) {
  if (!flow.tools || flow.installing === pack.id) return "";
  if (flow.languageReady(pack.id)) return "practice";
  return pack.install.kind === "npm" ? (flow.installing ? "" : "install") : "download";
}

/** @param {"practice" | "install" | "download" | ""} action @param {LanguagePack} pack */
function actionLabel(action, pack) {
  if (action === "install") return `Install ${pack.install.what}`;
  if (action === "download") return "Open download page";
  return "Practice";
}

/**
 * @param {Theme} t @param {LanguagePack} pack @param {import("./setup/flow.js").SetupFlow} flow
 * @param {{ on: boolean, busy: boolean, act: (id: string, cx: Context) => void, select: (id: string, cx: Context) => void, learn: (id: string, cx: Context) => void }} options
 */
function packCard(t, pack, flow, { on, busy, act, select, learn }) {
  const scan = flow.tools?.languages[pack.id];
  const installing = flow.installing === pack.id;
  const error = flow.installErrors[pack.id];
  const action = packAction(pack, flow);
  const status = !scan ? spinner(t)
    : installing ? statusTag(t, "Installing", "neutral")
    : scan.ready ? statusTag(t, "Ready", "ready")
    : statusTag(t, pack.install.kind === "npm" ? "Not installed" : "Needs you", "needed");
  return inGrid(card(t, { id: `language-${pack.id}`, on, click: cx => select(pack.id, cx) })
    .child(cardTitle(t, packBadge(t, pack, 36), pack.name, `${pack.topics.length} topics · ${pack.exercises.length} exercises`, status))
    .child(div().text_size(12).text_color(scan?.ready ? t.muted : t.dim)
      .child(!scan ? "Checking…" : scan.ready ? scan.detail : `Needs ${pack.install.what}`))
    .when(Boolean(scan?.passed), element => element.child(v_flex().gap(4)
      .child(h_flex().text_size(11).text_color(t.dim).child(div().flex_1().child("Passed")).child(`${scan?.passed} / ${scan?.total}`))
      .child(meter(t, (scan?.passed ?? 0) / (scan?.total || 1), packColor(t, pack)))))
    .when(installing, element => element.child(h_flex().gap(8).items_center()
      .child(spinner(t))
      .child(div().text_size(12).text_color(t.muted).child(`Installing ${pack.install.what} with npm. This can take a minute.`))))
    .when(Boolean(error), element => element.child(banner(t, error, t.blocked).text_size(11)))
    // Practice and the course sit side by side, the same size, at the bottom so buttons line up across a row.
    .when(!installing, element => element.child(div().flex_1()).child(h_flex().gap(8).flex_wrap()
      .child(keyButton(t, `language-action-${pack.id}`, on ? "enter" : "", actionLabel(action, pack), !busy && Boolean(action), cx => act(pack.id, cx)))
      .when(bundledCourses.some(course=>course.languageId===pack.id), row => row
        .child(keyButton(t,`language-course-${pack.id}`,"","Course",!busy,cx=>learn(pack.id,cx)))))), 220);
}

/**
 * @param {Theme} t
 * @param {{ flow: import("./setup/flow.js").SetupFlow, selected: number, busy: boolean, compact: boolean,
 *   act: (id: string, cx: Context) => void, select: (id: string, cx: Context) => void, learn: (id: string, cx: Context) => void, rescan: (cx: Context) => void }} options
 */
export function languagePanel(t, { flow, selected, busy, compact, act, select, learn, rescan }) {
  const chosen = languages[selected];
  // A pack you install yourself says how, under the cards, while it's the selected one.
  const manual = chosen && flow.tools && !flow.languageReady(chosen.id) && chosen.install.kind === "manual";
  return v_flex().id("syntax-languages").flex_1().min_h(0)
    .child(pageBody("languages-body")
      .child(pageTop(t, { label: "LANGUAGES", title: "What do you want to practice?", intro: "Each language keeps its own answers and progress. Installs run here, with nothing to type in a terminal.", compact }))
      .when(Boolean(flow.scanError), element => element.child(banner(t, `Could not check this computer: ${flow.scanError}`, t.blocked)))
      .child(cardGrid().children(languages.map((pack, index) => packCard(t, pack, flow, { on: index === selected, busy, act, select, learn }))))
      .when(Boolean(manual), element => element.child(card(t, { id: "language-manual" })
        .child(div().text_size(12).child(chosen.setupInstructions))
        .child(h_flex().gap(6).flex_wrap()
          .child(keyButton(t, "language-download", "o", "Open download page", true, cx => act(chosen.id, cx)))
          .child(keyButton(t, "language-recheck", "r", "Check again", !flow.scanningTools, rescan))))))
    .child(pageLegend(t, [["j/k", "move"], ["enter", "practice or install"], ["r", "check again"], ["?", "setup"]]));
}
