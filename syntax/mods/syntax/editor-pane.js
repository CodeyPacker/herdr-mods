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
