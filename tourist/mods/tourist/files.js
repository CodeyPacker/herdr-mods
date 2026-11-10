// The PR's file list beside the tour: the tour's files first, in stop order, then the
// rest of the code it changed, then tests, docs and generated files.

const TEST = /(^|\/)(tests?|__tests__|specs?|e2e)\/|\.(test|spec)\.[^/]+$|Tests?\.cs$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$/i;
const DOCS = /\.(md|mdx|rst|txt|adoc)$|(^|\/)docs?\//i;
const GENERATED = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock|go\.sum|packages\.lock\.json)$|\.lock$|\.min\.(js|css)$|\.snap$|\.(g|designer)\.cs$|(^|\/)(dist|build|generated|__generated__|vendor)\//i;

/** True for tests, docs and generated files: the third group. */
export function isSideFile(path) { return TEST.test(path) || DOCS.test(path) || GENERATED.test(path); }

/**
 * `{ tour, also, side }`. Each entry is a file stat (`{ file, status, add, del }`). Tour entries
 * add `stop`, the index of the first stop on that file. A file the tour visits stays in the
 * tour group even when it's a test or a doc.
 */
export function groupFiles(stats, stops) {
  const first = new Map();
  stops.forEach((s, i) => { if (!first.has(s.file)) first.set(s.file, i); });
  const tour = [], also = [], side = [];
  for (const f of stats) {
    if (first.has(f.file)) tour.push({ ...f, stop: first.get(f.file) });
    else (isSideFile(f.file) ? side : also).push(f);
  }
  tour.sort((a, b) => a.stop - b.stop);
  return { tour, also, side };
}
