// The board: the dialog with one column of tickets per status, and the agents working on them.
//
// Tickets are made and changed with ticket.mjs in this folder (see its top comment). The board
// asks that same script for every project's tickets, and asks again when the data folder changes.
// Starting a ticket runs an agent without a tab, gives it the ticket as its first message, and
// records the agent's terminal on the ticket, so the card shows what that agent is doing.
//
// Keys on the board: h/j/k/l or the arrows move, enter opens the ticket, s starts an agent on it now,
// t has the slot start one when the tickets it waits on are done,
// o goes to its agent (a peek at it when it runs without a tab), g picks the next agent to start with, v switches between this space's
// project and every project, r reloads, esc closes. In a ticket: esc goes back, s and o as above.
// On a ticket in review, y approves it, which ends its agent, and c asks for changes. On a blocked ticket, a answers its
// question. What you type is saved on the ticket and sent to its agent when one is running.
// n makes a ticket for the shown space's repo: type a title, enter, then a description, enter.
// p plans a batch: type what should be built, and a planner agent opens in a tab, writes the
// tickets and waits for you. Tickets it releases, or you set to auto with t, are started by the
// slot once the tickets they wait on are approved (see slot.js).
// Every key is also a command (`tickets.<name>`, see COMMANDS), for keys.json or `herdr-app do`.

import { div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, InputState } from "gpui-base";
import { props, closeOverlay, openOverlay, setShared, exec, hc, run, spaces, focused, knownAgents, shared, watchFolder, nextCommand } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { chip, spinner, textInput } from "./kit/controls.js";
import { legend } from "./kit/legend.js";
import { listNote } from "./kit/list.js";
import { tag, banner, sectionLabel } from "./kit/pane.js";
import { statusDot } from "./kit/spaces.js";
import { script, dataDir, folderOf, readBoard } from "./data.js";
import { installed, savedStarters, usableAgents, pickStarter, neededBy, startAgent, startPlanner, agentOn, showAgent, hideAgent, endAgent } from "./start.js";

/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").AgentInfo} AgentInfo */
/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("./kit/legend.js").Hint} Hint */
/** @typedef {import("./data.js").Ticket} Ticket */
/** @typedef {import("./data.js").Project} Project */
/** @typedef {import("./data.js").Status} Status */
/** @typedef {import("./data.js").BoardData} BoardData */
/** @typedef {{ id: string, p: Project, ticket: Ticket }} Card a ticket with its project. `id` is unique across projects. */
/** @typedef {import("./start.js").Starter} Starter */
/** @typedef {{ card: Card, kind: "answer" | "changes", input: ReturnType<typeof InputState.new> }} Reply the text box that is open, and what it is for */

/** How often to reload when nothing reported a change, in case a change was missed. */
const RELOAD_MS = 10000;
/** What each key does, by the command's name. The names are also what `tickets.<name>` takes. */
const COMMANDS = ["left", "right", "up", "down", "open", "back", "start", "agent", "next-agent", "hide-agent", "approve", "reply", "new", "plan", "auto", "all", "reload"];
/** @type {Record<string, string>} keys by KeyEvent.key or keystroke -> command */
const KEYS = { h: "left", left: "left", l: "right", right: "right", k: "up", up: "up", j: "down", down: "down",
  enter: "open", backspace: "back", s: "start", o: "agent", g: "next-agent", y: "approve", a: "reply", c: "reply", n: "new", p: "plan", t: "auto", v: "all", r: "reload" };

/** The text up to the end of its first sentence. @param {string} text */
const firstSentence = (text) => /^.*?[.!?](?=\s|$)/s.exec(text.trim())?.[0] ?? text.trim();

