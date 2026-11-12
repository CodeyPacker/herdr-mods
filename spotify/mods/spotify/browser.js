// The dialog's player part: the now-playing header and four tabs of lists (queue, playlists,
// search, devices). This file holds what is selected and what each key does. The data comes
// from library.js, the commands from controls.js and now-playing.js, the drawing from views/browser.js.
import { InputState, ScrollHandle } from "gpui-base";
import { SETTLE_MS, SEEK_STEP_MS, VOLUME_STEP } from "./constants.js";
import { NowPlaying } from "./now-playing.js";
import { PagedList } from "./kit/paged-list.js";
import { readQueue, readPlaylists, readPlaylistTracks, searchTracks, readDevices } from "./library.js";
import { playTracks, playIn, addToQueue, playOn, skipAhead } from "./controls.js";
import { browserView } from "./views/browser.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("./dialog.js").Dialog} Dialog */
/** @typedef {import("./library.js").Row} Row */
/** @typedef {import("./library.js").PlaylistRow} PlaylistRow */
/** @typedef {"queue" | "playlists" | "search" | "devices"} Tab */

/** The tabs, in the order h and l move through them. @type {Tab[]} */
export const TABS = ["queue", "playlists", "search", "devices"];

/**
 * What each key does. Keys are spelled as Herdr reports them (`event.keystroke`).
 * @type {Record<string, (b: Browser, cx: Context) => void>}
 */
const KEYS = {
  h: (b, cx) => b.stepTab(-1, cx),
  left: (b, cx) => b.stepTab(-1, cx),
  l: (b, cx) => b.stepTab(1, cx),
  right: (b, cx) => b.stepTab(1, cx),
  j: (b, cx) => b.move(1, cx),
  down: (b, cx) => b.move(1, cx),
  k: (b, cx) => b.move(-1, cx),
  up: (b, cx) => b.move(-1, cx),
  enter: (b, cx) => b.activate(cx),
  space: (b, cx) => b.now.toggle(cx),
  n: (b, cx) => b.now.next(cx),
  b: (b, cx) => b.now.previous(cx),
  "[": (b, cx) => b.now.seekBy(-SEEK_STEP_MS, cx),
  "]": (b, cx) => b.now.seekBy(SEEK_STEP_MS, cx),
  "-": (b, cx) => b.now.volumeBy(-VOLUME_STEP, cx),
  "=": (b, cx) => b.now.volumeBy(VOLUME_STEP, cx),
  z: (b, cx) => b.now.toggleShuffle(cx),
  r: (b, cx) => b.now.cycleRepeat(cx),
  u: (b, cx) => b.showTab("queue", cx),
  p: (b, cx) => b.showTab("playlists", cx, true),
  s: (b, cx) => b.startSearch(cx),
  d: (b, cx) => b.showTab("devices", cx),
  a: (b, cx) => b.addSelectedToQueue(cx),
  backspace: (b, cx) => b.back(cx),
  escape: (b, cx) => b.back(cx),
  q: (b) => b.dialog.close(),
  "shift-x": (b, cx) => b.dialog.signOut(cx),
};

export class Browser {
  /** @param {Dialog} dialog the shell: it owns the keyboard handle and closes the dialog */
  constructor(dialog) {
    this.dialog = dialog;
  }

  /** @param {Context} cx */
  init(cx) {
    this.now = new NowPlaying();
    // The header shows progress, volume and modes, so every change to them redraws.
    this.now.detailed = true;
    this.now.onTrackChanged = (cx) => { if (this.tab === "queue") this.load(this.lists.queue, cx); };
    /** @type {Tab} */
    this.tab = "queue";
    /** @type {string} the search that the results list shows */
    this.query = "";
    this.lists = {
      queue: new PagedList(() => readQueue()),
      playlists: new PagedList((offset) => readPlaylists(offset)),
      search: new PagedList((offset) => searchTracks(this.query, offset)),
      devices: new PagedList(() => readDevices()),
    };
    /** @type {PlaylistRow | null} the playlist whose tracks show in the playlists tab, or null for the list of playlists */
    this.playlist = null;
    this.tracks = new PagedList((offset) => readPlaylistTracks(this.playlist?.id ?? "", offset));
    this.searchInput = InputState.new({ value: "", placeholder: "Search songs" });
    this.searchInput.on("submit", (_e, cx) => this.runSearch(cx));
    // The box can lose the keyboard without this file seeing a key (it may handle Esc or Tab
    // itself, or the person clicks elsewhere). Take the keyboard back, or no key would work.
    this.searchInput.on("blur", (_e, cx) => { if (this.typing) { this.stopTyping(); cx.notify(); } });
    /** @type {boolean} true while the search box has the keyboard */
    this.typing = false;
    /** The list's scroll position, so the selected row stays in view. */
    this.scroll = ScrollHandle.new();
    /** True after the selection moves, until the next draw scrolls to it. */
    this.reveal = true;
    /** @type {{ text: string, bad: boolean } | null} the last command's result line */
    this.notice = null;
    this.now.start(cx);
    this.showTab("queue", cx);
  }

  /** Stops asking Spotify what is playing. The dialog calls this when it swaps this part out. */
  stop() {
    this.now.stop();
  }

  /** The list on screen. @returns {PagedList<Row>} */
  list() {
    return /** @type {PagedList<any>} */ (this.tab === "playlists" && this.playlist ? this.tracks : this.lists[this.tab]);
  }

