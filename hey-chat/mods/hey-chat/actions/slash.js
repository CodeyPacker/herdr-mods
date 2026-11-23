// The / menu over the message box: the skills the chat's agent has loaded.
import { listSkills } from "../agent.js";

/** The key a chat's skills are kept under: its agent and folder. @param {any} chat */
function skillKey(chat) {
  return `${chat.agent}\n${chat.cwd}`;
}

export const slash = {
  /** The skills the chat's agent has loaded in its folder. */
  slashCommands() {
    const chat = this.chat(this.chatId);
    return chat ? this.skillLists.get(skillKey(chat))?.list ?? [] : [];
  },

  /** True while the open chat's skills are still being looked up. */
  skillsLoading() {
    const chat = this.chat(this.chatId);
    return Boolean(chat && this.skillLists.get(skillKey(chat))?.loading);
  },

  /**
   * The / menu's rows for what's in the box: a / and the start of a name, nothing after it.
   * Names starting with what you typed come first. Null when the menu is closed.
   */
  slashItems() {
    const chat = this.chat(this.chatId);
    if (!chat || this.zone !== "chat" || this.question(chat)) return null;
    const text = this.inputFor(chat.agent).value();
    const m = /^\/([^\s/]*)$/.exec(text);
    if (!m || this.slashClosed === text) return null;
    const q = m[1].toLowerCase();
    const all = this.slashCommands().filter((/** @type {any} */ c) => c.name.toLowerCase().includes(q));
    return [...all.filter((/** @type {any} */ c) => c.name.toLowerCase().startsWith(q)), ...all.filter((/** @type {any} */ c) => !c.name.toLowerCase().startsWith(q))];
  },

  /** On each change in the box: starts the skills lookup at the first /, and lights the first row again. @param {any} cx */
  slashChanged(cx) {
    const chat = this.chat(this.chatId);
    if (!chat || this.question(chat)) return;
    const text = this.inputFor(chat.agent).value();
    if (!text.startsWith("/")) { this.slashClosed = null; return; }
    this.slashIndex = 0;
    const key = skillKey(chat);
    if (this.skillLists.has(key)) return;
    this.skillLists.set(key, { list: [], loading: true });
    cx.spawn(async (/** @type {any} */ cx) => {
      const list = await listSkills(chat.agent, chat.cwd);
      this.skillLists.set(key, { list, loading: false });
      cx.notify();
    });
  },

  /** Moves the lit row. @param {number} step */
  moveSlash(step) {
    const n = this.slashItems()?.length ?? 0;
    if (n) this.slashIndex = (this.slashIndex + step + n) % n;
  },

  /** Closes the menu until the box changes. */
  closeSlash() {
    const chat = this.chat(this.chatId);
    if (chat) this.slashClosed = this.inputFor(chat.agent).value();
  },

  /** Puts a row's /name in the box, ready for what you add after it. @param {{ name: string }} item */
  pickSlash(item) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    const box = this.inputFor(chat.agent);
    const text = `/${item.name} `;
    box.set_value(text);
    box.set_selected_range({ start: text.length, end: text.length });
    this.slashIndex = 0;
    box.focus();
  },

  /**
   * The Codex skill a message starts with (/name), with the SKILL.md path Codex needs, or null.
   * @param {any} chat @param {string} text
   */
  codexSkill(chat, text) {
    const m = /^\/(\S+)/.exec(text);
    const found = m && this.skillLists.get(skillKey(chat))?.list.find((/** @type {any} */ s) => s.name === m[1]);
    return found?.path ? { name: found.name, path: found.path } : null;
  },
};
