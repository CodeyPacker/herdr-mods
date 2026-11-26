// Talking to a chat's agent: the link to its bridge, the bridge's events, and sending messages.
import { panes, playSound } from "herdr";
import { TextareaState } from "gpui-base";
import { Bridge, checkDocuments } from "../agent.js";
import { applyEvent, resetThread, clock } from "../messages.js";
import { errorText } from "../common.js";

export const talk = {
  /**
   * Links a real chat to its bridge: replays what the bridge has, then follows it. With `launch`
   * the bridge is started when it isn't running; without, a chat whose bridge is gone stays as it is.
   * Resolves once the link is open (or failed).
   * @param {any} chat @param {any} cx @param {boolean} launch
   * @returns {Promise<Bridge | null>}
   */
  link(chat, cx, launch) {
    const pending = this.links.get(chat.id);
    if (pending) return pending.then((/** @type {Bridge | null} */ bridge) => bridge || (launch ? this.link(chat, cx, true) : null));
    const had = this.bridges.get(chat.id);
    if (had?.sock) return Promise.resolve(had);
    const connecting = new Promise((resolve) => {
      const bridge = new Bridge({ chat: chat.linkId ?? chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null, title: chat.title, model: chat.selectedModel ?? null, permissions: this.permissionLevel() },
        (ev, cx) => this.onEvent(chat, ev, cx),
        (cx) => { if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id); chat.working = false; this.syncing?.delete(chat.id); cx.notify(); });
      this.bridges.set(chat.id, bridge);
      cx.spawn(async (/** @type {any} */ cx) => {
        try {
          // A running bridge replays everything, so the chat is rebuilt from it. A new one only
          // has what comes next, so what the chat already shows stays.
          const running = await bridge.running();
          if (!launch && !running) { this.bridges.delete(chat.id); resolve(null); return; }
          if (running) { resetThread(chat); await this.loadHistory(chat, bridge.startedAt, cx); }
          const opened = bridge.open(cx);
          // open() reads until the link drops. It is linked once the socket exists, and a slow
          // start is waited for until open() itself gives up.
          let settled = false;
          opened.then(() => { settled = true; }, () => { settled = true; });
          for (let i = 0; i < 400 && !bridge.sock && !settled && this.bridges.get(chat.id) === bridge; i++) await new Promise((d) => cx.timer.after(50, d));
          resolve(bridge.sock ? bridge : null);
          await opened;
        } catch (e) {
          // Stops the bridge's timer too.
          bridge.close();
          if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id);
          this.addError(chat, e);
          chat.connecting = false;
          resolve(null);
          cx.notify();
        }
      });
    });
    const linked = connecting.finally(() => this.links.delete(chat.id));
    this.links.set(chat.id, linked);
    return linked;
  },

  /**
   * Ends a chat's bridge and its agent for good: `bridge`, else this pane's link, else the
   * bridge found by its file.
   * @param {any} chat @param {Bridge} [bridge]
   */
  async quitBridge(chat, bridge = this.bridges.get(chat.id) ?? new Bridge({ chat: chat.linkId ?? chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null }, () => {}, () => {})) {
    await bridge.quit();
    bridge.close();
    if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id);
  },

  /** One event from a chat's bridge. @param {any} chat @param {any} ev @param {any} cx */
  onEvent(chat, ev, cx) {
    if (this.isDeletedChat(chat)) return;
    // The bridge has replayed what came before. Not part of the chat itself.
    // Outputs are looked for once the replay is done, not after each replayed event: each look
    // reads the whole chat, which made a long chat's replay slow.
    if (ev.type === "synced") {
      if (chat.linksNeedRefresh) {
        chat.linksNeedRefresh = false;
        cx.spawn(async cx => this.refreshLinkedChats(cx));
      }
      this.syncOutputs(chat, cx);
      if (this.syncing?.delete(chat.id)) cx.notify();
      if (this.chatId === chat.id) this.bridges.get(chat.id)?.markSeen?.().catch(() => {});
      return;
    }
    if (ev.type === "linked_chat") {
      // Creation events in replay are old snapshots. Read current records instead.
      if (this.bridges.get(chat.id)?.synced) cx.spawn(async cx => this.refreshLinkedChats(cx));
      else chat.linksNeedRefresh = true;
      return;
    }
    if (ev.type === "linked_summary") chat.linkSummary = ev.summary;
    const edit = this.queueEdit;
    if (edit?.chat === chat.id && ev.id === edit.id && ["queue_updated", "queue_removed"].includes(ev.type)) this.cancelQueueEdit();
    else if (edit?.chat === chat.id && ((ev.type === "user" && ev.queueId === edit.id) || (ev.type === "queue_error" && ev.id === edit.id))) {
      edit.saving = false;
      edit.error = ev.type === "queue_error" ? ev.message : "This message started sending. Your edit wasn't applied.";
    }
    const before = chat.session;
    const beforeModel = chat.model;
    const what = applyEvent(chat, ev);
    // A replayed output isn't new, so only a live one is announced.
    if (["turn_end", "tool_done", "user"].includes(ev.type) && this.bridges.get(chat.id)?.synced) this.syncOutputs(chat, cx, true);
    if (ev.type === "connection") {
      const recovery = {};
      chat.recovery = recovery;
      chat.connectionSlow = false;
      if (chat.reconnecting) cx.timer.after(1000, (/** @type {any} */ cx) => {
        if (chat.recovery !== recovery || !chat.reconnecting) return;
        chat.connectionSlow = true;
        cx.notify();
      });
    }
    if (ev.type === "user" || ev.type === "text") chat.stamp = Math.max(chat.stamp ?? 0, Date.now() - 1);
    if (chat.session !== before || chat.model !== beforeModel) this.saveChats();
    const open = chat.id === this.chatId;
    if (open && ev.type === "turn_end") this.bridges.get(chat.id)?.markSeen?.().catch(() => {});
    if (what === "asked" || what === "question") {
      // A question leaves the keyboard in the message box, for typing your own answer.
      if (open) { if (what === "asked") { this.zone = "ask"; this.handle.focus(); } else this.focusInput(); }
      // The pane isn't in front: a sound, like Herdr's own "needs you".
      if (!panes().some((p) => p.mod === "hey-chat" && p.focused)) playSound("blocked");
    }
    // A turn that ends in the background is news, unless the bridge is replaying old turns. It
    // marks the chat unread and puts it one ⌃g away.
    if (what === "ended" && !open && this.bridges.get(chat.id)?.synced) {
      this.unread = { ...this.unread, [chat.id]: true };
    }
    // The permission bar is gone (answered here or elsewhere, withdrawn, or the turn ended): the
    // keyboard goes back to the message box instead of staying on a bar that no longer shows.
    if (open && this.zone === "ask" && !this.waiting(chat)) this.focusInput();
    if (open && this.atBottom && ev.type !== "connection") this.scrollDown(cx);
    cx.notify();
  },

  /**
   * Sends the message box's text, and any images you pasted, to the chat's agent through its bridge.
   * @param {any} cx
   */
  send(cx) {
    const chat = this.chat(this.chatId);
    const box = this.inputFor(chat.agent);
    const text = box.value().trim();
    const attached = chat.attached ?? [];
    const images = attached.filter(file => file.kind !== "document");
    const files = attached.filter(file => file.kind === "document");
    // While the agent asks you something, what you type is your own answer to its next question.
    const asking = this.question(chat);
    if (asking && text) {
      const q = this.answeringQuestion(asking);
      if (q) asking.picks = { ...asking.picks, [q.id]: [text] };
      box.set_value("");
      chat.draft = "";
      this.saveChats();
      this.sendAnswers(asking, cx);
      cx.notify();
      return;
    }
    if ((!text && attached.length === 0) || chat.connecting || chat.modelSaving || chat.reconnecting) return;
    const queued = Boolean(chat.working);
    // Existing bridges pick up the queue protocol on the next idle send, without interrupting a turn.
    if (queued && this.bridges.get(chat.id)?.protocol === 1) {
      this.addError(chat, "Queue support will be ready after this turn. Your draft is still here.");
      cx.notify();
      return;
    }
    if (files.length && this.bridges.get(chat.id)?.protocol < 4 && (queued || chat.thread.some(m => m.queued))) {
      chat.pasteError = "File attachments will be ready after this turn and its queue finish, on your next send. Your draft is still here.";
      cx.notify();
      return;
    }
    const missing = this.missingCli(chat.agent);
    if (missing) { this.addError(chat, missing); this.scrollDown(); return; }
    const skill = chat.agent === "codex" ? this.codexSkill(chat, text) : null;
    box.set_value("");
    chat.draft = "";
    chat.attached = []; chat.pasteError = null;
    if (chat.thread.length === 0 && !chat.session && !chat.customTitle) { const line = text.replace(/\s*\n\s*/g, " ") || files[0]?.name || "Image"; chat.title = line.length > 32 ? `${line.slice(0, 31)}…` : line; }
    chat.stamp = Date.now(); chat.time = clock(Date.now());
    this.saveChats();
    chat.connecting = !queued;
    this.scrollDown(cx);
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        if (files.length) await checkDocuments(files);
        let bridge = await this.link(chat, cx, true);
        // A bridge from before the queue protocol is replaced once it is idle.
        if (bridge?.protocol < 12 && !queued && !chat.working && !chat.thread.some(m => m.queued)) {
          await this.quitBridge(chat, bridge);
          bridge = await this.link(chat, cx, true);
        }
        if (!bridge) throw new Error("Couldn't connect. Your message wasn't sent.");
        if (files.length && bridge.protocol < 4) throw new Error("This running chat needs to finish its turn and queue before file attachments are available. Your draft has been restored.");
        bridge.permissions = this.permissionLevel();
        await bridge.send(text, images, skill, `${chat.id}-${Date.now()}-${this.messageSequence = (this.messageSequence ?? 0) + 1}`, files);
      } catch (e) {
        this.addError(chat, e);
        // Preserve both the failed message and anything typed while its write was in flight.
        const open = this.chatId === chat.id;
        const draft = open ? box.value() : chat.draft;
        chat.draft = [text, draft].filter(Boolean).join("\n\n");
        if (open) box.set_value(chat.draft);
        chat.attached = [...attached, ...(chat.attached ?? [])].filter((img, n, all) => all.findIndex((/** @type {any} */ x) => x.path === img.path) === n);
        this.saveChats();
      } finally {
        chat.connecting = false;
        if (this.chatId === chat.id && this.atBottom) this.scrollDown(cx);
      }
      cx.notify();
    });
  },

  /** Retries the bridge's original request without touching the current composer. */
  retryTurn(id, cx) {
    const chat = this.chat(this.chatId);
    const card = chat.thread.find(m => m.id === id && m.kind === "error" && m.retry);
    if (!card || card.retrying || card.retried || chat.working || chat.connecting || chat.reconnecting || chat.modelSaving) return;
    card.retrying = true;
    card.retryError = null;
    cx.spawn(async (cx) => {
      try {
        const bridge = await this.link(chat, cx, false);
        if (!bridge) throw new Error("This chat is disconnected. Reopen it to reconnect, then try again.");
        if (bridge.protocol < 5) throw new Error("This older chat cannot retry this turn. Send the original message again.");
        await bridge.retryTurn(card.retry.id);
      } catch (error) { card.retrying = false; card.retryError = errorText(error); }
      cx.notify();
    });
  },

  /** Opens a separate editor so the next message's draft stays untouched. */
  editQueued(id) {
    const chat = this.chat(this.chatId);
    const card = chat.thread.find(m => m.queueId === id && m.queueAction && m.queued);
    if (!card || card.sending || this.queueEdit?.saving) return;
    this.cancelQueueEdit();
    const text = chat.thread.find(m => m.queueId === id && m.kind === "text")?.text ?? "";
    const box = TextareaState.new({ placeholder: "Edit queued message", value: text });
    box.set_auto_grow(1, 8);
    box.on("focus", () => { this.zone = "queue-edit"; });
    box.on("change", (_e, cx) => cx.notify());
    this.queueEdit = { chat: chat.id, id, box, saving: false, error: null };
    this.zone = "queue-edit";
    box.focus();
  },

  cancelQueueEdit() {
    if (!this.queueEdit) return;
    this.queueEdit.box.release();
    this.queueEdit = null;
    this.focusInput();
  },

  /** Requests a queue change. The bridge confirms it before the UI changes. */
  changeQueued(id, action, cx) {
    const chat = this.chat(this.chatId);
    const card = chat.thread.find(m => m.queueId === id && m.queueAction && m.queued);
    const edit = this.queueEdit?.chat === chat.id && this.queueEdit.id === id ? this.queueEdit : null;
    if (!card || card.sending) {
      if (edit) edit.error = "This message has already started sending. Your edit wasn't applied.";
      return;
    }
    const text = edit?.box.value().trim() ?? "";
    if (action === "edit" && (!edit || (!text && !chat.thread.some(m => m.queueId === id && (m.kind === "image" || m.kind === "file"))))) {
      if (edit) edit.error = "Add a message or use Remove.";
      return;
    }
    card.sending = true;
    card.queueOperation = action;
    card.queueError = null;
    if (edit) { edit.saving = true; edit.error = null; }
    cx.spawn(async (cx) => {
      try {
        const bridge = await this.link(chat, cx, false);
        if (!bridge) throw new Error("Not connected. Try again.");
        if (bridge.protocol < 3) throw new Error("Queue editing will be available after this turn and its queued messages finish, on your next send.");
        if (action === "edit") await bridge.editQueued(id, text, chat.agent === "codex" ? this.codexSkill(chat, text) : null);
        else await bridge.removeQueued(id);
      } catch (error) {
        card.sending = false;
        card.queueError = errorText(error);
        if (edit) { edit.saving = false; edit.error = card.queueError; }
      }
      cx.notify();
    });
  },

  /** Steers the active turn with a message already in the queue. @param {string} id @param {any} cx */
  sendQueuedNow(id, cx) {
    const chat = this.chat(this.chatId);
    const card = chat.thread.find((/** @type {any} */ m) => m.queueId === id && m.queueAction && m.queued);
    if (!card || card.sending) return;
    card.sending = true;
    card.queueOperation = "send";
    card.queueError = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        const bridge = await this.link(chat, cx, false);
        if (!bridge) throw new Error("Not connected. Try Send now again.");
        await bridge.sendNow(id);
      } catch (e) { card.sending = false; card.queueError = errorText(e); }
      cx.notify();
    });
  },

  /** Stops the open chat's turn. */
  stop() {
    const chat = this.chat(this.chatId);
    if (chat.real && chat.working) this.bridges.get(chat.id)?.stop().catch(() => null);
  },
};
