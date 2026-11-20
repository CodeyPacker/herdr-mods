import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { keyButton } from "./kit/controls.js";
import { tag } from "./kit/pane.js";
import { languages } from "./languages/index.js";

/** @param {import("./languages/types.js").LanguagePack} language @param {boolean} switching @param {string} open the key that opens the editor, "" for none */
function pages(language, switching, open) {
  return [
    { title: "Practice in your own editor", intro: "Set up your languages and editor. Then choose a language, topic, and exercise to practice.", next: "Get started" },
    { title: "Set up your languages", intro: "You can keep several languages ready to use. Adding one keeps your other languages and progress saved.", next: switching ? "Back to languages" : `Set up ${language.name}` },
    { title: "Prepare this computer", intro: `Node.js runs the practice engine. ${language.name} also needs software that you install yourself. These checks inspect your computer without installing anything.`, next: "Set up editor" },
    { title: "Connect your editor", intro: `Neovim opens automatically beside practice in a 50/50 split. VS Code opens when you ${open ? `press ${open}` : "choose Open editor"}. Choose once, then decide whether to save it as your default.`, next: "Check editor" },
    { title: "Your first repetition", intro: "You are ready to practice. Here is how the editor and practice panel work together.", next: "Start practicing" },
  ];
}

/** @param {import("./kit/theme.js").Theme} t @param {string} name @param {import("./types.js").SetupRequirement | undefined} result */
function requirement(t, name, result) {
  return v_flex().p(12).gap(6).rounded(8).bg(t.raised)
    .child(div().font_semibold().text_color(result?.ready ? t.done : t.muted).child(`${name} · ${result?.ready ? "Ready" : "Needs setup"}`))
    .child(div().text_size(12).child(result?.detail ?? "Run the checks to see what is available."));
}

/**
 * @param {import("./kit/theme.js").Theme} t
 * @param {{ step: number, busy: boolean, requirements: import("./types.js").SetupRequirements | null,
 *   editor: "neovim" | "vscode" | null, offerDefault: boolean, language: import("./languages/types.js").LanguagePack,
 *   activeLanguageId: string, enabled: string[], completed: boolean, keyOf: (id: string) => string,
 *   tutorContent: () => ReturnType<typeof v_flex>, editorContent: () => ReturnType<typeof v_flex>, action: (action: string, cx: import("gpui-kit").Context) => void }} options
 *   `keyOf`: the key a shortcut is on now, "" when it is off or has none
 */
export function setupPanel(t, options) {
  const { step, busy, requirements, editor, offerDefault, language, action } = options;
  const switching = options.completed && options.enabled.includes(language.id);
  const keyOf = options.keyOf;
  // How a sentence names a control: by its key, or by its button when the key is off.
  const press = (/** @type {string} */ id, /** @type {string} */ button) => keyOf(id) ? `Press ${keyOf(id)}` : `Choose ${button}`;
  const all = pages(language, switching, keyOf("open"));
  const page = all[step];
  const requirementsReady = requirements?.node.ready && requirements?.language.ready;
  const canContinue = !busy && (step !== 2 || requirementsReady) && (step !== 3 || (editor && !offerDefault));
  return v_flex().id("syntax-setup").flex_1().min_h(0).overflow_y_scrollbar().p(18).gap(14)
    .child(div().text_size(11).text_color(t.accent).child(`SETUP · ${step + 1} OF ${all.length}`))
    .child(div().text_size(22).font_semibold().child(page.title))
    .child(div().text_color(t.muted).child(page.intro))
    .when(step === 0, element => element.child(div().child(`Use ${keyOf("languages") ? `${keyOf("languages")} ` : ""}Languages to choose what to practice or add another language. Return here anytime with ${keyOf("setup") ? `${keyOf("setup")} ` : ""}Setup.`)))
    .when(step === 0, element => element.child(options.tutorContent()))
    .when(step === 1, element => element.children(languages.map((pack, index) => {
      const chosen = pack.id === language.id;
      const state = options.enabled.includes(pack.id) ? "Ready" : "Not set up";
      return v_flex().id(`setup-pack-${pack.id}`).p(12).gap(8).rounded(8).bg(chosen ? t.selected : t.raised).cursor_pointer()
        .on_click((_event, cx) => action(`setup-language-${pack.id}`, cx))
        .child(h_flex().gap(8).items_center().flex_wrap()
          .child(div().w(18).text_color(chosen ? t.accent : t.dim).child(chosen ? "›" : String(index + 1)))
          .child(div().font_semibold().child(pack.name))
          .child(tag(t, "Bundled"))
          .child(tag(t, state)))
        .child(div().child(`${pack.topics.length} topics · ${pack.exercises.length} exercises · answers in ${pack.answerFile}`))
        .child(div().text_size(12).text_color(t.muted).child(`Included with Practice Range. Requires ${pack.runtime}.`));
    })).child(div().text_size(12).text_color(t.dim).child(`Press ${languages.map((_, index) => index + 1).join(" or ")} to choose a pack.`)))
    .when(step === 2, element => element
      .child(requirement(t, "Node.js", requirements?.node))
      .child(requirement(t, language.runtime, requirements?.language))
      .child(div().text_size(12).text_color(t.muted).child(language.setupInstructions))
      .child(div().text_size(12).text_color(t.muted).child("For the base engine, install Node.js 20 or newer and verify node --version in your terminal. Restart Herdr after changing PATH, then recheck."))
      .child(keyButton(t, "setup-recheck", "v", "Recheck requirements", !busy, cx => action("setup-recheck", cx))))
    .when(step === 3, element => element
      .child(options.editorContent())
      .when(Boolean(editor) && !offerDefault, element => element.child(keyButton(t, "setup-change-editor", "g", "Change editor", !busy, cx => action("setup-change-editor", cx))))
      .when(Boolean(requirements?.editor), element => element.child(requirement(t, "Editor command", requirements?.editor)))
      .child(div().text_size(12).text_color(t.muted).child("For Neovim, nvim --version must work. For VS Code, code --version must work. Install your editor and enable its command, then check again. Restart Herdr if you changed PATH.")))
    .when(step === 4, element => element.child(v_flex().p(12).gap(10).rounded(8).bg(t.raised)
      .child(div().child("1. Choose a language, then a topic and exercise. Use j/k to move and Enter to choose."))
      .child(div().child(`2. Write only your answer in ${language.answerFile}. You can replace the entire file.`))
      .child(div().child(`3. Save in your editor. Your code runs automatically and results appear in the practice panel. Use ${keyOf("open") || "Open editor"} to reopen the editor.`))
      .child(div().child(`4. ${press("hint", "Hint")} for progressively stronger hints. ${press("answer", "Show answer")} to reveal an answer.`))
      .child(div().child(`5. ${press("next", "Another exercise")} for another exercise in the same topic, or ${keyOf("repeat") || "Repeat"} to repeat. Nothing advances you to another topic automatically.`))))
    .child(h_flex().gap(8).flex_wrap()
      .when(step > 0, element => element.child(keyButton(t, "setup-back", "b", "Back", !busy, cx => action("setup-back", cx))))
      .child(keyButton(t, "setup-next", "enter", page.next, Boolean(canContinue), cx => action("setup-next", cx))));
}
