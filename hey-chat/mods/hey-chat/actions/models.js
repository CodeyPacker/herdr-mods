// The model picker: listing an agent's models and switching a chat to one.
import { listModels } from "../agent.js";
import { errorText } from "../common.js";

export const models = {
  /** Opens the active agent's model picker. @param {any} cx */
  toggleModels(cx) {
    const chat = this.chat(this.chatId);
    if (this.modelPicker === chat.id) { this.modelPicker = null; return; }
    this.modelPicker = chat.id;
    if (!chat.models) this.loadModels(chat, cx);
  },

  /** @param {any} chat @param {any} cx */
  loadModels(chat, cx) {
    if (chat.modelsLoading) return;
    const agent = chat.agent;
    chat.modelsLoading = true;
    chat.modelsError = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        const models = await listModels(agent, chat.cwd);
        if (chat.agent === agent) chat.models = models;
      } catch (e) { if (chat.agent === agent) chat.modelsError = errorText(e); }
      finally { if (chat.agent === agent) chat.modelsLoading = false; cx.notify(); }
    });
  },

  /** Switches an idle conversation, releasing its writer before the next agent starts. @param {string} model @param {any} cx */
  chooseModel(model, cx) {
    const chat = this.chat(this.chatId);
    if (this.busy(chat) || this.needsYou(chat) || !chat.models?.some((/** @type {any} */ m) => m.id === model)) return;
    if (model === (chat.selectedModel ?? chat.model)) { this.modelPicker = null; return; }
    chat.modelSaving = true;
    chat.modelsError = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        await this.quitBridge(chat);
        chat.selectedModel = model;
        chat.model = model;
        chat.disconnected = false;
        chat.reconnecting = false;
        this.saveChats();
        this.modelPicker = null;
      } catch (e) { chat.modelsError = errorText(e); }
      finally { chat.modelSaving = false; cx.notify(); }
    });
  },
};
