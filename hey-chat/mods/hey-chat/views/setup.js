import { div } from 'gpui-kit';
import { h_flex, v_flex } from 'gpui-base';
import { window } from 'herdr';

function button(t, id, text, click) {
  return h_flex().id(id).flex_none().h(34).px(14).items_center().rounded(10).bg(t.raised).text_size(13).text_color(t.foreground).cursor_pointer()
    .hover(s => s.bg(t.hover)).on_click((_e, cx) => { click(cx); cx.notify(); }).child(text);
}

/** First-run setup, also available from profile settings. @param {any} v @param {any} t */
export function setupView(v, t) {
  const state = v.setupState;
  const agent = v.setupAgent ?? 'codex';
  const name = agent === 'codex' ? 'Codex' : 'Claude Code';
  const info = state?.agents?.[agent];
  const windows = window().platform === 'windows';
  const install = agent === 'codex' ? `${windows ? 'npm.cmd' : 'npm'} install -g @openai/codex`
    : windows ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash';
  const login = agent === 'codex' ? 'codex login' : 'claude auth login';
  const guide = agent === 'codex' ? 'https://learn.chatgpt.com/docs/codex/cli' : 'https://code.claude.com/docs/en/setup';
  const ready = Boolean(state?.node && info?.installed && info.auth === 'ready');
  const copy = (text, id) => button(t, id, v.setupCopied === id ? 'Copied' : 'Copy command', cx => { cx.write_to_clipboard(text); v.setupCopied = id; });
  const step = (title, text) => v_flex().flex_none().gap(8).p(16).rounded(12).bg(t.raised)
    .child(div().text_size(15).font_semibold().child(title))
    .child(div().text_size(13).text_color(t.muted).child(text));
  const content = v_flex().id('setup-screen').w_full().max_w(680).flex_none().p(24).gap(16).overflow_y_scrollbar().rounded(14).bg(t.background).text_color(t.foreground)
    .child(div().text_size(22).font_semibold().child('Set up Hey, chat'))
    .child(div().text_size(14).text_color(t.muted).child('Use Codex or Claude Code with your own account. You only need one.'))
    .child(h_flex().gap(8).children(['codex', 'claude'].map(a => button(t, `setup-${a}`, `${agent === a ? '✓ ' : ''}${a === 'codex' ? 'Codex' : 'Claude Code'}`, () => { v.setupAgent = a; v.setupCopied = null; }))))
    .when(v.setupChecking || !state, el => el.child(div().text_size(13).text_color(t.muted).child('Checking this computer…')))
    .when(Boolean(state && !state.node), el => el.child(step('Install Node.js', 'Download the LTS installer, keep its defaults, then quit and reopen Herdr. Already installed? Herdr may need reopening to find it.')
      .child(button(t, 'setup-node', 'Download Node.js', cx => cx.open_url('https://nodejs.org/en/download')))))
    .when(Boolean(state?.node && !info?.installed), el => el.child(step(`Install ${name}`, `Open ${windows ? 'PowerShell' : 'Terminal'}, paste this command, and press Enter. Then quit and reopen Herdr.`)
      .child(div().text_size(13).child(install)).child(h_flex().gap(8).child(copy(install, 'setup-copy-install'))
        .child(button(t, 'setup-install-guide', 'Official install guide', cx => cx.open_url(guide))))))
    .when(Boolean(state?.node && info?.installed && info.auth !== 'ready'), el => el.child(step(info.auth === 'unknown' ? 'Check your sign-in' : `Sign in to ${name}`, `Open ${windows ? 'PowerShell' : 'Terminal'}, run this command, and finish signing in in your browser. Return here and click Check again.`)
      .child(div().text_size(13).child(login)).child(copy(login, 'setup-copy-login'))
      .when(info.auth === 'unknown', row => row.child(div().text_size(12).text_color(t.dim).child('The installed version could not report sign-in status. You can continue if you have already signed in.')))))
    .when(ready, el => el.child(step('You’re ready', `${name} and Node.js are installed, and you’re signed in. Your account’s usage limits and billing apply.`)))
    .child(h_flex().gap(8)
      .child(button(t, 'setup-recheck', v.setupChecking ? 'Checking…' : 'Check again', cx => v.refreshSetup(cx)))
      .when(Boolean(state?.node && info?.installed && info.auth !== 'login'), el => el.child(button(t, 'setup-continue', ready ? 'Start chatting' : 'Continue', () => {
        const chat = v.chat(v.chatId);
        if (!chat.session && !chat.thread.length) chat.agent = agent;
        v.setupOpen = false; v.focusInput();
      })))
      .child(button(t, 'setup-later', 'Back to chat', () => { v.setupOpen = false; v.focusInput(); })))
    .child(div().text_size(12).text_color(t.dim).child('Existing chats and sign-ins stay on this computer. Setup does not send a test message.'));
  return h_flex().size_full().justify_center().overflow_y_scrollbar().child(content);
}
