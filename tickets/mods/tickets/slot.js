// The slot: a small always-on block for a layout bar. It counts the tickets that are waiting
// on you (blocked with a question, or in review) across every project, and sends a toast when
// a ticket starts waiting. Clicking it, or the toast, opens the board.
//
// It also starts the agents for tickets set to auto (ticket.mjs auto): a ticket in To do whose
// waited-on tickets are all done gets an agent, up to LIMIT agents at a time. That agent runs
// without a tab, since nobody asked to see it. The board's o key peeks at it.
// Only the slot does this, since it is always there. Without it in the layout nothing starts.
//
// A ticket set to tour (ticket.mjs tour) that reaches review with a pull request gets a Tourist
// tab on that pull request, opened behind the shown tab. Its toast goes to that tab.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, exec, notify, watchFolder, terminals, knownAgents, focused } from "herdr";
import { colors } from "./kit/theme.js";
import { dataDir, readBoard, onlyWorktrees } from "./data.js";
import { installed, savedStarters, pickStarter, startAgent, hideAgent, agentOn, spaceFor } from "./start.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./data.js").BoardData} BoardData */

/** How often to reload when nothing reported a change, in case a change was missed. */
const RELOAD_MS = 30000;
/** How many auto tickets may have a working agent at once. */
const LIMIT = 3;
/** How long a ticket this slot just started counts as busy, until Herdr lists its terminal. */
const SETTLE_MS = 30000;
/** How long a started agent may take to begin working before the slot says it may be stuck on a prompt. */
const STUCK_MS = 60000;
/** The statuses that wait on a person. */
const WAITING = ["blocked", "review"];

export class Slot {
  /** @param {Context} cx */
  init(cx) {
    /** How many tickets are waiting on you. Null until the first load. @type {number | null} */
    this.count = null;
    this.error = "";
    /**
     * The waiting tickets already reported, as "project#number:status". Kept across restarts,
     * so opening Herdr does not toast every ticket that was already waiting. Null: never loaded.
     * @type {Set<string> | null}
     */
    this.seen = null;
    try { const saved = JSON.parse(localStorage.getItem("seen") ?? "null"); if (Array.isArray(saved)) this.seen = new Set(saved); } catch {}
    /** The installed agents. Nothing is started until knownAgents() has answered. @type {import("./start.js").Starter[]} */
    this.starters = savedStarters();
    this.known = false;
    /** True while tickets are being started, so two loads do not start the same one. */
    this.dispatching = false;
    /** When this slot started each ticket, by "project#number". @type {Map<string, number>} */
    this.started = new Map();
    /** The started tickets already checked for a stuck agent. @type {Set<string>} */
    this.checked = new Set();
    /** Tickets that could not be started. They are not tried again until Herdr restarts. @type {Set<string>} */
    this.unstartable = new Set();
    cx.spawn(async (cx) => {
      try { this.starters = installed(await knownAgents()); this.known = true; } catch {}
      await this.load();
      cx.notify();
    });
    cx.timer.every(RELOAD_MS, (cx) => { cx.spawn(async (cx) => { await this.load(); cx.notify(); }); });
    cx.spawn(async (cx) => {
      await this.load();
      cx.notify();
      for (;;) {
        try { if (onlyWorktrees(await watchFolder(dataDir()))) continue; } catch { return; } // The timer still reloads.
        await this.load();
        cx.notify();
      }
    });
  }

  /** Reads every project, counts the waiting tickets and toasts the ones that are new. */
  async load() {
    /** @type {BoardData} */
    let board;
    try { board = await readBoard(); this.error = ""; }
    catch (e) { this.error = e instanceof Error ? e.message : String(e); return; }
    const waiting = board.projects.flatMap((p) => p.tickets.filter((ticket) => WAITING.includes(ticket.status)).map((ticket) => ({ p, ticket, id: `${p.key}#${ticket.number}:${ticket.status}` })));
    // The first load ever only records what is waiting. After that, anything not seen is new.
    const fresh = this.seen ? waiting.filter((w) => !this.seen?.has(w.id)) : [];
    const ids = waiting.map((w) => w.id).sort();
    const saved = JSON.stringify(ids);
    // Herdr keeps this in the folder being watched, so saving wakes the watch. Saving only a
    // change keeps that from repeating forever.
    if (saved !== JSON.stringify([...(this.seen ?? [])].sort()) || !this.seen) localStorage.setItem("seen", saved);
    // Recorded before any tour opens, so a load that starts meanwhile does not open it again.
    this.seen = new Set(ids);
    this.count = waiting.length;
    for (const w of fresh) {
      const blocked = w.ticket.status === "blocked";
      const tab = !blocked && w.ticket.tour && w.ticket.pr && w.p.root ? await this.openTour(w.p, w.ticket) : null;
      notify({
        title: blocked ? `#${w.ticket.number} needs an answer` : tab ? `The tour of #${w.ticket.number} is ready. Click to review it` : `#${w.ticket.number} is ready for review`,
        body: `${w.p.name}: ${w.ticket.title}\n${blocked ? w.ticket.question : w.ticket.summary}`,
        level: blocked ? "warning" : "success",
        action: tab ? { name: "tab.select", args: { id: tab } } : { name: "mod.open", args: { name: "tickets" } },
      });
    }
    this.warnStuck(board);
    await this.dispatch(board);
  }

