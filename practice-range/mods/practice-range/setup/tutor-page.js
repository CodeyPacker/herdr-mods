// Setup's AI tutor page: off, Claude Code or Codex, each with whether its command is installed
// and signed in. Choosing one checks it again before it is saved (main.js changeTutor).
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { spinner } from "../kit/controls.js";
import { card, badge, banner } from "../kit/pane.js";
import { statusTag, pageTop, pageBody, cardGrid, inGrid, cardTitle, pageLegend } from "./parts.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../tutor/config.js").TutorProvider} TutorProvider */

/** @param {TutorProvider} provider */
export function tutorName(provider) { return provider === "claude" ? "Claude Code" : "Codex"; }

/** @type {{ id: TutorProvider | null, key: string, mark: string, color: string, login: string }[]} */
const CHOICES = [
  { id: null, key: "0", mark: "–", color: "border", login: "" },
  { id: "claude", key: "1", mark: "C", color: "ansi3", login: "claude auth login" },
  { id: "codex", key: "2", mark: "X", color: "ansi6", login: "codex login" },
];

/**
 * One provider's state from the scan, as a tag and a line under its name.
 * @param {Theme} t @param {import("../types.js").TutorProbe | undefined} probe @param {string} login
 */
function providerState(t, probe, login) {
  if (!probe) return { status: spinner(t), line: "Checking…", note: "" };
  if (!probe.found) return { status: statusTag(t, "Not installed", "neutral"), line: "Not installed", note: "" };
  if (!probe.ready) return { status: statusTag(t, "Needs sign-in", "needed"), line: probe.version, note: probe.detail || `Run ${login} in a terminal.` };
  return { status: statusTag(t, "Ready", "ready"), line: probe.version, note: "" };
}

/**
 * @param {Theme} t
 * @param {{ flow: import("./flow.js").SetupFlow, tutor: import("../tutor/config.js").TutorConfig, busy: boolean,
 *   error: string, compact: boolean, change: (provider: TutorProvider | null, cx: Context) => void }} options
 */
export function tutorPage(t, { flow, tutor, busy, error, compact, change }) {
  const current = tutor.enabled ? tutor.provider : null;
  return v_flex().flex_1().min_h(0)
    .child(pageBody("setup-tutor")
      .child(pageTop(t, { label: "SETUP · AI TUTOR · OPTIONAL", title: "Ask an AI about your code", intro: "Practice works without AI. With it on, you can ask questions about the exercise you're on.", compact }))
      .child(cardGrid().children(CHOICES.map(choice => {
        const state = choice.id ? providerState(t, flow.tutors?.[choice.id], choice.login) : { status: statusTag(t, "Private", "neutral"), line: "Nothing leaves this computer", note: "" };
        return inGrid(card(t, { id: `setup-tutor-${choice.id ?? "off"}`, on: current === choice.id, click: cx => { if (!busy) change(choice.id, cx); } })
          .child(cardTitle(t, badge(choice.mark, t[choice.color] ?? t.accent, 30), choice.id ? tutorName(choice.id) : "No AI", state.line, state.status))
          .when(Boolean(state.note), element => element.child(div().text_size(12).text_color(t.muted).child(state.note))), 200);
      })))
      .when(busy, element => element.child(div().text_color(t.muted).child("Checking the connection…")))
      .when(Boolean(error), element => element.child(banner(t, error, t.blocked)))
      .when(!compact, element => element.child(div().text_size(12).text_color(t.dim)
        .child("Only when you ask, your saved answer, the exercise, check results and recent chat go to that provider. The tutor explains code. It doesn't edit or run it. Usage counts toward your account's limits."))))
    .child(pageLegend(t, [["0", "no AI"], ["1", "Claude Code"], ["2", "Codex"], ["r", "check again"], ["esc", "back"]]));
}