export class Board {
  /** @param {Context} cx */
  init(cx) {
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    /** True: every project's tickets. False: only the shown space's project. Kept across opens. */
    this.all = localStorage.getItem("all") === "true";
    /** @type {BoardData | null} null until the first load finishes */
    this.board = null;
    this.error = "";
    /** Counts loads, so an older one that finishes late does not replace a newer one. */
    this.loads = 0;
    /** @type {string | null} the selected card's id */
    this.selected = null;
    /**
     * Set when this copy is one ticket in its own dialog, opened over the board: the card's id.
     * Esc closes Herdr's top dialog, so the ticket closes and the board under it stays.
     * @type {string | null}
     */
    this.only = typeof props()?.ticket === "string" ? props().ticket : null;
    /** The board's overlay, for a ticket's dialog to close with its own when an agent's tab is shown. @type {string | null} */
    this.parent = props()?.board ?? null;
    /** The board: true while a ticket's dialog is open over it. Commands sent by name are that dialog's then. */
    this.covered = false;
    if (this.only) this.selected = this.only;
    /** True when this copy shows one ticket in full. */
    this.opened = Boolean(this.only);
    /**
     * The installed agents, most picked first. Asking takes a few seconds the first time, so it
     * starts with the list Herdr's own new-tab menu last saved.
     * @type {Starter[]}
     */
    this.starters = savedStarters();
    /** True until knownAgents() has answered. */
    this.checking = true;
    /** The agent `s` starts with, by key, until one is chosen with g. That choice is shared, so the board and a ticket's dialog agree. */
    this.starterKey = localStorage.getItem("agent") ?? "";
    /** True from `s` until the agent's tab exists. */
    this.starting = false;
    /** What the last action has to say, shown above the key hints. */
    this.message = "";
    /** True when the message is a problem, false when it only reports what happened. */
    this.failed = true;
    /** @type {Reply | null} */
    this.reply = null;
    /** @type {{ folder: string, title: string, input: ReturnType<typeof InputState.new> } | null} a new ticket being typed: the title first, then the description */
    this.draft = null;
    /** @type {{ folder: string, input: ReturnType<typeof InputState.new> } | null} a batch being planned: the box for what should be built */
    this.plan = null;
    /** @type {Record<string, any>} each column's ScrollHandle, by status id */
    this.scrolls = {};
    this.handle.focus();
    cx.timer.every(RELOAD_MS, (cx) => this.reload(cx));
    cx.spawn(async (cx) => {
      // The first load makes the data folder, so the watch below has something to watch.
      await this.load();
      cx.notify();
      for (;;) {
        try { await watchFolder(dataDir()); } catch { return; } // The timer still reloads.
        await this.load();
        cx.notify();
      }
    });
    cx.spawn(async (cx) => {
      try { this.starters = installed(await knownAgents()); } catch {}
      this.checking = false;
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        // A ticket's dialog sends "focus" as it closes, so the board has the keyboard again.
        if (command === "focus") { this.covered = false; this.handle.focus(); }
        else if (!this.covered) { this.say(""); this.act(command, cx); }
        cx.notify();
      }
    });
  }

  /** @param {Context} cx */
  reload(cx) {
    cx.spawn(async (cx) => { await this.load(); cx.notify(); });
  }

  /** Asks ticket.mjs for every project, and which one the shown space's folder belongs to. */
  async load() {
    const load = ++this.loads;
    const space = spaces().find((s) => s.active);
    // A space on another machine has no folder here, so it has no project of its own yet.
    const folder = space && !space.machine ? folderOf(space) : "";
    try {
      const board = await readBoard(folder);
      if (load !== this.loads) return;
      // A scroll handle must not be made while rendering, so each column's is made here.
      for (const s of board.statuses) this.scrolls[s.id] ??= ScrollHandle.new();
      this.board = board;
      this.error = "";
    } catch (e) {
      if (load !== this.loads) return;
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  close() {
    closeOverlay(props().overlay);
  }

  /** Closes this dialog and the board under it, so a tab can be seen. */
  closeAll() {
    if (this.parent) closeOverlay(this.parent);
    this.close();
  }

  /** A ticket's dialog is closing: the board under it takes the keyboard back. */
  leaving() {
    if (this.only) run("tickets.focus");
  }

  /** The agents `s` can start: the installed ones the person has not hidden. @returns {Starter[]} */
  usable() {
    return usableAgents(this.starters);
  }

  /** The cards being shown, one list per status, in the board's column order. @returns {Card[][]} */
  columns() {
    const board = this.board;
    if (!board) return [];
    const shown = this.all || this.only ? board.projects : board.projects.filter((p) => p.key === board.current);
    const cards = shown.flatMap((p) => p.tickets.map((ticket) => ({ id: `${p.key}#${ticket.number}`, p, ticket })));
    return board.statuses.map((s) => cards.filter((c) => c.ticket.status === s.id));
  }

  /**
   * Where the selected card is. When nothing is selected, or the selected ticket is gone,
   * it is the first card on the board. Null on an empty board.
   * @param {Card[][]} cols @returns {{ col: number, row: number, card: Card } | null}
   */
  place(cols) {
    for (let col = 0; col < cols.length; col++) {
      const row = cols[col].findIndex((c) => c.id === this.selected);
      if (row >= 0) return { col, row, card: cols[col][row] };
    }
    // A ticket's dialog shows that ticket or nothing, never the first card in its place.
    if (this.only) return null;
    const col = cols.findIndex((c) => c.length > 0);
    return col < 0 ? null : { col, row: 0, card: cols[col][0] };
  }

  /** Moves the selection: `dCol` columns sideways (skipping empty ones), or `dRow` cards down. @param {number} dCol @param {number} dRow */
  move(dCol, dRow) {
    const cols = this.columns();
    const at = this.place(cols);
    if (!at) return;
    let { col, row } = at;
    if (dCol) {
      let next = col + dCol;
      while (next >= 0 && next < cols.length && cols[next].length === 0) next += dCol;
      if (next < 0 || next >= cols.length) return;
      col = next;
      row = Math.min(row, cols[col].length - 1);
    } else {
      row = Math.max(0, Math.min(cols[col].length - 1, row + dRow));
    }
    this.selected = cols[col][row].id;
    const status = this.board?.statuses[col];
    if (status) this.scrolls[status.id]?.scroll_to_item(row);
  }

  /** The agent `s` starts with: the chosen one when it is installed, else the most picked. @returns {Starter | null} */
  starter() {
    return pickStarter(this.starters, this.starterKey);
  }

  /** The running agent a ticket is linked to, if its terminal still has one. @param {Ticket} ticket */
  agentOf(ticket) {
    return agentOn(ticket);
  }

  /**
   * Opens a tab with an agent on the card's ticket, then records that agent's terminal on the
   * ticket and moves it to In progress. The dialog closes, so the new tab shows.
   * @param {Card} card @param {Context} cx
   */
  start(card, cx) {
    const starter = this.starter();
    if (this.starting) return;
    if (!starter) {
      this.say(this.checking ? "Still checking which agents are installed. Press s again in a moment."
        : "No agent to start. Install Claude Code or Codex, or add one to programs.json.");
      return;
    }
    if (card.ticket.status === "done") { this.say(`#${card.ticket.number} is done. Move it back before starting it again.`); return; }
    if (this.agentOf(card.ticket)) { this.say(`#${card.ticket.number} already has an agent. Press o to look at it.`); return; }
    this.starting = true;
    this.message = "";
    cx.spawn(async (cx) => {
      try {
        // The agent runs without a tab, so the board stays and the tab that was shown comes back.
        const shown = focused();
        hideAgent(await startAgent(card.p, card.ticket, starter));
        if (shown?.tab) run("tab.select", { id: shown.tab });
        this.starting = false;
        this.say(`${starter.name} is on #${card.ticket.number}, without a tab. Press o to look at it.`, false);
        await this.load();
        cx.notify();
      } catch (e) {
        this.starting = false;
        this.say(`Could not start: ${e instanceof Error ? e.message : String(e)}`);
        cx.notify();
      }
    });
  }

  /** Does one command. Keys, clicks and `tickets.<name>` all come through here. @param {string} name @param {Context} cx */
  act(name, cx) {
    const at = this.place(this.columns());
    if (this.only && (name === "all" || name === "new" || name === "plan")) return;
    if (name === "all") { this.all = !this.all; localStorage.setItem("all", String(this.all)); this.opened = false; }
    else if (name === "reload") this.reload(cx);
    else if (name === "back") { if (this.only) this.close(); }
    else if (name === "next-agent") {
      const list = this.usable();
      const i = list.indexOf(/** @type {Starter} */ (this.starter()));
      const next = list[(i + 1) % Math.max(1, list.length)];
      if (next) setShared("tickets.agent", next.key);
    }
    else if (name === "hide-agent") {
      // No key does this: it is sent by name ("tickets.hide-agent"), since it is set once.
      const now = this.starter();
      if (!now || this.usable().length < 2) { this.say("The only agent left cannot be hidden."); return; }
      const hidden = /** @type {any} */ (shared("tickets.hiddenAgents"));
      setShared("tickets.hiddenAgents", [...(Array.isArray(hidden) ? hidden : []), now.key]);
      this.say(`${now.name} will not be offered again. To bring it back, remove it from "tickets.hiddenAgents" in shared.json.`, false);
    }
    else if (name === "new") this.openDraft(cx);
    else if (name === "plan") this.openPlan(cx);
    else if (!at) return;
    else if (name === "auto") this.toggleAuto(at.card, cx);
    else if (name === "open") {
      if (this.only) return;
      this.selected = at.card.id;
      this.covered = true;
      openOverlay({ mod: "tickets", kind: "dialog", width: 0.6, height: 0.75, frame: "none", props: { ticket: at.card.id, board: props().overlay } });
    }
    else if (name === "start") this.start(at.card, cx);
    else if (name === "approve") this.approve(at.card, cx);
    else if (name === "reply") this.openReply(at.card, cx);
    else if (name === "agent") {
      const agent = this.agentOf(at.card.ticket);
      if (!agent) { this.say(`#${at.card.ticket.number} has no running agent. Press s to start one.`); return; }
      showAgent(agent);
      this.closeAll();
    }
    else if (this.opened) return; // The rest move around the board, which a ticket in full hides.
    else if (name === "left") this.move(-1, 0);
    else if (name === "right") this.move(1, 0);
    else if (name === "up") this.move(0, -1);
    else if (name === "down") this.move(0, 1);
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // While the text box is open it gets every key. Esc closes it and keeps the ticket as it was.
    if (this.reply || this.draft || this.plan) {
      if (e.key !== "escape") return;
      this.reply = null;
      this.draft = null;
      this.plan = null;
      this.handle.focus();
      cx.stop_propagation();
      cx.notify();
      return;
    }
    cx.stop_propagation();
    // Esc leaves a ticket first, then the board.
    if (e.key === "escape" || e.keystroke === "q") {
      this.close();
      cx.notify();
      return;
    }
    const command = KEYS[e.keystroke] ?? KEYS[e.key];
    if (!command || e.modifiers.control || e.modifiers.alt || e.modifiers.platform) return;
    this.say("");
    this.act(command, cx);
    cx.notify();
  }

  /** Sets the line above the key hints. @param {string} text @param {boolean} [failed] false for a plain report */
  say(text, failed = true) {
    this.message = text;
    this.failed = failed;
  }

  /** Runs ticket.mjs on a card's ticket. Rejects with the script's own message. @param {Card} card @param {string[]} args */
  async change(card, args) {
    const r = await exec("node", [script(), ...args, ...(card.p.root ? ["--in", card.p.root] : [])]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || `ticket.mjs exited with ${r.code}`);
  }

  /** Review passed: the ticket is done. @param {Card} card @param {Context} cx */
  approve(card, cx) {
    const n = card.ticket.number;
    if (card.ticket.status !== "review") { this.say(`#${n} is not in review, so there is nothing to approve.`); return; }
    cx.spawn(async (cx) => {
      try {
        await this.change(card, ["approve", String(n)]);
        // The work is accepted, so its agent has nothing left to do.
        endAgent(card.ticket);
        this.say(`#${n} approved.`, false);
        // A ticket's own dialog has nothing more to show. The board under it does.
        if (this.only) { this.close(); return; }
      } catch (e) { this.say(`Could not approve: ${e instanceof Error ? e.message : String(e)}`); }
      await this.load();
      cx.notify();
    });
  }

  /** Opens the text box: an answer for a blocked ticket, requested changes for one in review. @param {Card} card @param {Context} cx */
  openReply(card, cx) {
    const status = card.ticket.status;
    if (status !== "blocked" && status !== "review") {
      this.say(`#${card.ticket.number} has nothing to reply to. a answers a blocked ticket, and c asks for changes on one in review.`);
      return;
    }
    const kind = status === "blocked" ? "answer" : "changes";
    const input = InputState.new({ placeholder: kind === "answer" ? "Your answer" : "What should change" });
    input.on("submit", (_e, cx) => this.sendReply(cx));
    this.reply = { card, kind, input };
    input.focus();
    // The focus can land before the box is drawn, so it is asked for again.
    cx.timer.after(50, () => input.focus());
  }

  /** Saves what was typed on the ticket, then sends it to the ticket's agent if one is running. @param {Context} cx */
  sendReply(cx) {
    const reply = this.reply;
    const text = reply?.input.value().trim();
    if (!reply || !text) return;
    const { card, kind } = reply;
    const n = card.ticket.number;
    this.reply = null;
    this.handle.focus();
    cx.spawn(async (cx) => {
      try {
        await this.change(card, [kind, String(n), text]);
        const agent = this.agentOf(card.ticket);
        if (!agent) this.say(`Saved on #${n}. No agent is running on it. Press s to start one with your reply.`, false);
        else {
          const lead = kind === "answer" ? `Answer to your question on ticket #${n}` : `Changes requested on ticket #${n}`;
          const sent = await hc(["send", agent.address, `${lead}: "${text}". Carry on with the ticket, and submit it again when it is done.`]);
          if (sent.code === 0) this.say(`Saved on #${n} and sent to ${agent.name}.`, false);
          else this.say(`Saved on #${n}, but it did not reach the agent: ${sent.stderr.trim() || sent.stdout.trim()}`);
        }
      } catch (e) {
        this.say(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      }
      await this.load();
      cx.notify();
    });
    cx.notify();
  }

  /**
   * A text box that has the keyboard. Made here, never while rendering.
   * @param {string} placeholder @param {(cx: Context) => void} submit called on enter @param {Context} cx
   */
  box(placeholder, submit, cx) {
    const input = InputState.new({ placeholder });
    input.on("submit", (_e, cx) => submit(cx));
    input.focus();
    // The focus can land before the box is drawn, so it is asked for again.
    cx.timer.after(50, () => input.focus());
    return input;
  }

  /** Starts a new ticket by asking for its title. It goes to the repo the shown space is on. @param {Context} cx */
  openDraft(cx) {
    const space = spaces().find((s) => s.active);
    if (!space || space.machine) { this.say("A new ticket needs a space on this computer."); return; }
    this.opened = false;
    this.draft = { folder: folderOf(space), title: "", input: this.box("Title", (cx) => this.nextDraft(cx), cx) };
  }

  /** Enter in the new ticket's box: the title leads to the description, the description creates the ticket. @param {Context} cx */
  nextDraft(cx) {
    const draft = this.draft;
    if (!draft) return;
    const text = draft.input.value().trim();
    if (!draft.title) {
      if (text) this.draft = { ...draft, title: text, input: this.box("Description (enter to skip)", (cx) => this.nextDraft(cx), cx) };
      cx.notify();
      return;
    }
    this.draft = null;
    this.handle.focus();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("node", [script(), "create", draft.title, ...(text ? ["--desc", text] : []), "--json", "--in", draft.folder]);
        if (r.code !== 0) throw new Error(r.stderr.trim() || `ticket.mjs exited with ${r.code}`);
        const n = JSON.parse(r.stdout).number;
        await this.load();
        if (this.board?.current) this.selected = `${this.board.current}#${n}`;
        this.say(`Created #${n}.`, false);
      } catch (e) {
        this.say(`Could not create the ticket: ${e instanceof Error ? e.message : String(e)}`);
      }
      cx.notify();
    });
    cx.notify();
  }

  /** What a ticket still waits on, as "Waits on #1, #2". Empty when nothing. @param {Card} card */
  heldBy(card) {
    const open = neededBy(card.p, card.ticket).filter((t) => t.status !== "done");
    return open.length ? `Waits on ${open.map((t) => `#${t.number}`).join(", ")}` : "";
  }

  /** Starts a batch by asking what should be built. It is planned for the repo the shown space is on. @param {Context} cx */
  openPlan(cx) {
    const space = spaces().find((s) => s.active);
    if (!space || space.machine) { this.say("A plan needs a space on this computer."); return; }
    if (!this.starter()) { this.say(this.checking ? "Still checking which agents are installed. Press p again in a moment." : "No agent to plan with. Install Claude Code or Codex."); return; }
    this.plan = { folder: folderOf(space), input: this.box("What should be built?", (cx) => this.sendPlan(cx), cx) };
  }

  /** Enter in the plan box: a planner agent opens in a tab with the goal, and the board closes so the tab shows. @param {Context} cx */
  sendPlan(cx) {
    const plan = this.plan;
    const goal = plan?.input.value().trim();
    const starter = this.starter();
    if (!plan || !goal || !starter) return;
    this.plan = null;
    this.handle.focus();
    this.starting = true;
    cx.spawn(async (cx) => {
      try {
        await startPlanner(plan.folder, goal, starter);
        this.starting = false;
        this.closeAll();
      } catch (e) {
        this.starting = false;
        this.say(`Could not start the planner: ${e instanceof Error ? e.message : String(e)}`);
        cx.notify();
      }
    });
    cx.notify();
  }

  /** Turns auto on or off for a ticket: whether the slot starts an agent on it when it is ready. @param {Card} card @param {Context} cx */
  toggleAuto(card, cx) {
    const n = card.ticket.number;
    if (card.ticket.status !== "todo") { this.say(`#${n} is not in To do. Auto only starts tickets that have not been started.`); return; }
    const on = !card.ticket.auto;
    cx.spawn(async (cx) => {
      try { await this.change(card, ["auto", String(n), ...(on ? [] : ["--off"])]); this.say(on ? `#${n} will start by itself when it is ready.` : `#${n} will not start by itself.`, false); }
      catch (e) { this.say(`Could not change #${n}: ${e instanceof Error ? e.message : String(e)}`); }
      await this.load();
      cx.notify();
    });
  }

  /** The agent on a ticket: its status mark and program name. Empty when none is running. @param {Theme} t @param {Ticket} ticket */
  agentMark(t, ticket) {
    const agent = this.agentOf(ticket);
    if (!agent) return null;
    return h_flex().flex_none().gap(4).items_center().text_size(SIZE.small).text_color(t.muted)
      .child(statusDot(t, /** @type {any} */ (agent.status))).child(agent.tab ? agent.name : `${agent.name}, no tab`);
  }

  /**
   * One ticket on the board. The dim line under the title is what matters most in its column:
   * the question when blocked, the summary when in review, else the start of the description.
   * @param {Theme} t @param {Card} card @param {boolean} on selected
   */
  card(t, card, on) {
    const { p, ticket } = card;
    const waiting = ticket.status === "blocked" && ticket.question;
    const held = ticket.status === "todo" ? this.heldBy(card) : "";
    const note = waiting ? ticket.question
      : ticket.status === "review" && ticket.summary ? ticket.summary
      : ticket.status === "doing" && ticket.feedback ? `Changes: ${ticket.feedback}`
      : held ? held
      : firstSentence(ticket.description ?? "");
    const mark = this.agentMark(t, ticket);
    return v_flex().id(`card-${card.id}`).flex_none().p(10).gap(4).rounded(SIZE.rowRadius).border_1().cursor_pointer()
      .bg(on ? t.selected : t.raised).border_color(on ? t.accent : waiting ? t.blocked : t.border)
      .hover((s) => s.border_color(t.accent))
      .on_click((_e, cx) => { this.selected = card.id; this.message = ""; this.act("open", cx); cx.notify(); })
      .child(h_flex().gap(6).items_center()
        .child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(`#${ticket.number}`))
        .when(this.all, (el) => el.child(div().min_w(0).truncate().text_size(SIZE.small).text_color(t.accent).child(p.name)))
        .child(div().flex_1())
        .when(Boolean(ticket.auto) && ticket.status === "todo", (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.muted).child("auto")))
        .when(Boolean(mark), (el) => el.child(mark)))
      .child(div().text_size(SIZE.text).font_medium().text_color(t.foreground).child(ticket.title))
      .when(Boolean(note), (el) => el.child(div().text_size(SIZE.small).text_color(waiting ? t.blocked : t.dim).child(note)));
  }

  /**
   * One status: its name and count, then its cards in a list that scrolls.
   * @param {Theme} t @param {Status} status @param {Card[]} cards @param {string | null} selected a card's id
   */
  column(t, status, cards, selected) {
    const scroll = this.scrolls[status.id];
    return v_flex().flex_1().h_full().min_w(0).min_h(0).gap(8).p(8).rounded(SIZE.rowRadius).bg(t.background)
      .child(h_flex().flex_none().px(2).gap(6).items_center()
        .child(div().text_size(SIZE.small).font_semibold().text_color(t.muted).child(status.label.toUpperCase()))
        .child(tag(t, String(cards.length), t.dim)))
      .child(v_flex().id(`col-${status.id}`).flex_1().min_h(0).gap(6).overflow_y_scrollbar().track_scroll(scroll)
        .children(cards.map((c) => this.card(t, c, c.id === selected))));
  }

  /** One ticket in full, in place of the columns. @param {Theme} t @param {Card} card @param {Status[]} statuses */
  detail(t, card, statuses) {
    const { p, ticket } = card;
    const status = statuses.find((s) => s.id === ticket.status)?.label ?? ticket.status;
    const mark = this.agentMark(t, ticket);
    const text = (/** @type {string} */ s) => div().text_size(SIZE.text).text_color(t.foreground).child(s);
    return v_flex().flex_1().min_h(0).gap(6)
      .child(h_flex().flex_none().gap(8).items_center()
        .child(div().flex_none().text_size(SIZE.title).text_color(t.dim).child(`#${ticket.number}`))
        .child(div().flex_1().min_w(0).text_size(SIZE.title).font_semibold().text_color(t.foreground).child(ticket.title)))
      .child(h_flex().flex_none().gap(6).items_center()
        .child(tag(t, status, ticket.status === "blocked" ? t.blocked : t.accent))
        .child(tag(t, p.name, t.muted))
        .when(Boolean(ticket.auto), (el) => el.child(tag(t, "auto", t.muted)))
        .when(Boolean(this.heldBy(card)), (el) => el.child(div().text_size(SIZE.small).text_color(t.dim).child(this.heldBy(card))))
        .when(Boolean(mark), (el) => el.child(mark))
        .when(!mark && Boolean(ticket.terminal), (el) => el.child(div().text_size(SIZE.small).text_color(t.dim).child(`Agent ${ticket.terminal} has ended`))))
      .child(v_flex().id("ticket-body").flex_1().min_h(0).overflow_y_scrollbar()
        .when(Boolean(ticket.question), (el) => el.child(sectionLabel(t, "Question")).child(banner(t, ticket.question, ticket.status === "blocked" ? t.blocked : t.foreground)))
        .when(Boolean(ticket.answer), (el) => el.child(sectionLabel(t, "Answer")).child(banner(t, ticket.answer ?? "")))
        .when(Boolean(ticket.feedback), (el) => el.child(sectionLabel(t, "Changes requested")).child(banner(t, ticket.feedback ?? "")))
        .when(Boolean(ticket.summary), (el) => el.child(sectionLabel(t, "Summary")).child(banner(t, ticket.summary)))
        .child(sectionLabel(t, "Description"))
        .child(ticket.description ? text(ticket.description) : div().text_size(SIZE.text).text_color(t.dim).child("No description."))
        .when(Boolean(ticket.criteria?.length), (el) => el.child(sectionLabel(t, "Done when"))
          .children((ticket.criteria ?? []).map((c) => h_flex().gap(8).items_start().child(div().flex_none().text_color(t.dim).child("•")).child(text(c))))));
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const board = this.board;
    const base = { id: "tickets", title: this.only ? "Ticket" : "Tickets", handle: this.handle, fill: true, onKey: (/** @type {KeyEvent} */ e, /** @type {Context} */ cx) => this.key(e, cx) };
    if (!board) return frame(t, base).child(listNote(t, this.error || "Loading…"));

    const cols = this.columns();
    const at = this.place(cols);
    const count = cols.reduce((n, c) => n + c.length, 0);
    const current = board.projects.find((p) => p.key === board.current) ?? null;
    const where = this.all ? `${board.projects.length} ${board.projects.length === 1 ? "project" : "projects"}` :(current?.name ?? spaces().find((s) => s.active)?.name ?? "");
    const details = h_flex().flex_1().min_w(0).items_center().gap(10)
      .when(!this.only, (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim).child(`${where} · ${count} ${count === 1 ? "ticket" : "tickets"}`)))
      .child(div().flex_1())
      .when(Boolean(this.error), (el) => el.child(div().flex_none().max_w(360).truncate().text_size(SIZE.small).text_color(t.blocked).child(this.error)));

    const starter = this.starter();
    const start = /** @type {Hint} */ (["s", starter ? `start ${starter.name}` : "start"]);
    const look = /** @type {Hint} */ (["o", "go to agent"]);
    // The review keys show only on a ticket they work on.
    const status = at?.card.ticket.status;
    /** @type {Hint[]} */
    const review = status === "review" ? [["y", "approve"], ["c", "request changes"]] : status === "blocked" ? [["a", "answer"]] : [];
    /** @type {Hint[]} */
    const auto = status === "todo" ? [["t", at?.card.ticket.auto ? "auto off" : "auto on"]] : [];
    const reply = this.reply;
    const draft = this.draft;
    const plan = this.plan;
    const repo = current?.name ?? spaces().find((s) => s.active)?.name ?? "this space";
    // The open text box, if any: what it is for, and the box.
    const entry = reply ? { label: reply.kind === "answer" ? `Answer #${reply.card.ticket.number}` : `Changes for #${reply.card.ticket.number}`, input: reply.input, enter: "send" }
      : plan ? { label: `Plan for ${repo}`, input: plan.input, enter: "start the planner" }
      : draft ? { label: draft.title ? `Description for "${draft.title}"` : `New ticket in ${repo}`, input: draft.input, enter: draft.title ? "create" : "next" }
      : null;
    /** @type {Hint[]} */
    const hints = entry ? [["enter", entry.enter], ["esc", "cancel"]]
      : this.opened && at
      ? [["esc", "close"], ...review, ...auto, start, look, ["g", "switch agent"]]
      : [["h/j/k/l", "move"], ["enter", "open"], ["n", "new"], ["p", "plan"], ...review, ...auto, start, look, ["g", "switch agent"], ["v", this.all ? "this space" : "all spaces"], ["r", "reload"], ["esc", "close"]];
    const body = this.opened && at ? this.detail(t, at.card, board.statuses)
      : this.only ? v_flex().flex_1().min_h(0).child(listNote(t, "This ticket is gone."))
      : count ? h_flex().flex_1().min_h(0).gap(10).children(board.statuses.map((s, i) => this.column(t, s, cols[i], at?.card.id ?? null)))
      : v_flex().flex_1().min_h(0).child(listNote(t, this.all
        ? "No tickets yet. Press n to make one for this space's repo."
        : "No tickets for this space's repo yet. Press n to make one, or v to see every space."));

    return frame(t, { ...base, details })
      .when(!this.only, (el) => el.child(h_flex().flex_none().gap(6)
        .child(chip(t, { id: "scope-space", label: "This space", on: !this.all, click: (cx) => { if (this.all) this.act("all", cx); cx.notify(); } }))
        .child(chip(t, { id: "scope-all", label: "All spaces", on: this.all, click: (cx) => { if (!this.all) this.act("all", cx); cx.notify(); } }))))
      .child(body)
      .when(this.starting, (el) => el.child(h_flex().flex_none().gap(8).items_center().text_size(12).text_color(t.dim).child(spinner(t)).child("Starting the agent…")))
      .when(Boolean(this.message) && !entry, (el) => el.child(banner(t, this.message, this.failed ? t.blocked : t.foreground)))
      .when(Boolean(entry), (el) => el.child(h_flex().flex_none().gap(10).items_center()
        .child(div().flex_none().max_w(360).truncate().text_size(12).text_color(t.muted).child(entry?.label ?? ""))
        .child(div().flex_1().min_w(0).child(textInput(t, entry?.input)))))
      .child(divider(t))
      .child(legend(t, hints));
  }
}
