// What the dialog's player part draws: the now-playing header, the tabs, the list and the key hints.
import { div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { TABS } from "../browser.js";
import { slider, textInput, hintLine, spinner, clock, iconPath } from "../ui.js";
import { playbackButtons } from "./card.js";
import { restingText } from "./slot.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../ui.js").Theme} Theme */
/** @typedef {import("../browser.js").Browser} Browser */
/** @typedef {import("../browser.js").Tab} Tab */
/** @typedef {import("../library.js").Row} Row */
/** @typedef {import("../player.js").Track} Track */

const ART_SIZE = 104;
const ROW_H = 38;
/** The width kept for a time or a percent beside a slider. */
const SIDE_W = 40;
const SLIDER_GAP = 12;

/** Each tab's icon and name. @type {Record<Tab, [string, string]>} */
const TAB_LABELS = { queue: ["queue", "Queue"], playlists: ["playlists", "Playlists"], search: ["search", "Search"], devices: ["devices", "Devices"] };

/** @typedef {import("../ui.js").Hint} Hint */

/** The hints that depend on what the list shows. Kept short: all hints share one line. @param {Browser} b @returns {Hint[]} */
function listHints(b) {
  if (b.tab === "search") return [["s", "search"], ["a", "queue it"]];
  if (b.tab === "playlists") return b.playlist ? [["a", "queue it"], ["backspace", "back"]] : [];
  return [];
}

/** The hints that are always there. Playback keys show their button's icon in place of a word. @type {Hint[]} */
const MOVE_HINTS = [["j/k", "move"], ["h/l", "tab"]];
/** @type {Hint[]} */
const PLAYBACK_HINTS = [["space", { icon: "play" }], ["n", { icon: "next" }], ["b", { icon: "previous" }], ["[ ]", "seek"], ["- =", { icon: "volume" }],
  ["z", { icon: "shuffle" }], ["r", { icon: "repeat" }], ["shift-x", "sign out"], ["q", "close"]];

/**
 * A full-width slider with something on each side of it.
 * @param {Browser} b @param {Theme} t @param {any} state the slider's state @param {any} color the fill
 * @param {any} left @param {any} right what sits before and after the line
 */
function sliderRow(b, t, state, color, left, right) {
  // The line takes the dialog's width minus both sides and the gaps beside them.
  const width = Math.max(100, b.dialog.innerWidth() - SIDE_W * 2 - SLIDER_GAP * 2);
  return h_flex().gap(SLIDER_GAP).items_center().text_size(12).text_color(t.muted)
    .child(div().w(SIDE_W).flex_none().flex().items_center().child(left))
    .child(slider(t, state, width, { color, thick: true }))
    .child(div().w(SIDE_W).flex_none().flex().justify_end().child(right));
}

/** The track with its buttons beside the art, then the progress and volume lines. @param {Browser} b @param {Track} p @param {Theme} t */
function header(b, p, t) {
  const now = b.now;
  const picture = now.art.large
    ? image(now.art.large).size(ART_SIZE).rounded(8).flex_none()
    : div().size(ART_SIZE).flex_none().rounded(8).bg(t.raised);
  return v_flex().flex_none().gap(12)
    .child(h_flex().gap(18).items_start()
      .child(picture)
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(div().truncate().text_size(18).font_semibold().text_color(t.foreground).child(p.title))
        .child(div().truncate().text_size(13.5).text_color(t.muted).child(p.album ? `${p.artist} • ${p.album}` : p.artist))
        .child(div().truncate().text_size(11.5).text_color(t.dim).child(p.device ? `Playing on ${p.device}` : ""))
        .child(h_flex().pt(6).child(playbackButtons(now, p, t, { large: true })))))
    .child(sliderRow(b, t, now.seek.state, p.playing ? t.accent : t.dim, clock(p.progressMs), clock(p.durationMs)))
    // No volume line for a device that does not let Spotify set its volume.
    .when(p.volume !== null, (el) => el.child(
      sliderRow(b, t, now.volume.state, t.accent, svg(iconPath("volume")).size(16).text_color(t.muted), `${p.volume}%`)));
}

