// What is playing, kept current, plus the commands that change it. The slot and the dialog
// each own one of these. It asks Spotify on a timer and asks for a redraw only when what
// its owner draws has changed.
import { POLL_MS, IDLE_POLL_EVERY, SETTLE_MS, SEEK_STEPS } from "./constants.js";
import { readPlayback } from "./player.js";
import { artFile } from "./art.js";
import { play, pause, next, previous, seekTo, setVolume, setShuffle, setRepeat, nextRepeat } from "./controls.js";
import { DragSlider } from "./kit/drag-slider.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./player.js").Playback} Playback */
/** @typedef {import("./player.js").Track} Track */
/** @typedef {{ small: string | null, large: string | null }} ArtPaths the album art's paths for image() */

export class NowPlaying {
  constructor() {
    /** @type {Playback} */
    this.playback = { kind: "loading" };
    /** @type {ArtPaths} */
    this.art = { small: null, large: null };
    /** @type {number} when `playback` was read, to estimate the position since */
    this.readAt = 0;
    /** True while a reading is in flight, so slow answers never pile up. */
    this.reading = false;
    /** Timer turns since the last reading. */
    this.turns = 0;
    /** @type {boolean} the owner shows progress, volume and modes now, so changes to those need a redraw too */
    this.detailed = false;
    /** @type {boolean} true once stop() ran */
    this.stopped = false;
    /** @type {string | null} why the last command failed */
    this.message = null;
    /** Readings started before this time may predate the last command, so they're dropped. Infinity while a command is on its way. */
    this.settleAt = 0;
    /** @type {((cx: Context) => void) | null} runs after a slider is let go */
    this.onSliderReleased = null;
    /** @type {((cx: Context) => void) | null} runs when a different track starts */
    this.onTrackChanged = null;
    /** The progress bar, as a position from 0 to SEEK_STEPS. Dragging it jumps in the track. */
    this.seek = new DragSlider(SEEK_STEPS, (position, cx) => {
      this.seekToPosition(position, cx);
      this.onSliderReleased?.(cx);
    });
    /** The volume slider, 0 to 100. */
    this.volume = new DragSlider(100, (percent, cx) => {
      this.setVolume(percent, cx);
      this.onSliderReleased?.(cx);
    });
  }

  /** Starts the timer and takes the first reading. @param {Context} cx */
  start(cx) {
    cx.timer.every(POLL_MS, (cx) => this.onTimer(cx));
    this.read(cx);
  }

  /** Ends the readings. The timer cannot be removed, so its turns do nothing from here on. */
  stop() {
    this.stopped = true;
  }

  /** The shown track, or null. @returns {Track | null} */
  track() {
    return this.playback.kind === "track" ? this.playback : null;
  }

  /** Everything drawn from a reading, as one string, to tell whether a new one changes the picture. @param {Playback} p @param {ArtPaths} art */
  drawnAs(p, art) {
    if (p.kind !== "track") return p.kind;
    const detail = this.detailed ? `|${Math.floor(p.progressMs / 1000)}|${p.shuffle}|${p.repeat}|${p.device}|${p.volume}|${art.large}` : "";
    return `${p.playing}|${p.uri}|${p.title}|${art.small}${detail}`;
  }

  /** Reads on every turn while music plays, on every Nth turn otherwise. @param {Context} cx */
  onTimer(cx) {
    if (this.stopped) return;
    this.turns += 1;
    const t = this.track();
    if (t?.playing || this.turns >= IDLE_POLL_EVERY) this.read(cx);
  }

  /** @param {Context} cx @param {boolean} [settled] true for the reading act() asks for once Spotify has caught up */
  read(cx, settled = false) {
    if (this.reading) return;
    this.reading = true;
    this.turns = 0;
    const startedAt = Date.now();
    cx.spawn(async (cx) => {
      const reading = await readPlayback();
      const art = reading.kind === "track"
        ? { small: await artFile(reading.smallArt), large: await artFile(reading.largeArt) }
        : { small: null, large: null };
      this.reading = false;
      // A reading from before the last command settled would undo what the control just showed.
      if (!settled && startedAt < this.settleAt) return;
      // After an error, keep showing the last track.
      if (reading.kind === "error" && this.playback.kind === "track") return;
      const changed = this.drawnAs(reading, art) !== this.drawnAs(this.playback, this.art);
      const newTrack = reading.kind === "track" && reading.uri !== this.track()?.uri;
      this.playback = reading;
      this.art = art;
      this.readAt = Date.now();
      this.showSliders();
      if (newTrack) this.onTrackChanged?.(cx);
      if (changed) cx.notify();
    });
  }

