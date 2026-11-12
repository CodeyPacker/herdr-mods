// What the dialog's player part draws: the now-playing header, the tabs, the list and the key hints.
import { div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { TABS } from "../browser.js";
import { slider, textInput, hintLine, spinner, clock } from "../ui.js";
import { playbackButtons, volumeRow } from "./card.js";
import { restingText } from "./slot.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../ui.js").Theme} Theme */
/** @typedef {import("../browser.js").Browser} Browser */
/** @typedef {import("../browser.js").Tab} Tab */
/** @typedef {import("../library.js").Row} Row */
/** @typedef {import("../player.js").Track} Track */

const ART_SIZE = 64;
const ROW_H = 30;
const CLOCK_W = 38;
const VOLUME_W = 90;

/** Each tab's key and name. @type {Record<Tab, [string, string]>} */
const TAB_LABELS = { queue: ["u", "Queue"], playlists: ["p", "Playlists"], search: ["s", "Search"], devices: ["d", "Devices"] };

/** The key hints under the list. The first line is about the list, the second about playback. @type {Record<Tab, [string, string][]>} */
const LIST_HINTS = {
  queue: [["j/k", "move"], ["enter", "skip to it"], ["h/l", "switch tab"]],
  playlists: [["j/k", "move"], ["enter", "open, or play from the track"], ["a", "add to queue"], ["backspace", "back"], ["h/l", "switch tab"]],
  search: [["s", "type a search"], ["j/k", "move"], ["enter", "play"], ["a", "add to queue"], ["h/l", "switch tab"]],
  devices: [["j/k", "move"], ["enter", "play there"], ["h/l", "switch tab"]],
};
/** @type {[string, string][]} */
const PLAYBACK_HINTS = [["space", "play/pause"], ["n/b", "next/previous"], ["[ ]", "seek 10 s"], ["- =", "volume"], ["z", "shuffle"], ["r", "repeat"], ["shift-x", "sign out"], ["q", "close"]];

/** The track, its controls and its progress bar. @param {Browser} b @param {Track} p @param {Theme} t */
function header(b, p, t) {
  const now = b.now;
  const picture = now.art.large
    ? image(now.art.large).size(ART_SIZE).rounded(6).flex_none()
    : div().size(ART_SIZE).flex_none().rounded(6).bg(t.raised);
  // The bar takes the dialog's width minus the two times and the gaps beside them.
  const barW = Math.max(100, b.dialog.innerWidth() - CLOCK_W * 2 - 16);
  return v_flex().flex_none().gap(8)
    .child(h_flex().gap(14).items_center()
      .child(picture)
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_size(15).font_semibold().text_color(t.foreground).child(p.title))
        .child(div().truncate().text_color(t.muted).child(p.album ? `${p.artist} · ${p.album}` : p.artist))
        .when(Boolean(p.device), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(`Playing on ${p.device}`))))
      .child(playbackButtons(now, p, t))
      // No volume control for a device that does not let Spotify set its volume.
      .when(p.volume !== null, (el) => el.child(volumeRow(now, p.volume ?? 0, VOLUME_W, t))))
    .child(h_flex().gap(8).items_center().text_size(10.5).text_color(t.dim)
      .child(div().w(CLOCK_W).flex_none().child(clock(p.progressMs)))
      .child(slider(t, now.seek.state, barW, p.playing ? t.accent : t.dim))
      .child(div().w(CLOCK_W).flex_none().flex().justify_end().child(clock(p.durationMs))));
}

/** @param {Browser} b @param {Theme} t */
function tabs(b, t) {
  return h_flex().flex_none().gap(4).children(TABS.map((tab) => {
    const [key, name] = TAB_LABELS[tab];
    const on = tab === b.tab;
    return h_flex().id(`sp-tab-${tab}`).h(26).px(10).gap(6).items_center().rounded(6).cursor_pointer()
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => (tab === "search" ? b.startSearch(cx) : b.showTab(tab, cx)))
      .child(div().text_size(11).font_semibold().text_color(t.accent).child(key))
      .child(div().text_size(12.5).text_color(on ? t.foreground : t.muted).child(name));
  }));
}

