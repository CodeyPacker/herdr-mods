/**
 * Resolve once, then retain that pane ID across async calls and focus changes.
 * @param {import("herdr").PaneInfo[]} all
 * @param {string | null} known
 * @param {{ pane: string | null, tab: string } | null} focus
 * @param {string | null} explicit
 */
export function findPracticePane(all, known, focus, explicit) {
  const mine = all.filter(pane => pane.mod === "practice-range");
  return mine.find(pane => pane.pane === known)
    ?? mine.find(pane => pane.pane === explicit)
    ?? mine.find(pane => pane.pane === focus?.pane)
    ?? (mine.filter(pane => pane.tab === focus?.tab).length === 1 ? mine.find(pane => pane.tab === focus?.tab) : null)
    ?? (mine.length === 1 ? mine[0] : null);
}

/** A Vim string literal: single-quoted, with quotes doubled. @param {string} text */
function vimString(text) { return `'${text.replaceAll("'", "''")}'`; }

/** Tabs opened for a comparison carry this tab-local variable, so the panel can close them. */
const diffMarker = "practice_range_diff";

/**
 * Ex commands that open a new tab with your answer on the left and the read-only reference on
 * the right in diff mode, then return the cursor to your answer. Closing the tab ends the diff.
 * @param {string} answer @param {string} reference
 */
export function neovimDiffCommands(answer, reference) {
  return [
    `execute 'tabedit ' . fnameescape(${vimString(answer)})`,
    `let t:${diffMarker} = 1`,
    `execute 'rightbelow vertical diffsplit ' . fnameescape(${vimString(reference)})`,
    "setlocal readonly nomodifiable",
    "wincmd p",
  ];
}

/**
 * An expression that closes every comparison tab, last first so tab numbers stay valid. Your
 * buffers stay loaded, so nothing unsaved is lost.
 */
export function neovimCloseDiffsExpression() {
  return `execute(map(reverse(filter(range(1, tabpagenr('$')), {_, tab -> gettabvar(tab, '${diffMarker}', 0)})), {_, tab -> 'silent! tabclose ' . tab}))`;
}

/** Close earlier comparisons, then open this one, for `nvim --remote-expr`. @param {string} answer @param {string} reference */
export function neovimDiffExpression(answer, reference) {
  return `${neovimCloseDiffsExpression()} . execute([${neovimDiffCommands(answer, reference).map(vimString).join(", ")}])`;
}
