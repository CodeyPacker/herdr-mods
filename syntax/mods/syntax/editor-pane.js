/**
 * Resolve once, then retain that pane ID across async calls and focus changes.
 * @param {import("herdr").PaneInfo[]} all
 * @param {string | null} known
 * @param {{ pane: string | null, tab: string } | null} focus
 * @param {string | null} explicit
 */
export function findPracticePane(all, known, focus, explicit) {
  const mine = all.filter(pane => pane.mod === "syntax");
  return mine.find(pane => pane.pane === known)
    ?? mine.find(pane => pane.pane === explicit)
    ?? mine.find(pane => pane.pane === focus?.pane)
    ?? (mine.filter(pane => pane.tab === focus?.tab).length === 1 ? mine.find(pane => pane.tab === focus?.tab) : null)
    ?? (mine.length === 1 ? mine[0] : null);
}

/** A Vim string literal: single-quoted, with quotes doubled. @param {string} text */
function vimString(text) { return `'${text.replaceAll("'", "''")}'`; }

/**
 * Ex commands that open a new tab with your answer on the left and the read-only reference on
 * the right in diff mode, then return the cursor to your answer. Closing the tab ends the diff.
 * @param {string} answer @param {string} reference
 */
export function neovimDiffCommands(answer, reference) {
  return [
    `execute 'tabedit ' . fnameescape(${vimString(answer)})`,
    `execute 'rightbelow vertical diffsplit ' . fnameescape(${vimString(reference)})`,
    "setlocal readonly nomodifiable",
    "wincmd p",
  ];
}

/** The same commands as one expression for `nvim --remote-expr`. @param {string} answer @param {string} reference */
export function neovimDiffExpression(answer, reference) {
  return `execute([${neovimDiffCommands(answer, reference).map(vimString).join(", ")}])`;
}
