import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { appHome, checking, exec, readTextFile, run, shared, setShared, theme, layout } from "herdr";

// Match the other Islands cards. The layout draws the outer border, which Wallpaper recolors.
export function panelColors() {
  const t = theme(), wallpaper = shared("backgrounds.seeThrough");
  const active = wallpaper?.layout === shared("layout") && Number.isFinite(Number(wallpaper?.opacity));
  const opacity = active ? Math.min(1, Math.max(0, Number(wallpaper.opacity))) : shared("islands.opacity");
  const fill = color => typeof opacity === "number" && opacity < 1 && /^#[0-9a-f]{6}$/i.test(color)
    ? color + Math.round(Math.max(0, opacity) * 255).toString(16).padStart(2, "0") : color;
  return { ...t, chrome: fill(t.chrome), hover: fill(t.hover), selected: fill(t.selected) };
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const found = find(child, id); if (found) return found; }
  return null;
}

function status(t, record) {
  if (record.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
  if (record.status === "blocked" || record.status === "error") return div().size(14).flex_none().rounded(4).bg(t.blocked + "26")
    .text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
  return div().size(7).mx(3).flex_none().rounded(4).bg(t.done ?? t.dim);
}

export default class HeyChatAgents extends View {
  init(_props, cx) {
    this.records = []; this.error = null; this.loading = false; this.loaded = false;
    if (!checking() && cx) this.poll(cx);
  }

  visibleState() {
    return JSON.stringify([this.loaded, this.error, this.records.map(({ id, title, agent, cwd, status }) => ({ id, title, agent, cwd, status }))]);
  }

  poll(cx) {
    if (this.loading) return;
    this.loading = true;
    cx.spawn(async cx => {
      const before = this.visibleState();
      try { await this.refresh(); }
      catch (error) { this.error = String(error.message ?? error); }
      finally {
        this.loading = false; this.loaded = true;
        if (this.visibleState() !== before) cx.notify();
        cx.timer.after(3000, cx => this.poll(cx));
      }
    });
  }

  async refresh() {
    const root = appHome();
    if (!await readTextFile(`${root}/mods/hey-chat/mod.json`)) {
      this.records = []; this.error = "Install Hey, chat to use this panel."; return;
    }
    const result = await exec("node", [`${root}/mods/hey-chat/chat-links.mjs`, "list", "--state", `${root}/data/hey-chat/bridges`], { timeout: 5000 });
    if (result.code !== 0) throw new Error("Couldn't load Hey, chat agents.");
    const records = JSON.parse(result.stdout);
    if (!Array.isArray(records)) throw new Error("Couldn't load Hey, chat agents.");
    const priority = { blocked: 0, error: 1, working: 2, done: 3 };
    this.records = records.filter(r => r.status && r.status !== "idle")
      .sort((a, b) => (priority[a.status] ?? 4) - (priority[b.status] ?? 4) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    this.error = null;
  }

  render(cx) {
    const t = panelColors();
    // Selecting this mod for the layout's Agents block is the opt-in.
    const collapsed = (find(layout(), "sidebar")?.size?.px ?? Infinity) < 100;
    const groups = [
      { title: "Needs you", states: ["blocked", "error"], color: t.blocked },
      { title: "Working", states: ["working"], color: t.dim },
      { title: "Done", states: ["done"], color: t.dim },
    ];
    const row = record => h_flex().id(`hey-chat-agent-${record.id}`).px(8).h(30).flex_none().gap(9).rounded(8).items_center().cursor_pointer()
          .when(collapsed, el => el.w(34).px(3).gap(2))
          .hover(s => s.bg(t.hover))
          .tooltip(`${record.agent} · ${record.title || "Untitled chat"}${record.cwd ? ` · ${record.cwd}` : ""}`)
          .on_click(() => {
            setShared("hey-chat.openRequest", { id: record.id, cwd: record.cwd, nonce: `${Date.now()}-${record.id}` });
            run("mod.open", { name: "hey-chat" });
          })
          .child(svg(`mods/hey-chat/icons/${record.agent === "codex" ? "codex" : "claude"}.svg`).size(collapsed ? 12 : 16).flex_none().text_color(t.foreground))
          .when(!collapsed, el => el.child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(record.title || "Untitled chat")))
          .child(status(t, record));
    return v_flex().size_full().min_h(0).rounded(13).overflow_hidden().bg(t.chrome).text_size(13)
      .when(collapsed, el => el.pt(10))
      .when(!collapsed, el => el.child(h_flex().px(16).h(41).pt(14).pb(5).flex_none().items_center().justify_between()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Agents"))
        .child(div().tooltip("Hey, chat agents").child(svg("mods/islands-hey-chat-agents/chat.svg").size(14).text_color(t.dim)))))
      .when(!collapsed && Boolean(this.error), el => el.child(div().px(12).text_size(12).text_color(t.dim).child(this.error)))
      .when(!collapsed && !this.error && !this.records.length, el => el.child(div().px(12).text_size(12).text_color(t.dim).child(!this.loaded ? "Loading…" : "No active Hey, chat agents. Working chats and requests for attention appear here.")))
      .child(v_flex().id("hey-chat-agent-list").flex_1().min_h(0).px(collapsed ? 0 : 8).when(collapsed, el => el.items_center()).overflow_y_scrollbar().mode("always")
        .children(groups.flatMap(group => {
          const members = this.records.filter(record => group.states.includes(record.status));
          if (!members.length) return [];
          const header = h_flex().px(8).pt(8).h(30).flex_none().gap(6).items_center().text_size(11).font_medium()
            .child(div().text_color(group.color).child(group.title)).child(div().text_color(t.dim).child(String(members.length)));
          return [...(collapsed ? [] : [header]), ...members.map(row)];
        })));
  }
}
