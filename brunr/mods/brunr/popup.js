// Popups over the panel: the Environment pickers and a row's menu. Each hands its choice to the
// panel copy through store.ask, in memory, and closes.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { closeOverlay, props, theme } from "herdr";
import * as store from "./store.js";

const ITEM = 28;
const SEP = 9;

export const menuHeight = (items) => 12 + items.reduce((n, i) => n + (i.sep ? SEP : ITEM), 0);
export const pickerHeight = (options) => 52 + options.reduce((n, o) => n + (o.warn ? 44 : ITEM), 0);

const usable = (i) => i && !i.sep && !i.disabled;

export function init(self) {
  const p = props();
  self.menu = p.menu ?? null;
  self.picker = p.picker ?? null;
  const list = self.menu ? self.menu.items : self.picker.options;
  const current = self.picker ? list.findIndex((o) => o.value === (self.picker.current ?? null)) : -1;
  self.at = current >= 0 ? current : Math.max(0, list.findIndex(usable));
  self.handle.focus();
}

const close = () => closeOverlay(props().overlay);

function choose(self, cx, i) {
  if (self.picker) {
    const o = self.picker.options[i];
    if (!o) return;
    store.ask({ kind: self.picker.kind, key: self.picker.key, value: o.value ?? null });
    return close();
  }
  const item = self.menu.items[i];
  if (!usable(item)) return;
  if (item.copy != null) cx.write_to_clipboard(item.copy);
  else store.ask({ kind: "act", key: self.menu.key, action: item.action });
  close();
}

function step(self, by) {
  const list = self.menu ? self.menu.items : self.picker.options;
  let i = self.at;
  for (let n = 0; n < list.length; n++) {
    i = (i + by + list.length) % list.length;
    if (self.picker || usable(list[i])) break;
  }
  self.at = i;
}

export function render(self) {
  const t = theme();
  const root = v_flex().id("brunr-popup").track_focus(self.handle).size_full().p(5).bg(t.popover).text_color(t.foreground).text_size(12.5)
    .on_key_down((e, cx) => {
      if (e.key === "escape") close();
      else if (e.key === "down") step(self, 1);
      else if (e.key === "up") step(self, -1);
      else if (e.key === "enter") choose(self, cx, self.at);
      else return;
      cx.stop_propagation();
      cx.notify();
    });
  if (self.picker) {
    const p = self.picker;
    root.child(h_flex().h(34).px(8).items_center().border_b(1).border_color(t.border).mb(4)
      .child(div().flex_1().min_w(0).truncate().font_semibold().child(p.title)).child(div().text_size(10.5).text_color(t.dim).child("Esc")));
    return root.children(p.options.map((o, i) => {
      const on = (o.value ?? null) === (p.current ?? null);
      return v_flex().id(`opt-${i}`).w_full().flex_none().px(8).py(5).gap(2).rounded(5).cursor_pointer()
        .when(i === self.at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.selected))
        .on_click((_e, cx) => choose(self, cx, i))
        .child(h_flex().h(18).gap(8).items_center()
          .child(div().w(12).flex_none().text_color(t.accent).child(on ? "✓" : ""))
          .child(div().flex_1().min_w(0).truncate().text_color(o.value == null ? t.muted : t.foreground).child(o.label))
          .when(Boolean(o.warn), (el) => el.child(svg("mods/brunr/icons/warning.svg").size(12).flex_none().text_color(t.ansi3))))
        .when(Boolean(o.warn), (el) => el.child(div().pl(20).text_size(10.5).text_color(t.ansi3).child(o.warn)));
    }));
  }
  return root.children(self.menu.items.map((item, i) => {
    if (item.sep) return div().w_full().h(1).my(4).bg(t.border);
    return h_flex().id(`menu-${i}`).w_full().h(ITEM).flex_none().px(8).gap(8).items_center().rounded(5)
      .text_color(item.disabled ? t.dim : t.foreground)
      .when(!item.disabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.selected)).on_click((_e, cx) => choose(self, cx, i)))
      .when(i === self.at && !item.disabled, (el) => el.bg(t.selected))
      .child(div().flex_1().min_w(0).truncate().child(item.label))
      .when(Boolean(item.hint), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(item.hint)));
  }));
}
