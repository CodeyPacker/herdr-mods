// What the agent asks you: its question cards and its permission cards.
import { errorText } from "../common.js";

export const questions = {
  /**
   * Picks an option for one of a question card's questions. One question with one answer is
   * sent at once; otherwise the card waits for its Send button.
   * @param {any} card @param {any} q a question of the card @param {string} label @param {any} cx
   */
  pickAnswer(card, q, label, cx) {
    if (card.state !== "pending" || card.sending) return;
    const now = card.picks[q.id] ?? [];
    card.picks = { ...card.picks, [q.id]: q.multi ? (now.includes(label) ? now.filter((/** @type {string} */ x) => x !== label) : [...now, label]) : [label] };
    if (card.questions.length === 1 && !q.multi) this.sendAnswers(card, cx);
  },

  /** True when every question of a card has an answer. @param {any} card */
  answeredAll(card) {
    return card.questions.every((/** @type {any} */ q) => (card.picks[q.id] ?? []).length > 0);
  },

  /** The first question of a card without an answer yet. @param {any} card */
  nextQuestion(card) {
    return card.questions.find((/** @type {any} */ q) => !(card.picks[q.id] ?? []).length) ?? null;
  },

  /** The question typing or 1 to 9 answers: the next one without an answer, else the last. @param {any} card */
  answeringQuestion(card) {
    return this.nextQuestion(card) ?? card.questions[card.questions.length - 1];
  },

  /** Sends a question card's answers to the agent. @param {any} card @param {any} cx */
  sendAnswers(card, cx) {
    if (!this.answeredAll(card)) return;
    this.replyToQuestion(card, "answered", (/** @type {any} */ bridge) => bridge.answer(card.ask, card.picks), cx);
  },

  /** Dismisses a question card without answering. @param {any} card @param {any} cx */
  dismissQuestion(card, cx) {
    this.replyToQuestion(card, "dismissed", (/** @type {any} */ bridge) => bridge.decide(card.ask, "deny", false), cx);
  },

  /**
   * Sends a question card's reply through the open chat's bridge, then marks the card `state`.
   * A reply that fails shows its reason on the card.
   * @param {any} card @param {string} state @param {(bridge: any) => Promise<void>} reply @param {any} cx
   */
  replyToQuestion(card, state, reply, cx) {
    if (card.state !== "pending" || card.sending) return;
    const chat = this.chat(this.chatId);
    card.sending = true;
    card.error = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        const bridge = this.bridges.get(chat.id);
        if (!bridge) throw new Error("Not connected to the bridge. Reopen this chat to reconnect.");
        await reply(bridge);
        if (card.state === "pending") card.state = state;
      } catch (e) { card.error = errorText(e); }
      card.sending = false;
      cx.notify();
    });
    cx.notify();
  },

  /**
   * Answers the open chat's permission card. An answer that doesn't reach the agent puts the card
   * back, with the reason, since the agent is still waiting on it.
   * @param {"allow" | "deny"} behavior @param {boolean} always @param {any} cx
   */
  decide(behavior, always, cx) {
    const chat = this.chat(this.chatId);
    const card = this.waiting(chat);
    if (!card) return;
    card.state = behavior === "allow" ? (always ? "always" : "allowed") : "denied";
    card.error = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        const bridge = this.bridges.get(chat.id);
        if (!bridge) throw new Error("Not connected to the agent. Reopen this chat, then answer again.");
        await bridge.decide(card.ask, behavior, always);
      } catch (e) {
        card.state = "pending";
        card.error = `Your answer wasn't sent. ${errorText(e)}`;
        if (this.chatId === chat.id) this.focusInput();
        cx.notify();
      }
    });
    this.focusInput();
    cx.notify();
  },
};