  /** Moves the sliders to what the shown track reports. A slider being dragged stays put. */
  showSliders() {
    const t = this.track();
    if (!t) return;
    this.seek.show(t.durationMs > 0 ? Math.min(1, t.progressMs / t.durationMs) * SEEK_STEPS : 0);
    if (t.volume !== null) this.volume.show(t.volume);
  }

  /** The position now: the last reading, plus the time since when music is playing. @param {Track} t */
  positionNow(t) {
    return Math.min(t.durationMs, t.progressMs + (t.playing ? Date.now() - this.readAt : 0));
  }

  /**
   * Runs a playback command. `change` updates the shown track first so the control answers at
   * once. A reading shortly after replaces that guess with what Spotify really did.
   * @param {Context} cx
   * @param {() => Promise<string | null>} command
   * @param {(track: Track) => void} [change]
   */
  act(cx, command, change) {
    const t = this.track();
    if (!t) return;
    change?.(t);
    this.showSliders();
    this.message = null;
    this.settleAt = Infinity;
    cx.notify();
    cx.spawn(async (cx) => {
      this.message = await command();
      // Spotify takes a moment to report the new state.
      this.settleAt = Date.now() + SETTLE_MS;
      cx.notify();
      cx.timer.after(SETTLE_MS, (cx) => this.read(cx, true));
    });
  }

  /** @param {Context} cx */
  toggle(cx) {
    const t = this.track();
    if (t) this.act(cx, t.playing ? pause : play, (t) => { t.playing = !t.playing; });
  }

  /** @param {Context} cx */
  next(cx) { this.act(cx, next); }

  /** @param {Context} cx */
  previous(cx) { this.act(cx, previous); }

  /** @param {Context} cx */
  toggleShuffle(cx) {
    const t = this.track();
    if (!t) return;
    // Work out the new state before act() changes the shown track, or the command sends the old one.
    const on = !t.shuffle;
    this.act(cx, () => setShuffle(on), (t) => { t.shuffle = on; });
  }

  /** Moves repeat to its next mode: off, the whole list, the one track. @param {Context} cx */
  cycleRepeat(cx) {
    const t = this.track();
    if (!t) return;
    const mode = nextRepeat(t.repeat);
    this.act(cx, () => setRepeat(mode), (t) => { t.repeat = mode; });
  }

  /** @param {number} ms @param {Context} cx */
  seekToMs(ms, cx) {
    const t = this.track();
    if (!t || t.durationMs <= 0) return;
    const to = Math.max(0, Math.min(t.durationMs, ms));
    this.act(cx, () => seekTo(to), (t) => { t.progressMs = to; this.readAt = Date.now(); });
  }

  /** Jumps to a progress bar position, 0 to SEEK_STEPS. @param {number} position @param {Context} cx */
  seekToPosition(position, cx) {
    const t = this.track();
    if (t) this.seekToMs((position / SEEK_STEPS) * t.durationMs, cx);
  }

  /** Jumps forward (or back, when negative) from where the track is now. @param {number} deltaMs @param {Context} cx */
  seekBy(deltaMs, cx) {
    const t = this.track();
    if (t) this.seekToMs(this.positionNow(t) + deltaMs, cx);
  }

  /** @param {number} percent @param {Context} cx */
  setVolume(percent, cx) {
    const to = Math.max(0, Math.min(100, Math.round(percent)));
    this.act(cx, () => setVolume(to), (t) => { t.volume = to; });
  }

  /** Does nothing on a device that does not let Spotify set its volume. @param {number} delta @param {Context} cx */
  volumeBy(delta, cx) {
    const t = this.track();
    if (t && t.volume !== null) this.setVolume(t.volume + delta, cx);
  }
}
