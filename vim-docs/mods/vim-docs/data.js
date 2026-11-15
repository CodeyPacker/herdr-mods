// The Vim commands the panel lists, by category. No imports, so plain node can load this file.
//
// Each entry: `desc` on the left, `keys` on the right, an optional `note` shown under the
// selected row. Keys use Vim's own spelling: <C-r> is ctrl-r, <leader> is your leader key.

/** @typedef {{ cat: string, desc: string, keys: string, note?: string }} Doc */

/** The categories, in the order the list shows them. */
export const CATEGORIES = [
  "Movement",
  "Jumps and marks",
  "Insert",
  "Edit",
  "Text objects",
  "Visual",
  "Search and replace",
  "Undo and repeat",
  "Registers and macros",
  "Windows",
  "Buffers and tabs",
  "Files",
  "Folds",
];

/** @type {[string, string, string, string?][]} category, description, keys, note */
const ROWS = [
  ["Movement", "Left, down, up, right", "h j k l", "Put a count first to move further: 5j moves down 5 lines."],
  ["Movement", "Next word start", "w", "W does the same but only counts spaces as word breaks, so foo.bar is one word."],
  ["Movement", "Previous word start", "b", "B treats only spaces as word breaks."],
  ["Movement", "Next word end", "e", "E treats only spaces as word breaks."],
  ["Movement", "Previous word end", "ge"],
  ["Movement", "Line start", "0"],
  ["Movement", "First non-blank character", "^"],
  ["Movement", "Line end", "$"],
  ["Movement", "Jump to a character on the line", "f{char}", "F{char} searches backward. ; repeats the jump, , repeats it the other way."],
  ["Movement", "Stop just before a character", "t{char}", "T{char} searches backward. Handy with operators: dt) deletes up to the )."],
  ["Movement", "Repeat the last f or t", ";", ", repeats it in the other direction."],
  ["Movement", "First line of the file", "gg"],
  ["Movement", "Last line of the file", "G"],
  ["Movement", "Go to line n", "{n}G", "Typing :{n} and enter does the same."],
  ["Movement", "Matching bracket", "%", "Works on (), [] and {}."],
  ["Movement", "Next or previous paragraph", "} {"],
  ["Movement", "Next or previous sentence", ") ("],
  ["Movement", "Top, middle, bottom of the screen", "H M L"],
  ["Movement", "Half a page down or up", "<C-d> <C-u>"],
  ["Movement", "A full page down or up", "<C-f> <C-b>"],
  ["Movement", "Scroll one line, cursor stays", "<C-e> <C-y>"],
  ["Movement", "Put this line at the center", "zz", "zt puts it at the top, zb at the bottom."],

  ["Jumps and marks", "Back to the previous jump", "<C-o>", "A jump is any big move: search, G, %, a mark."],
  ["Jumps and marks", "Forward to the next jump", "<C-i>"],
  ["Jumps and marks", "Set a mark", "m{a-z}", "Lowercase marks are per file. Uppercase marks (mA) work across files."],
  ["Jumps and marks", "Go to a mark's line", "'{a-z}", "'a goes to the line of mark a."],
  ["Jumps and marks", "Go to a mark's exact spot", "`{a-z}", "`a goes to the line and column of mark a."],
  ["Jumps and marks", "Where the last change was", "`.", "g; and g, step back and forward through older changes."],
  ["Jumps and marks", "Where you last left insert mode", "`^", "gi goes there and starts insert mode again."],
  ["Jumps and marks", "Back to before the last jump", "``"],
  ["Jumps and marks", "Go to the definition", "gd", "Local definition. Plugins and LSP usually map gd to the real definition."],
  ["Jumps and marks", "Open the file under the cursor", "gf"],

  ["Insert", "Insert before the cursor", "i"],
  ["Insert", "Insert at the line start", "I", "Starts at the first non-blank character."],
  ["Insert", "Append after the cursor", "a"],
  ["Insert", "Append at the line end", "A"],
  ["Insert", "New line below", "o"],
  ["Insert", "New line above", "O"],
  ["Insert", "Leave insert mode", "<Esc>", "<C-[> does the same and is easier to reach."],
  ["Insert", "Delete the word before the cursor", "<C-w>", "In insert mode."],
  ["Insert", "Delete to the line start", "<C-u>", "In insert mode."],
  ["Insert", "Run one normal command", "<C-o>", "In insert mode: <C-o>zz centers the screen and you keep typing."],
  ["Insert", "Paste a register", "<C-r>{reg}", "In insert mode. <C-r>\" pastes what you last yanked or deleted."],
  ["Insert", "Complete a word from the file", "<C-n> <C-p>", "In insert mode. Next and previous match."],
  ["Insert", "Indent or unindent the line", "<C-t> <C-d>", "In insert mode."],

  ["Edit", "Delete a character", "x", "X deletes the one before the cursor."],
  ["Edit", "Replace one character", "r{char}", "rx replaces the character under the cursor with x."],
  ["Edit", "Replace mode", "R", "Each character you type overwrites one."],
  ["Edit", "Delete (operator)", "d{motion}", "dw deletes a word, d$ to the line end, dj this line and the next."],
  ["Edit", "Delete the line", "dd"],
  ["Edit", "Delete to the line end", "D"],
  ["Edit", "Change (operator)", "c{motion}", "Deletes, then starts insert mode. cw changes to the word end."],
  ["Edit", "Change the line", "cc", "S does the same."],
  ["Edit", "Change to the line end", "C"],
  ["Edit", "Delete a character and insert", "s"],
  ["Edit", "Yank (copy) (operator)", "y{motion}", "yw yanks a word, y$ to the line end."],
  ["Edit", "Yank the line", "yy", "Y does the same."],
  ["Edit", "Paste after or before", "p P", "A yanked line pastes below or above the current line."],
  ["Edit", "Join with the next line", "J", "gJ joins without adding a space."],
  ["Edit", "Indent or unindent", ">> <<", "> and < are operators too: >ip indents the paragraph."],
  ["Edit", "Auto-indent (operator)", "={motion}", "gg=G re-indents the whole file."],
  ["Edit", "Toggle case", "~", "g~{motion} toggles a range."],
  ["Edit", "Lowercase or uppercase (operator)", "gu{motion} gU{motion}", "gUiw uppercases the word."],
  ["Edit", "Add to or subtract from a number", "<C-a> <C-x>", "5<C-a> adds 5 to the number under or after the cursor."],
  ["Edit", "Swap two characters", "xp"],
  ["Edit", "Swap two lines", "ddp"],

  ["Text objects", "Inner word or a word", "iw aw", "a word includes the space after it. Use after an operator: diw, ciw, yaw."],
  ["Text objects", "Inside or around quotes", "i\" a\"", "Also i' and i`. ci\" changes the text in the quotes, even from before them on the line."],
  ["Text objects", "Inside or around parentheses", "i( a(", "ib and ab do the same."],
  ["Text objects", "Inside or around braces", "i{ a{", "iB and aB do the same."],
  ["Text objects", "Inside or around brackets", "i[ a["],
  ["Text objects", "Inside or around angle brackets", "i< a<"],
  ["Text objects", "Inside or around a tag", "it at", "For HTML and XML: cit changes the tag's content."],
  ["Text objects", "Inner sentence or a sentence", "is as"],
  ["Text objects", "Inner paragraph or a paragraph", "ip ap", "dap deletes the paragraph and the blank line after it."],

  ["Visual", "Select characters", "v"],
  ["Visual", "Select lines", "V"],
  ["Visual", "Select a block (columns)", "<C-v>", "Then I or A types on every selected line."],
  ["Visual", "Select the last selection again", "gv"],
  ["Visual", "Jump to the other end", "o", "In visual mode. Grows the selection from the other side."],
  ["Visual", "Act on the selection", "d c y > < ~", "Any operator works on a selection."],
  ["Visual", "Select a text object", "v{object}", "vi( selects inside parentheses. Repeat the object to grow it."],

  ["Search and replace", "Search forward", "/{text}", "/foo then enter finds foo. ?{text} searches backward."],
  ["Search and replace", "Next or previous match", "n N"],
  ["Search and replace", "Search the word under the cursor", "*", "# searches backward."],
  ["Search and replace", "Clear the search highlight", ":noh"],
  ["Search and replace", "Replace on this line", ":s/old/new/g"],
  ["Search and replace", "Replace in the whole file", ":%s/old/new/g", "Add c at the end (/gc) to confirm each one."],
  ["Search and replace", "Replace in the selection", ":'<,'>s/old/new/g", "Press : in visual mode and Vim fills in '<,'>."],
  ["Search and replace", "Run a command on matching lines", ":g/pattern/cmd", ":g/TODO/d deletes every line with TODO. :v does the opposite."],

  ["Undo and repeat", "Undo", "u"],
  ["Undo and repeat", "Redo", "<C-r>"],
  ["Undo and repeat", "Undo every change on the line", "U"],
  ["Undo and repeat", "Repeat the last change", ".", "The most useful key in Vim: make a change once, then . on each spot."],
  ["Undo and repeat", "Repeat the last : command", "@:", "@@ repeats it again."],
  ["Undo and repeat", "Repeat the last :s on this line", "&", "g& repeats it on every line."],

  ["Registers and macros", "Record a macro", "q{a-z}", "qa records into register a. Press q again to stop."],
  ["Registers and macros", "Play a macro", "@{a-z}", "@@ plays the last one again. 10@a plays it 10 times."],
  ["Registers and macros", "Use a register", "\"{reg}", "Before a yank, delete or paste: \"ayy yanks into a, \"ap pastes it."],
  ["Registers and macros", "System clipboard", "\"+y \"+p", "Needs a Vim built with clipboard support."],
  ["Registers and macros", "The last yank", "\"0", "Deletes don't overwrite it, so \"0p pastes what you yanked before deleting."],
  ["Registers and macros", "Black hole register", "\"_", "\"_dd deletes without touching your registers."],
  ["Registers and macros", "List the registers", ":reg"],

  ["Windows", "Split horizontally", "<C-w>s", ":sp file opens a file in the split."],
  ["Windows", "Split vertically", "<C-w>v", ":vs file opens a file in the split."],
  ["Windows", "Move between windows", "<C-w>h j k l"],
  ["Windows", "Close the window", "<C-w>q", "<C-w>o closes every other window."],
  ["Windows", "Make windows equal size", "<C-w>="],
  ["Windows", "Taller or shorter", "<C-w>+ <C-w>-"],
  ["Windows", "Wider or narrower", "<C-w>> <C-w><"],
  ["Windows", "Swap with the next window", "<C-w>x"],

  ["Buffers and tabs", "List the buffers", ":ls"],
  ["Buffers and tabs", "Next or previous buffer", ":bn :bp"],
  ["Buffers and tabs", "Go to buffer n", ":b{n}", ":b part-of-name works too, with tab completion."],
  ["Buffers and tabs", "Switch to the last buffer", "<C-^>"],
  ["Buffers and tabs", "Close the buffer", ":bd"],
  ["Buffers and tabs", "New tab", ":tabnew", ":tabe file opens a file in it."],
  ["Buffers and tabs", "Next or previous tab", "gt gT"],

  ["Files", "Save", ":w"],
  ["Files", "Quit", ":q", ":q! quits without saving."],
  ["Files", "Save and quit", ":wq", "ZZ does the same. ZQ quits without saving."],
  ["Files", "Save every file", ":wa"],
  ["Files", "Open a file", ":e {file}", ":e! reloads the file and drops your changes."],
  ["Files", "Browse the folder", ":Ex", "Vim's built-in file browser, netrw."],

  ["Folds", "Toggle a fold", "za"],
  ["Folds", "Open or close a fold", "zo zc"],
  ["Folds", "Open or close every fold", "zR zM"],
  ["Folds", "Fold a range (operator)", "zf{motion}", "Needs foldmethod=manual. zfip folds the paragraph."],
];

