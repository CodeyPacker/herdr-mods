// The slot: a small always-on block for a layout bar. It counts the tickets that are waiting
// on you (blocked with a question, or in review) across every project, and sends a toast when
// a ticket starts waiting. Clicking it, or the toast, opens the board.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, notify, watchFolder } from "herdr";
import { colors } from "./kit/theme.js";
import { dataDir, readBoard } from "./data.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./data.js").BoardData} BoardData */

/** How often to reload when nothing reported a change, in case a change was missed. */
const RELOAD_MS = 30000;
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
    cx.timer.every(RELOAD_MS, (cx) => { cx.spawn(async (cx) => { await this.load(); cx.notify(); }); });
    cx.spawn(async (cx) => {
      await this.load();
      cx.notify();
      for (;;) {
        try { await watchFolder(dataDir()); } catch { return; } // The timer still reloads.
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
    for (const w of this.seen ? waiting.filter((w) => !this.seen?.has(w.id)) : []) {
      const blocked = w.ticket.status === "blocked";
      notify({
        title: blocked ? `#${w.ticket.number} needs an answer` : `#${w.ticket.number} is ready for review`,
        body: `${w.p.name}: ${w.ticket.title}\n${blocked ? w.ticket.question : w.ticket.summary}`,
        level: blocked ? "warning" : "success",
        action: { name: "mod.open", args: { name: "tickets" } },
      });
    }
    const ids = waiting.map((w) => w.id).sort();
    const saved = JSON.stringify(ids);
    // Herdr keeps this in the folder being watched, so saving wakes the watch. Saving only a
    // change keeps that from repeating forever.
    if (saved !== JSON.stringify([...(this.seen ?? [])].sort()) || !this.seen) localStorage.setItem("seen", saved);
    this.seen = new Set(ids);
    this.count = waiting.length;
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
