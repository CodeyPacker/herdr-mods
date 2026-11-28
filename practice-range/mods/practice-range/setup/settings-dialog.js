import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { keyButton, chip } from "../kit/controls.js";
import { banner } from "../kit/pane.js";
import { languagePanel, packAction } from "../language-panel.js";
import { findLanguage, languages } from "../languages/index.js";

/** @param {import("../main.js").default} host @param {import("../kit/theme.js").Theme} t */
export function settingsDialog(host, t) {
  const tabs = [
    ["general", "Overview"], ["languages", "Languages"], ["editor", "Editor"],
    ["layout", "Layout"], ["tutor", "AI tutor"], ["courses", "Courses"], ["keyboard", "Keyboard"],
  ];
  const content = v_flex().flex_1().min_h(0);
  if (host.settingsTab === "keyboard") {
    const shortcuts = host.shortcuts;
    if (shortcuts.reveal) { shortcuts.scroll.scroll_to_item(shortcuts.at); shortcuts.reveal = false; }
    const list = v_flex().id("settings-keyboard").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(shortcuts.scroll).p(16).gap(8);
    for (const [index, option] of shortcuts.options.entries()) list.child(chip(t, {
      id: `settings-option-${option.id}`, label: `${option.label}: ${shortcuts.option(option.id) ? "On" : "Off"}`,
      on: shortcuts.option(option.id), click: cx => { shortcuts.flip(index); cx.notify(); },
    }));
    for (const [index, key] of shortcuts.keys.entries()) {
      const at = shortcuts.options.length + index;
      list.child(h_flex().gap(10).items_center().p(8).rounded(8)
        .when(shortcuts.at === at, el => el.bg(t.selected))
        .child(div().flex_1().min_w(0).child(key.what))
        .child(keyButton(t, `settings-binding-${key.id}`, "", shortcuts.capturing === key.id ? "Press a key…" : shortcuts.keyFor(key.id) || "None", !key.fixed,
          cx => { shortcuts.change(at); host.handle.focus(); cx.notify(); }))
        .child(chip(t, { id: `settings-toggle-${key.id}`, label: shortcuts.isOff(key.id) ? "Off" : "On", on: !shortcuts.isOff(key.id),
          click: cx => { shortcuts.flip(at); cx.notify(); } })));
    }
    content.child(list);
  } else if (host.settingsTab === "courses") {
    const body = v_flex().id("settings-courses").flex_1().min_h(0).overflow_y_scrollbar().p(16).gap(12);
    host.courses.settingsView(body, t, true);
    content.child(body);
  } else if (host.settingsTab === "languages") {
    content.child(languagePanel(t, { flow: host.setup, selected: host.selected, busy: Boolean(host.busy), compact: host.layout.compact,
      learn: (id, cx) => { host.closeSettings(cx); host.courses.show(cx, id); },
      act: (id, cx) => { if (packAction(findLanguage(id), host.setup) === "practice") host.closeSettings(cx); host.chooseLanguage(id, cx); },
      select: (id, cx) => { host.selected = languages.indexOf(findLanguage(id)); cx.notify(); },
      rescan: cx => host.setup.scan(cx, { force: true, tutors: false }) }));
  } else content.child(host.setupScreen(t));

  return h_flex().id("settings-backdrop").absolute().inset_0().p(24).items_center().justify_center().bg("#00000066")
    .on_scroll_wheel((_e, cx) => cx.stop_propagation())
    .on_mouse_down("left", (_event, cx) => { host.closeSettings(cx); cx.stop_propagation(); })
    .on_click((_event, cx) => cx.stop_propagation())
    .child(v_flex().id("practice-settings-dialog").w(900).max_w("100%").h("85%").max_h(760).min_h(0)
      .rounded(14).border_1().border_color(t.border).bg(t.popover).shadow_lg()
      .on_mouse_down("left", (_event, cx) => cx.stop_propagation())
      .on_click((_event, cx) => cx.stop_propagation())
      .child(h_flex().p(16).gap(12).items_center()
        .child(div().flex_1().text_size(20).font_semibold().child("Settings"))
        .child(keyButton(t, "settings-close", "esc", "Close", true, cx => host.closeSettings(cx))))
      .child(h_flex().px(16).pb(12).gap(6).flex_wrap().children(tabs.map(([id, label]) => chip(t, {
        id: `settings-tab-${id}`, label, on: host.settingsTab === id, click: cx => host.selectSettingsTab(id, cx),
      }))))
      .when(Boolean(host.error || host.courses.error), el => el.child(banner(t, host.error || host.courses.error, t.blocked)))
      .child(content));
}