/** One list row's columns. @param {Row} row @param {boolean} playing true for the track that is playing now @param {Theme} t */
function rowCells(row, playing, t) {
  if (row.kind === "track") {
    return [
      div().w(12).flex_none().text_color(t.accent).child(playing ? "♪" : ""),
      div().flex_1().min_w(0).truncate().text_color(playing ? t.accent : t.foreground).child(row.title),
      div().w(240).flex_none().truncate().text_color(t.muted).child(row.artist),
      div().w(CLOCK_W).flex_none().flex().justify_end().text_size(11).text_color(t.dim).child(clock(row.durationMs)),
    ];
  }
  if (row.kind === "playlist") {
    return [
      div().flex_1().min_w(0).truncate().text_color(t.foreground).child(row.name),
      div().w(200).flex_none().truncate().text_color(t.muted).child(row.owner),
      div().w(80).flex_none().flex().justify_end().text_size(11).text_color(t.dim).child(row.count === null ? "" : `${row.count} tracks`),
    ];
  }
  return [
    div().flex_1().min_w(0).truncate().text_color(t.foreground).child(row.name),
    div().w(160).flex_none().truncate().text_color(t.muted).child(row.type),
    div().w(80).flex_none().flex().justify_end().text_size(11).text_color(t.accent).child(row.active ? "playing here" : ""),
  ];
}

/** The words for a list with no rows. @param {Browser} b */
function emptyText(b) {
  if (b.tab === "queue") return "Nothing is queued.";
  if (b.tab === "devices") return "No devices. Open Spotify on this computer, your phone or the web player.";
  if (b.tab === "search") return b.query ? `No songs match "${b.query}".` : "Press s and type a search.";
  return b.playlist ? "This playlist has no tracks." : "You have no playlists.";
}

/** The scrolling list, or a line saying why there is none. @param {Browser} b @param {Theme} t */
function listArea(b, t) {
  const list = b.list();
  const note = (/** @type {any} */ child) => h_flex().px(10).py(8).gap(8).items_center().text_size(12.5).text_color(t.dim).child(child);
  if (list.error) return v_flex().flex_1().min_h(0).child(note(list.error));
  if (!list.loaded) return v_flex().flex_1().min_h(0).child(list.loading ? note(spinner(t)) : note(emptyText(b)));
  if (list.rows.length === 0) return v_flex().flex_1().min_h(0).child(note(emptyText(b)));
  const playingUri = b.now.track()?.uri;
  const rows = list.rows.map((row, i) =>
    h_flex().id(`sp-row-${b.tab}-${i}`).h(ROW_H).flex_none().px(10).gap(10).items_center().rounded(6).cursor_pointer()
      .when(i === list.at, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => b.click(i, cx))
      .children(rowCells(row, row.kind === "track" && row.uri === playingUri, t)));
  // The rows are the list's direct children, so the scroll handle can reveal one by its index.
  if (b.reveal) { b.scroll.scroll_to_item(list.at); b.reveal = false; }
  // The right padding keeps the last column clear of the scrollbar.
  return v_flex().id("sp-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(b.scroll).gap(2).pr(12)
    .children(rows)
    .when(list.loading, (el) => el.child(note(spinner(t))));
}

/** @param {Browser} b @param {Theme} t */
export function browserView(b, t) {
  const p = b.now.playback;
  // One line for the result of the last command: the browser's own, else the playback controls'.
  const notice = b.notice ?? (b.now.message ? { text: b.now.message, bad: true } : null);
  return v_flex().id("sp-browser").flex_1().min_h(0).gap(10)
    .child(p.kind === "track"
      ? header(b, p, t)
      : div().flex_none().py(8).text_size(12.5).text_color(t.dim)
        .child(p.kind === "idle" ? "Nothing playing. Start something from a list below, or press d to pick a device." : restingText(p)))
    .child(div().h(1).flex_none().bg(t.border))
    .child(tabs(b, t))
    .when(b.tab === "search", (el) => el.child(textInput(t, b.searchInput, b.typing)))
    .when(b.tab === "playlists" && Boolean(b.playlist), (el) => el.child(
      h_flex().flex_none().px(10).gap(6).text_size(12).text_color(t.dim)
        .child("Playlists ›").child(div().text_color(t.foreground).truncate().child(b.playlist?.name ?? ""))))
    .child(listArea(b, t))
    .when(Boolean(notice), (el) => el.child(div().flex_none().text_size(11.5).text_color(notice?.bad ? t.ansi1 : t.ansi2).child(notice?.text ?? "")))
    // A line above the key hints, so they do not read as more list rows.
    .child(div().h(1).flex_none().bg(t.border))
    .child(v_flex().flex_none().gap(4)
      .child(hintLine(t, b.typing ? [["enter", "search"], ["esc", "back to the list"]] : LIST_HINTS[b.tab]))
      .child(hintLine(t, PLAYBACK_HINTS)));
}