  /** Loads a list's first page, then redraws. @param {PagedList<any>} list @param {Context} cx */
  load(list, cx) {
    cx.spawn(async (cx) => {
      await list.reload();
      this.reveal = true;
      cx.notify();
    });
    cx.notify();
  }

  /**
   * @param {Tab} tab
   * @param {Context} cx
   * @param {boolean} [top] for playlists: go back to the list of playlists, out of an open one
   */
  showTab(tab, cx, top = false) {
    this.tab = tab;
    this.stopTyping();
    if (tab === "playlists" && top) this.playlist = null;
    const list = this.list();
    // The queue and the devices change by themselves, so they load on every visit. The rest load once.
    if (tab === "queue" || tab === "devices" || (tab === "playlists" && !list.loaded)) this.load(list, cx);
    this.reveal = true;
    cx.notify();
  }

  /** @param {number} delta @param {Context} cx */
  stepTab(delta, cx) {
    const i = (TABS.indexOf(this.tab) + delta + TABS.length) % TABS.length;
    this.showTab(TABS[i], cx);
  }

  /** Moves the selection, and loads the next page when it nears the end. @param {number} delta @param {Context} cx */
  move(delta, cx) {
    const list = this.list();
    list.move(delta);
    this.reveal = true;
    if (list.wantsMore()) cx.spawn(async (cx) => { await list.loadMore(); cx.notify(); });
    cx.notify();
  }

  /** Selects a row by click, then acts on it like enter. @param {number} index @param {Context} cx */
  click(index, cx) {
    this.list().at = index;
    this.activate(cx);
  }

  /** Enter: what it does depends on the kind of row. @param {Context} cx */
  activate(cx) {
    const list = this.list();
    const row = list.selected();
    if (this.tab === "playlists" && this.playlist) {
      // In an open playlist: play from this track, so the playlist carries on after it.
      // With no tracks listed (a playlist someone else owns), play it from the start.
      const playlist = this.playlist;
      if (row?.kind === "track") this.run(cx, () => playIn(playlist.uri, row.uri));
      else if (list.loaded) this.run(cx, () => playIn(playlist.uri));
    } else if (row?.kind === "playlist") this.openPlaylist(row, cx);
    else if (row?.kind === "device") this.run(cx, () => playOn(row.id));
    else if (row?.kind === "track" && this.tab === "queue") {
      // The queue's first row is the track playing now, so a row's index is how many skips reach it.
      // When nothing is playing there is no such row, and the first row is one skip away.
      const first = list.rows[0];
      const skips = list.at + (first?.kind === "track" && first.uri === this.now.track()?.uri ? 0 : 1);
      if (skips > 0) this.run(cx, () => skipAhead(skips));
    }
    else if (row?.kind === "track") this.run(cx, () => playTracks([row.uri]));
    cx.notify();
  }

  /** @param {PlaylistRow} playlist @param {Context} cx */
  openPlaylist(playlist, cx) {
    this.playlist = playlist;
    this.tracks.clear();
    this.load(this.tracks, cx);
  }

  /**
   * Runs a command, shows its result, then catches up with what it changed.
   * @param {Context} cx
   * @param {() => Promise<string | null>} command
   * @param {string} [done] shown when it worked
   */
  run(cx, command, done) {
    this.notice = null;
    cx.spawn(async (cx) => {
      const failed = await command();
      this.notice = failed ? { text: failed, bad: true } : done ? { text: done, bad: false } : null;
      cx.notify();
      // Spotify takes a moment to report the new state.
      cx.timer.after(SETTLE_MS, (cx) => {
        this.now.read(cx);
        if (this.tab === "queue" || this.tab === "devices") this.load(this.list(), cx);
      });
    });
  }

  /** @param {Context} cx */
  addSelectedToQueue(cx) {
    const row = this.list().selected();
    if (row?.kind === "track") this.run(cx, () => addToQueue(row.uri), `Added to queue: ${row.title}`);
  }

  /** Opens the search tab with the keyboard in its box. @param {Context} cx */
  startSearch(cx) {
    this.tab = "search";
    this.typing = true;
    this.searchInput.focus();
    cx.notify();
  }

  stopTyping() {
    if (!this.typing) return;
    this.typing = false;
    this.dialog.handle.focus();
  }

  /** Enter in the search box: search, and move the keyboard to the results. @param {Context} cx */
  runSearch(cx) {
    const query = this.searchInput.value().trim();
    if (!query) return;
    this.query = query;
    this.stopTyping();
    this.lists.search.clear();
    this.load(this.lists.search, cx);
  }

  /** Esc and backspace: out of an open playlist first, else close the dialog. @param {Context} cx */
  back(cx) {
    if (this.tab === "playlists" && this.playlist) {
      this.playlist = null;
      this.reveal = true;
      cx.notify();
    } else this.dialog.close();
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // While typing a search, Esc and Tab leave the box. Every other key belongs to it (enter arrives as its submit).
    if (this.typing) {
      if (e.key === "escape" || e.key === "tab") { this.stopTyping(); cx.notify(); cx.stop_propagation(); }
      return;
    }
    const action = KEYS[e.keystroke];
    if (!action) return;
    action(this, cx);
    cx.stop_propagation();
  }

  /** @param {Theme} t */
  render(t) {
    return browserView(this, t);
  }
}