  /**
   * Opens a Tourist tab on a ticket's pull request, then shows again the tab that was shown, so
   * the person is not taken away from what they are doing. Returns the new tab's id, or null.
   * @param {import("./data.js").Project} p @param {import("./data.js").Ticket} ticket
   */
  async openTour(p, ticket) {
    const space = spaceFor(p);
    const spec = { name: `Review #${ticket.number} ${ticket.title}`.slice(0, 40), mod: "tourist",
      props: { folder: p.root, pr: ticket.pr, ticket: { number: ticket.number, root: p.root, title: ticket.title } },
      ...(space ? { space: space.id } : {}) };
    const shown = focused();
    try {
      // run("tab.new") returns nothing. The CLI prints the tab it made, which the toast needs.
      const made = await exec("herdr-app", ["do", "tab.new", JSON.stringify(spec)]);
      return made.code === 0 ? JSON.parse(made.stdout).tab ?? null : null;
    } catch {
      return null;
    } finally {
      if (shown?.tab) run("tab.select", { id: shown.tab });
    }
  }

  /**
   * An agent with no tab can sit on a prompt nobody sees (Claude Code asks whether to trust a new
   * folder). So a ticket this slot started whose agent reports no status after STUCK_MS gets a toast
   * that peeks at it. Each ticket is checked once.
   * @param {BoardData} board
   */
  warnStuck(board) {
    for (const [id, when] of this.started) {
      if (this.checked.has(id) || Date.now() - when < STUCK_MS) continue;
      this.checked.add(id);
      const found = board.projects.flatMap((p) => p.tickets.map((ticket) => ({ p, ticket }))).find(({ p, ticket }) => `${p.key}#${ticket.number}` === id);
      const agent = found && found.ticket.status === "doing" ? agentOn(found.ticket) : null;
      if (!found || !agent || agent.status) continue;
      notify({
        title: `#${found.ticket.number} may be waiting on a prompt`,
        body: `${found.p.name}: ${found.ticket.title}\nIts agent has not started working. Click to look at it.`,
        level: "warning",
        action: { name: "terminal.peek", args: { terminal: agent.address } },
      });
    }
  }

  /**
   * Starts agents on the auto tickets that are ready, lowest number first, until LIMIT are working.
   * Ready: in To do, and every ticket it waits on is done (approved) or gone.
   * @param {BoardData} board
   */
  async dispatch(board) {
    if (this.dispatching || !this.known) return;
    this.dispatching = true;
    try {
      for (;;) {
        // A ticket is busy while its terminal runs. Herdr may not list a program as an agent yet, so the terminal is what counts.
        const live = new Set(terminals().filter((t) => t.state !== "finished").map((t) => t.address));
        const now = Date.now();
        const all = board.projects.flatMap((p) => p.tickets.map((ticket) => ({ p, ticket, id: `${p.key}#${ticket.number}` })));
        const busy = all.filter(({ ticket, id }) => ticket.auto && ticket.status === "doing"
          && (live.has(ticket.terminal ?? "") || now - (this.started.get(id) ?? 0) < SETTLE_MS)).length;
        if (busy >= LIMIT) return;
        const next = all.find(({ p, ticket, id }) => ticket.auto && ticket.status === "todo" && !this.unstartable.has(id)
          && (ticket.needs ?? []).every((n) => (p.tickets.find((t) => t.number === n)?.status ?? "done") === "done"));
        if (!next) return;
        const n = next.ticket.number;
        const starter = pickStarter(this.starters);
        const shown = focused();
        try {
          if (!starter) throw new Error("No agent is installed, or every one is hidden.");
          hideAgent(await startAgent(next.p, next.ticket, starter));
          this.started.set(next.id, Date.now());
          notify({ title: `Started #${n}`, body: `${next.p.name}: ${next.ticket.title}\n${starter.name} is on it, without a tab. Press o on the ticket to look.` });
        } catch (e) {
          this.unstartable.add(next.id);
          notify({ title: `Could not start #${n}`, body: `${next.p.name}: ${next.ticket.title}\n${e instanceof Error ? e.message : String(e)}`, level: "warning" });
        }
        // The new tab takes the window for a moment before it is taken away. The tab that was shown comes back.
        if (shown?.tab) run("tab.select", { id: shown.tab });
        board = await readBoard();
      }
    } catch {
      // The board could not be read again. The next load tries once more.
    } finally {
      this.dispatching = false;
    }
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const n = this.count ?? 0;
    const text = this.error ? "Tickets: error" : this.count === null ? "Tickets" : n ? `${n} need${n === 1 ? "s" : ""} you` : "No tickets waiting";
    return h_flex().id("tickets-slot").size_full().px(12).gap(7).items_center().justify_center().rounded(13).overflow_hidden()
      .bg(t.chrome).text_size(11.8).cursor_pointer()
      .when(Boolean(this.error), (el) => el.tooltip(this.error))
      .on_click(() => { run("mod.open", { name: "tickets" }); })
      .child(div().flex_none().text_color(n ? t.blocked : t.dim).child(n ? "●" : "○"))
      .child(div().min_w(0).truncate().text_color(this.error ? t.blocked : n ? t.foreground : t.muted).child(text));
  }
}
