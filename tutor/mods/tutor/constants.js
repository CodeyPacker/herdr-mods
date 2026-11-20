// Fixed tables Tutor reads from. No state lives here. Plain JavaScript with no Herdr imports.

// What the learner already knows. Lessons, quizzes and chat compare to it.
export const KNOWN = "JavaScript and TypeScript";
export const COMPARE = "TypeScript";
// Read-only tools for every claude call. It can read the codebase but never change it.
export const TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Bash(git show:*)", "Bash(git log:*)", "Bash(git ls-files:*)", "Bash(git grep:*)"];
// How many times a written outline, module or exercise set goes back to Claude to fix its problems.
export const FIX_ROUNDS = 2;
// Panes at least this wide put the code beside the explanation.
export const SPLIT_WIDTH = 1100;
// A quiz passes at this share of right answers.
export const PASS_SHARE = 0.8;
// Letters the home list never hands out: j and k move, y confirms. The keys the home screen's
// shortcuts are on (reset, practice, new course, Practice Range) are left out too: see setLetters.
export const RESERVED = "jky";
// The canned questions behind the d and t keys.
export const DEEPER = "Go deeper on this code: what else here matters?";
export const LIKE_KNOWN = `Show the closest ${COMPARE} version of this code and name what differs.`;
