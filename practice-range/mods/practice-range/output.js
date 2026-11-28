/** Format the existing run, including output from successful course cases. @param {any} result */
export function outputText(result) {
  if (!result) return "Save your file to run it.\n";
  const lines = [result.title];
  if (result.fixtures?.length) {
    for (const fixture of result.fixtures) {
      lines.push(`\nCase ${fixture.id}: ${fixture.title}`, ...fixture.details);
    }
  } else lines.push(...(result.details ?? []));
  // Treat program output as text, including escape sequences that could control a terminal.
  return lines.join("\n").replace(/\r\n?/g, "\n").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "") + "\n";
}

/** A Lua long string with a delimiter that cannot occur in its contents. @param {string} text */
function luaString(text) {
  let equals = "";
  while (text.includes(`]${equals}]`)) equals += "=";
  return `[${equals}[${text}]${equals}]`;
}

/**
 * A terminal display with no shell, process, or input handler. Keep the cursor in the editor.
 * Replacing its buffer clears the previous run without interpreting program escape codes.
 * @param {boolean} visible @param {string} text
 */
export function neovimOutputCommands(visible, text) {
  return [`lua (function()
    local api = vim.api
    local current = api.nvim_get_current_win()
    local windows = {}
    for _, win in ipairs(${visible ? "api.nvim_tabpage_list_wins(0)" : "api.nvim_list_wins()"}) do
      if vim.b[api.nvim_win_get_buf(win)].practice_range_output then table.insert(windows, win) end
    end
    ${visible ? `
    local win = windows[1]
    if not win then
      vim.cmd('botright 10split')
      win = api.nvim_get_current_win()
    end
    local old = api.nvim_win_get_buf(win)
    local buf = api.nvim_create_buf(false, true)
    api.nvim_win_set_buf(win, buf)
    vim.b[buf].practice_range_output = true
    api.nvim_buf_set_name(buf, 'Practice Output ' .. buf)
    api.nvim_win_call(win, function()
      local channel = api.nvim_open_term(buf, {})
      api.nvim_chan_send(channel, (vim.fn.json_decode(${luaString(JSON.stringify(text))}):gsub('\\n', '\\r\\n')))
      vim.bo[buf].bufhidden = 'wipe'
      vim.bo[buf].modifiable = false
      vim.bo[buf].readonly = true
      vim.wo[win].number = false
      vim.wo[win].relativenumber = false
      vim.wo[win].winfixheight = true
    end)
    if api.nvim_buf_is_valid(old) and vim.b[old].practice_range_output then api.nvim_buf_delete(old, { force = true }) end
    ` : `for _, win in ipairs(windows) do if #api.nvim_tabpage_list_wins(api.nvim_win_get_tabpage(win)) > 1 then api.nvim_win_close(win, true) end end`}
    if api.nvim_win_is_valid(current) then api.nvim_set_current_win(current) end
  end)()`.replace(/\n\s*/g, " ")];
}
