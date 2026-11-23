import { div, image, svg } from 'gpui-kit';
import { h_flex, v_flex, TextView } from 'gpui-base';
import { roundButton } from './tree.js';

export const OUTPUTS_WIDTH = 400;
const ICONS = 'mods/hey-chat/icons';

function button(t, id, label, action) {
  return h_flex().id(id).flex_none().h(30).px(10).items_center().rounded(8).bg(t.raised).text_size(12).text_color(t.foreground).cursor_pointer()
    .hover(s => s.bg(t.hover)).on_click((_e, cx) => { action(cx); cx.notify(); }).child(label);
}

export function outputSummary(v, t, chat) {
  const outputs = chat.outputs ?? [];
  if (!outputs.length || v.outputsOpen) return div();
  return h_flex().id('view-outputs').flex_none().mx(20).mt(8).px(12).py(10).gap(8).items_center().rounded(10).bg(t.raised).border_1().border_color(t.border).cursor_pointer()
    .on_click((_e, cx) => { v.toggleOutputs(cx); cx.notify(); })
    .child(svg(`${ICONS}/file.svg`).size(16).text_color(t.accent))
    .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(outputs.length === 1 ? outputs[0].label : `${outputs.length} files & links`))
    .child(div().text_size(12).text_color(t.accent).child('View outputs'));
}

export function outputsView(v, t) {
  const chat = v.chat(v.chatId);
  const outputs = chat.outputs ?? [];
  const selected = outputs.find(o => o.key === chat.outputKey);
  const preview = v.outputPreview?.key === selected?.key && v.outputPreview?.chat === chat.id ? v.outputPreview : null;
  const label = selected?.kind === 'link' ? selected.provider ? 'Claude artifact' : 'Web link'
    : selected?.kind === 'file' ? 'Open in your browser or default app' : 'Latest file contents';
  return v_flex().id('outputs-panel').w(OUTPUTS_WIDTH).max_w('100%').flex_none().h_full().rounded(14).border_1().border_color(t.border).bg(t.background).text_color(t.foreground)
    .child(h_flex().flex_none().px(16).py(12).items_center().gap(8).border_b_1().border_color(t.border)
      .child(div().flex_1().text_size(15).font_semibold().child('Files & previews'))
      .child(div().text_size(12).text_color(t.dim).child(String(outputs.length)))
      .child(roundButton(t, 'close-outputs', `${ICONS}/close.svg`, 28, () => { v.outputsOpen = false; })))
    .child(h_flex().flex_none().px(14).py(10).gap(8)
      .child(button(t, 'attach-output-link', 'Add link from clipboard', cx => v.addOutputLink(cx)))
      .when(Boolean(selected), el => el.child(button(t, 'refresh-output', 'Refresh', cx => v.selectOutput(selected.key, cx)))))
    .when(Boolean(v.outputError), el => el.child(div().flex_none().px(16).pb(10).text_size(12).text_color(t.blocked).child(v.outputError)))
    .when(!outputs.length, el => el.child(div().p(20).text_size(13).text_color(t.muted).child('Files and preview links from this conversation appear here. You can also add an existing artifact link.')))
    .when(Boolean(outputs.length), el => el.child(v_flex().flex_none().max_h(180).overflow_y_scrollbar().px(10).pb(10).gap(4)
      .children(outputs.map(o => h_flex().id(`output-${o.key}`).flex_none().gap(8).p(10).rounded(9).items_center().cursor_pointer()
        .bg(selected?.key === o.key ? t.selected : t.background).hover(s => s.bg(t.hover))
        .on_click((_e, cx) => { v.selectOutput(o.key, cx); cx.notify(); })
        .child(svg(`${ICONS}/file.svg`).flex_none().size(16).text_color(o.provider ? t.accent : t.muted))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(13).font_medium().child(o.label))
          .child(div().truncate().text_size(11).text_color(t.dim).child(o.target)))))))
    .when(Boolean(selected), el => el.child(v_flex().flex_1().min_h(0).border_t_1().border_color(t.border)
      .child(v_flex().flex_none().p(16).gap(8)
        .child(div().text_size(14).font_semibold().child(selected.label))
        .child(div().text_size(12).text_color(t.muted).child(label))
        .child(h_flex().gap(6)
          .child(button(t, 'open-output', selected.kind === 'link' ? selected.provider ? 'Open in Claude' : 'Open in browser' : 'Open file', cx => v.openOutput('open', cx)))
          .child(button(t, 'copy-output', selected.kind === 'link' ? 'Copy link' : 'Copy path', cx => cx.write_to_clipboard(selected.target)))
          .when(selected.kind !== 'link', row => row.child(button(t, 'reveal-output', 'Show folder', cx => v.openOutput('reveal', cx))))))
      .child(v_flex().id('output-preview').flex_1().min_h(0).overflow_y_scrollbar().p(16).bg(t.raised)
        .when(selected.kind === 'link', row => row.child(div().text_size(13).text_color(t.muted).child('Open the web version to view and interact with this output. Private links use your browser’s sign-in.')))
        .when(selected.kind !== 'link' && !preview, row => row.child(div().text_size(13).text_color(t.muted).child('Loading preview…')))
        .when(Boolean(preview?.error), row => row.child(div().text_size(13).text_color(t.blocked).child(preview.error)))
        .when(preview?.kind === 'markdown', row => row.child(TextView.markdown(`output-md-${chat.id}-${selected.key}-${preview.version}`, preview.text).selectable(true)))
        .when(preview?.kind === 'text', row => row.child(div().text_size(12.5).child(preview.text)))
        .when(preview?.kind === 'image' && !preview.error, row => row.child(image(preview.path).w(Math.min(336, preview.w)).h(Math.min(336, preview.w) * preview.h / preview.w)))
        .when(preview?.kind === 'external', row => row.child(div().text_size(13).text_color(t.muted).child(preview.note || 'This file opens in its usual app. HTML opens in your browser.')))
        .when(Boolean(preview?.truncated), row => row.child(div().pt(12).text_size(12).text_color(t.dim).child('Preview shortened. Open the file to see everything.'))))))
    .when(Boolean(outputs.length && !selected), el => el.child(div().p(20).text_size(13).text_color(t.dim).child('Select a file or link to view it.')));
}