/** Every entry, with a stable `id` for favorites. @type {(Doc & { id: string })[]} */
export const DOCS = ROWS.map(([cat, desc, keys, note]) => ({ id: `${cat}|${keys}|${desc}`, cat, desc, keys, ...(note ? { note } : {}) }));

/**
 * The entries whose description, keys, category or note hold every word of `text`, ignoring
 * case. Best first: an exact key ("u" finds Undo before U), then keys that contain the text,
 * then descriptions, then the rest. Ties keep list order.
 * @param {(Doc & { id: string })[]} docs @param {string} text
 */
export function search(docs, text) {
  const q = String(text ?? "").trim();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return docs;
  const lq = words.join(" ");
  /** @param {Doc} d */
  const rank = (d) => {
    const keys = d.keys.split(" ");
    if (keys.includes(q)) return 0;
    if (keys.some((k) => k.toLowerCase() === lq)) return 1;
    if (d.keys.toLowerCase().includes(lq)) return 2;
    if (words.every((w) => d.desc.toLowerCase().includes(w))) return 3;
    return 4;
  };
  return docs
    .filter((d) => {
      const hay = `${d.desc} ${d.keys} ${d.cat} ${d.note ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .map((d, i) => ({ d, i, r: rank(d) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.d);
}

/** Vim's names for special keys, as a keycap reads them. */
const SPECIAL = { Esc: "esc", CR: "enter", Tab: "tab", BS: "bksp", Space: "space", leader: "leader" };

/**
 * One piece of a key sequence: a key to press ("key"), a fill-in such as {motion} ("hole"), or
 * an Ex command typed as text, such as :wq ("cmd").
 * @typedef {{ kind: "key" | "hole" | "cmd", text: string }} KeyPart
 */

/**
 * Splits `keys` into groups (alternatives, separated by spaces), each a list of parts.
 * "<C-w>h" gives ctrl, w, h. "d{motion}" gives d and the hole {motion}. ":wq" stays one command.
 * @param {string} keys @returns {KeyPart[][]}
 */
export function keyParts(keys) {
  return keys.split(" ").filter(Boolean).map((group) => {
    // An Ex command, or a search typed on the command line: one piece of text.
    if (/^[:/?]./.test(group)) return [{ kind: "cmd", text: group }];
    /** @type {KeyPart[]} */
    const parts = [];
    let i = 0;
    while (i < group.length) {
      const rest = group.slice(i);
      const special = /^<([^<>]+)>/.exec(rest);
      const hole = /^\{[^{}]+\}/.exec(rest);
      if (special) {
        const [, name] = special;
        const ctrl = /^C-(.+)$/.exec(name);
        if (ctrl) parts.push({ kind: "key", text: "ctrl" }, { kind: "key", text: ctrl[1] });
        else parts.push({ kind: "key", text: SPECIAL[/** @type {keyof typeof SPECIAL} */ (name)] ?? name.toLowerCase() });
        i += special[0].length;
      } else if (hole) {
        parts.push({ kind: "hole", text: hole[0] });
        i += hole[0].length;
      } else {
        parts.push({ kind: "key", text: group[i] });
        i += 1;
      }
    }
    return parts;
  });
}
