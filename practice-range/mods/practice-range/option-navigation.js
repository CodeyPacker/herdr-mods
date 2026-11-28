/** Keyboard selection among the enabled options on the current page. */
export class OptionNavigation {
  constructor() {
    this.page = "";
    this.selected = "";
    /** @type {{id: string, select: (cx: any) => void}[]} */
    this.items = [];
  }
  /** @param {string} page @param {string} [preferred] */
  begin(page, preferred = "") {
    if (page !== this.page) this.selected = preferred;
    this.page = page;
    this.items = [];
  }
  /** @param {string} id @param {(cx: any) => void} select */
  add(id, select) {
    this.items.push({ id, select });
    if (!this.selected) this.selected = id;
    return this.selected === id;
  }
  /** @param {string} key @param {any} cx */
  key(key, cx) {
    if (!["h", "j", "k", "l", "enter"].includes(key) || !this.items.length) return false;
    const index = Math.max(0, this.items.findIndex(item => item.id === this.selected));
    this.selected = this.items[index].id;
    if (key === "enter") this.items[index].select(cx);
    else this.selected = this.items[Math.max(0, Math.min(this.items.length - 1, index + (["j", "l"].includes(key) ? 1 : -1)))].id;
    cx.notify();
    return true;
  }
}
