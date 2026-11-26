// What setup knows about this computer, and the work it starts: scans and installs. The panel
// (main.js) owns the screens and the saved choices. This owns the slow, background parts.
import { shared, setShared, checking } from "herdr";
import { scanSetup, installLanguage } from "../bridge.js";
import { languages } from "../languages/index.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {"hub" | "editor" | "layout" | "tutor"} SetupPage */

/**
 * The last scan, shared by every copy of the panel. A new dialog or tab shows it at once and
 * scans again in the background, so cards never start empty after the first time.
 */
const CACHE_KEY = "practice-range.scan";

/** @param {unknown} error */
function message(error) { return error instanceof Error ? error.message : String(error); }

export class SetupFlow {
  constructor() {
    /** @type {SetupPage} which page of setup shows */
    this.page = /** @type {SetupPage} */ ("hub");
    const cached = /** @type {any} */ (shared(CACHE_KEY));
    /** @type {import("../types.js").ToolScan | null} */
    this.tools = cached?.tools ?? null;
    /** @type {import("../types.js").TutorScan | null} */
    this.tutors = cached?.tutors ?? null;
    this.scanningTools = false;
    this.scanningTutors = false;
    /** True once this copy has scanned, so moving between screens doesn't scan again. */
    this.scanned = false;
    this.scanError = "";
    /** The pack being installed, or "". One at a time: npm ci in two folders at once is slow for both. */
    this.installing = "";
    /** @type {Record<string, string>} why a pack's last install failed */
    this.installErrors = {};
  }

  /** Remember both scans for the next copy. */
  remember() {
    setShared(CACHE_KEY, { tools: this.tools, tutors: this.tutors });
  }

  /**
   * Scan the computer. Once per copy unless `force`. The tool scan and the AI scan run at the
   * same time and each redraws as it lands.
   * @param {Context} cx @param {{ force?: boolean, tutors?: boolean }} [options] `tutors`: also scan the AI commands
   */
  scan(cx, { force = false, tutors = true } = {}) {
    if (checking() || (this.scanned && !force)) return;
    this.scanned = true;
    this.scanError = "";
    if (!this.scanningTools) {
      this.scanningTools = true;
      cx.spawn(async cx => {
        try { this.tools = await scanSetup("tools"); this.remember(); }
        catch (error) { this.scanError = message(error); }
        finally { this.scanningTools = false; cx.notify(); }
      });
    }
    if (tutors && !this.scanningTutors) {
      this.scanningTutors = true;
      cx.spawn(async cx => {
        try { this.tutors = await scanSetup("tutors"); this.remember(); }
        catch (error) { this.scanError = message(error); }
        finally { this.scanningTutors = false; cx.notify(); }
      });
    }
    cx.notify();
  }

  /**
   * Install a pack's dependencies, then scan the tools again so its card turns ready.
   * @param {string} id @param {Context} cx
   */
  install(id, cx) {
    if (this.installing || checking()) return;
    this.installing = id;
    delete this.installErrors[id];
    cx.notify();
    cx.spawn(async cx => {
      try { await installLanguage(id); }
      catch (error) { this.installErrors[id] = message(error); }
      finally { this.installing = ""; cx.notify(); }
      this.scan(cx, { force: true, tutors: false });
    });
  }

  /** @param {string} id */
  languageReady(id) { return Boolean(this.tools?.languages[id]?.ready); }

  /** Packs whose runtime works, in setup order. */
  readyLanguages() { return languages.filter(pack => this.languageReady(pack.id)); }

  /** @param {"neovim" | "vscode"} editor */
  editorFound(editor) { return Boolean(this.tools?.editors[editor].found); }
}
