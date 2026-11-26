// Talking to a chat's agent: the link to its bridge, the bridge's events, and sending messages.
import { panes, playSound } from "herdr";
import { Bridge } from "../agent.js";
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
      const bridge = new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null, model: chat.selectedModel ?? null },
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
  async quitBridge(chat, bridge = this.bridges.get(chat.id) ?? new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null }, () => {}, () => {})) {
    await bridge.quit();
    bridge.close();
    if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id);
  },

  /** One event from a chat's bridge. @param {any} chat @param {any} ev @param {any} cx */
  onEvent(chat, ev, cx) {
    // The bridge has replayed what came before. Not part of the chat itself.
    // Outputs are looked for once the replay is done, not after each replayed event: each look
    // reads the whole chat, which made a long chat's replay slow.
    if (ev.type === "synced") { this.syncOutputs(chat, cx); if (this.syncing?.delete(chat.id)) cx.notify(); return; }
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
    const images = chat.attached ?? [];
    // While the agent asks you something, what you type is your own answer to its next question.
    const asking = this.question(chat);
    if (asking && text) {
      const q = this.answeringQuestion(asking);
      if (q) asking.picks = { ...asking.picks, [q.id]: [text] };
      box.set_value("");
      this.sendAnswers(asking, cx);
      cx.notify();
      return;
    }
    if ((!text && images.length === 0) || chat.connecting || chat.modelSaving || chat.reconnecting) return;
    const queued = Boolean(chat.working);
    // Existing bridges pick up the queue protocol on the next idle send, without interrupting a turn.
    if (queued && this.bridges.get(chat.id)?.protocol === 1) {
      this.addError(chat, "Queue support will be ready after this turn. Your draft is still here.");
      cx.notify();
      return;
    }
    const missing = this.missingCli(chat.agent);
    if (missing) { this.addError(chat, missing); this.scrollDown(); return; }
    const skill = chat.agent === "codex" ? this.codexSkill(chat, text) : null;
    box.set_value("");
    chat.attached = []; chat.pasteError = null;
    if (chat.thread.length === 0 && !chat.session) { const line = text.replace(/\s*\n\s*/g, " ") || "Image"; chat.title = line.length > 32 ? `${line.slice(0, 31)}…` : line; }
    chat.stamp = Date.now(); chat.time = clock(Date.now());
    this.saveChats();
    chat.connecting = !queued;
    this.scrollDown(cx);
    cx.spawn(async (/** @type {any} */ cx) => {
      try {
        let bridge = await this.link(chat, cx, true);
        // A bridge from before the queue protocol is replaced once it is idle.
        if (bridge?.protocol === 1 && !queued) {
          await this.quitBridge(chat, bridge);
          bridge = await this.link(chat, cx, true);
        }
        if (!bridge) throw new Error("Couldn't connect. Your message wasn't sent.");
        await bridge.send(text, images, skill, `${chat.id}-${Date.now()}-${this.messageSequence = (this.messageSequence ?? 0) + 1}`);
      } catch (e) {
        this.addError(chat, e);
        // Preserve both the failed message and anything typed while its write was in flight.
        const draft = box.value();
        box.set_value([text, draft].filter(Boolean).join("\n\n"));
        chat.attached = [...images, ...(chat.attached ?? [])].filter((img, n, all) => all.findIndex((/** @type {any} */ x) => x.path === img.path) === n);
      } finally {
        chat.connecting = false;
        if (this.chatId === chat.id && this.atBottom) this.scrollDown(cx);
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