/** @param {Browser} b @param {Theme} t */
function tabs(b, t) {
  return h_flex().flex_none().gap(6).children(TABS.map((tab) => {
    const [icon, name] = TAB_LABELS[tab];
    const on = tab === b.tab;
    const ink = on ? t.foreground : t.muted;
    return h_flex().id(`sp-tab-${tab}`).h(34).px(14).gap(8).items_center().rounded(8).cursor_pointer()
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => (tab === "search" ? b.startSearch(cx) : b.showTab(tab, cx)))
      .child(svg(iconPath(icon)).size(15).flex_none().text_color(ink))
      .child(div().text_size(13.5).text_color(ink).child(name));
  }));
}

/** One list row's columns. @param {Row} row @param {boolean} playing true for the track that is playing now @param {Theme} t */
function rowCells(row, playing, t) {
  if (row.kind === "track") {
    return [
      // The playing track is marked with small level bars.
      div().w(16).flex_none().flex().items_center().when(playing, (el) => el.child(svg(iconPath("playing")).size(14).text_color(t.accent))),
      div().flex_1().min_w(0).truncate().text_color(playing ? t.accent : t.foreground).child(row.title),
      div().w(260).flex_none().truncate().text_color(t.muted).child(row.artist),
      div().w(SIDE_W).flex_none().flex().justify_end().text_size(12.5).text_color(t.muted).child(clock(row.durationMs)),
    ];
  }
  if (row.kind === "playlist") {
    return [
      div().w(16).flex_none(),
      div().flex_1().min_w(0).truncate().text_color(t.foreground).child(row.name),
      div().w(220).flex_none().truncate().text_color(t.muted).child(row.owner),
      div().w(80).flex_none().flex().justify_end().text_size(12.5).text_color(t.muted).child(row.count === null ? "" : `${row.count} tracks`),
    ];
  }
  return [
    div().w(16).flex_none(),
    div().flex_1().min_w(0).truncate().text_color(t.foreground).child(row.name),
    div().w(180).flex_none().truncate().text_color(t.muted).child(row.type),
    div().w(90).flex_none().flex().justify_end().text_size(12.5).text_color(t.accent).child(row.active ? "playing here" : ""),
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
  const note = (/** @type {any} */ child) => h_flex().px(12).py(10).gap(8).items_center().text_size(13).text_color(t.dim).child(child);
  if (list.error) return v_flex().flex_1().min_h(0).child(note(list.error));
  if (!list.loaded) return v_flex().flex_1().min_h(0).child(list.loading ? note(spinner(t)) : note(emptyText(b)));
  if (list.rows.length === 0) return v_flex().flex_1().min_h(0).child(note(emptyText(b)));
  const playingUri = b.now.track()?.uri;
  const rows = list.rows.map((row, i) =>
    h_flex().id(`sp-row-${b.tab}-${i}`).h(ROW_H).flex_none().px(12).gap(10).items_center().rounded(8).cursor_pointer().text_size(13.5)
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
  return v_flex().id("sp-browser").flex_1().min_h(0).gap(12)
    .child(p.kind === "track"
      ? header(b, p, t)
      : div().flex_none().py(8).text_size(13).text_color(t.dim)
        .child(p.kind === "idle" ? "Nothing playing. Start something from a list below, or press d to pick a device." : restingText(p)))
    .child(div().h(1).flex_none().bg(t.border))
    .child(tabs(b, t))
    .when(b.tab === "search", (el) => el.child(textInput(t, b.searchInput, b.typing)))
    .when(b.tab === "playlists" && Boolean(b.playlist), (el) => el.child(
      h_flex().flex_none().px(12).gap(6).text_size(12.5).text_color(t.dim)
        .child("Playlists ›").child(div().text_color(t.foreground).truncate().child(b.playlist?.name ?? ""))))
    .child(listArea(b, t))
    .when(Boolean(notice), (el) => el.child(div().flex_none().text_size(11.5).text_color(notice?.bad ? t.ansi1 : t.ansi2).child(notice?.text ?? "")))
    // A line above the key hints, so they do not read as more list rows.
    .child(div().h(1).flex_none().bg(t.border))
    .child(hintLine(t, b.typing ? [["enter", "search"], ["esc", "back to the list"]] : [...MOVE_HINTS, ...listHints(b), ...PLAYBACK_HINTS]));
}
