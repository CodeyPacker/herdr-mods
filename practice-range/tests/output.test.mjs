import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { neovimOutputCommands, outputText } from "../mods/practice-range/output.js";
import { parseLayoutConfig } from "../mods/practice-range/layout-config.js";

test("output includes successful course cases, errors, and inert escape sequences", () => {
  assert.match(outputText({ title: "All cases passed", fixtures: [{ id: "receipt", title: "Correct", details: ["Your code printed:\nCorner Cafe\nLatte: 4.50"] }] }), /Corner Cafe\nLatte: 4.50/);
  assert.equal(outputText({ title: "Compile error", details: ["line 3: missing ;"] }), "Compile error\nline 3: missing ;\n");
  assert.equal(outputText({ title: "\x1b[2Jhello\r\nworld" }), "[2Jhello\nworld\n");
  assert.match(outputText(null), /Save your file/);
  assert.equal(parseLayoutConfig('{"layout":{"output":false}}').output, false);
  assert.throws(() => parseLayoutConfig('{"layout":{"output":"yes"}}'), /layout.output/);
});

test("Neovim output stays below the editor, ignores input, refreshes, and hides", t => {
  const available = spawnSync("nvim", ["--version"], { encoding: "utf8" });
  if (available.error?.code === "ENOENT") return t.skip("Neovim is not installed");
  const text = 'Corner Cafe\nquotes " \' \\ and ]] ]=] 🐈\n';
  const lua = command => ["-c", `lua ${command}`];
  const result = spawnSync("nvim", ["--headless", "-u", "NONE", "-i", "NONE", "-n",
    ...lua("editor = vim.api.nvim_get_current_win(); original = vim.api.nvim_get_current_buf()"),
    "-c", neovimOutputCommands(true, text)[0],
    ...lua("assert(vim.api.nvim_get_current_win() == editor); assert(#vim.api.nvim_list_wins() == 2); for _, w in ipairs(vim.api.nvim_list_wins()) do if w ~= editor then output = w end end; buf = vim.api.nvim_win_get_buf(output); assert(vim.bo[buf].buftype == 'terminal'); assert(not vim.bo[buf].modifiable); assert(vim.bo[buf].readonly); assert(vim.fn.win_screenpos(vim.fn.win_id2win(output))[1] > vim.fn.win_screenpos(vim.fn.win_id2win(editor))[1]); vim.wait(50); assert(table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), '\\n'):find('Corner Cafe', 1, true)); vim.api.nvim_chan_send(vim.bo[buf].channel, ''); vim.api.nvim_set_current_win(output); vim.cmd('startinsert'); vim.api.nvim_input('oops'); vim.cmd('stopinsert'); assert(vim.api.nvim_buf_get_lines(original, 0, -1, false)[1] == '')"),
    "-c", neovimOutputCommands(true, "New run\n")[0],
    ...lua("assert(#vim.api.nvim_list_wins() == 2); buf = vim.api.nvim_win_get_buf(output); vim.wait(50); local lines = table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), '\\n'); assert(lines:find('New run', 1, true)); assert(not lines:find('Corner Cafe', 1, true)); vim.api.nvim_set_current_win(editor)"),
    "-c", neovimOutputCommands(false, "")[0],
    ...lua("assert(#vim.api.nvim_list_wins() == 1); assert(vim.api.nvim_get_current_win() == editor); assert(vim.api.nvim_get_current_buf() == original)"),
    "-c", "qa!"], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.doesNotMatch(result.stderr, /Error|E\d{3}:/);
});
