import { TextView } from "gpui-base";
import { readableOn } from "./message-colors.js";

/** Inline code must contrast with the bubble's text, including custom message colors. */
export function messageMarkdown(id, text, foreground) {
  const view = TextView.markdown(id, text).text_color(foreground).selectable(true);
  const background = readableOn(String(foreground)) === "#ffffff" ? "#e8e8ec" : "#303038";
  // Skip fenced blocks, which have their own syntax colors. Match equal backtick runs.
  const tokens = /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[ \t]*(?=\n|$)|$(?![\s\S])))|(`+)([^`][\s\S]*?)\3(?!`)/gm;
  for (const match of text.matchAll(tokens)) {
    if (match[3]) view.highlight_range(match.index + match[3].length, match.index + match[0].length - match[3].length, background);
  }
  return view;
}
