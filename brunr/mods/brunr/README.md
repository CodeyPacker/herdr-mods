# Brunr

A side panel for Herdr that lists Bruno Collections as a tree, runs their Requests with the Bruno CLI and shows each Response in a pane. It reads and runs. It never edits a Collection.

This file is the reference. What the mod offers and how to install it is in the page one folder up.

## Config

`brunr.json` in the Herdr app home (`~/.config/herdr-app/brunr.json`). With no file, Brunr reads Bruno desktop's default workspace and nothing else. It lives in the app home so it never travels with the mod folder.

```json
{
  "workspace": "/home/dev/.config/bruno/default-workspace/workspace.yml",
  "collections": [
    { "path": "C:/dev/shop/api-collection" },
    { "machine": "wsl", "path": "/home/dev/shop/collections" },
    { "machine": "buildbox", "path": "/srv/shop/api-collection" }
  ]
}
```

- `workspace`: the path of a `workspace.yml` on this computer. Optional. It replaces the default workspace path.
- `collections`: a list of entries, each with a `path` and an optional `machine`.
- `machine`: the name of a Herdr Machine that holds the Collection. Leave it out for this computer.
- `path`: a Collection root, or a folder whose direct child folders are Collection roots. It is a path on that Machine, and Brunr does not translate a path between Machines.

A bad entry is left out and a notice in the panel names it. A file that is not valid JSON gives the defaults and a notice with the parse error.

## Where Collections come from

1. Bruno desktop's workspace file. The default path is `<home>/AppData/Roaming/bruno/default-workspace/workspace.yml` on Windows, `<home>/Library/Application Support/bruno/default-workspace/workspace.yml` on macOS and `<home>/.config/bruno/default-workspace/workspace.yml` elsewhere. Its Collection paths may be relative to the workspace folder. These Collections are always on this computer.
2. The entries of `brunr.json`, after the workspace ones.

A Collection listed twice (same Machine and same root) shows once. A Collection is a folder holding `opencollection.yml` (the YAML format) or `bruno.json` (the bru format). A Collection shows under its own name, else its folder's name. When the Collections sit on more than one Machine, each Machine gets a heading, and "This computer" is the name for this one.

The tree stays current in two ways:

- Collections on this computer are watched, and a change in the folder reloads that Collection.
- Collections on another Machine are read again every 30 seconds.

The refresh button, the palette entry "Brunr: Reload" and the `brunr.reload` command read `brunr.json`, the workspace, every Collection and the CLI check again.

Brunr reads only the files it needs from a Collection: the config file, and the Request, folder and Environment files of the Collection's format (`.yml` or `.bru`). Dot files, dot folders and `node_modules` are never listed or read, so `.env` is never opened. It reads at most 2000 files per Collection.

## Environments and secrets

An Environment is a file in the Collection. Its name is the file name without the extension, which is what `--env` takes.

- The Environment chip on a Collection row, the `e` key and the row menu pick the Environment of that Collection. "No Environment" is a choice.
- Until a choice is made, or when the chosen Environment no longer exists, the Collection's default Environment is used.
- The choice is remembered per Collection.

A Global environment is a file in the `environments` folder beside the workspace's `workspace.yml`. Brunr shows a "Global environment" row above the workspace's Collections when that folder has any. One choice per workspace applies to all of its Collections, and a Run passes `--global-env` and `--workspace-path`. Collections that came from `brunr.json` get no Global environment.

Secrets:

- The CLI cannot read secrets stored in Bruno desktop.
- Change a secret variable to a normal variable whose value is `{{process.env.NAME}}`, and put the value in the Collection's `.env`. Bruno desktop reads that too.
- Brunr warns on an Environment that still has secret variables. The warning shows on the chip, in the picker and in the panel's footer, and names the variables.
- Brunr reads only variable names from Environments. It never reads a `.env` file. The CLI reads it during a Run.

## Runs

A Run is one `bru run` on the Collection's Machine, started with the Collection root as the working directory:

```text
bru run [path] [-r] [--env NAME] [--global-env NAME --workspace-path DIR] --reporter-json FILE
```

- A Request Run passes the Request file's path.
- A folder Run passes the folder's path and `-r`.
- A Collection Run passes no path.
- On Windows, `bru.cmd` is started on this computer.

The CLI's output goes to a progress file next to the report:

- Not on Windows, `sh -c 'out=$1; shift; exec "$@" >"$out" 2>&1' sh FILE bru run ...` starts it. Every value is a separate argument and no shell reads it.
- On Windows, `node -e` with a fixed script finds `bru.cmd` on the PATH, reads the CLI's script path out of it and starts that script with `node` itself, the way the npm shim does. No `cmd.exe` is involved, so `%`, `&`, quotes and parentheses in a path or Environment name are passed as they are. When the script cannot be found next to `bru.cmd`, Brunr starts `bru.cmd` directly as before, and that Run shows no progress.
- The CLI's exit code and its whole output still reach the result.

Rules:

- A Request Run times out after 60 seconds, and a folder or Collection Run after 10 minutes. A timed-out Run shows "The Run timed out."
- One Run goes at a time across the whole mod. Run buttons and keys do nothing while a Run is in progress, and the tooltip says so.
- A Run cannot be cancelled.
- A Request Run starts at once. A folder or Collection Run first asks `Run 4 Requests in "Products" against local?` in Herdr's confirm dialog. Enter runs and Esc cancels. A folder with no Requests shows a toast and runs nothing.
- Runs are off for a Machine where `bru` does not start. At start and on reload Brunr runs `bru --version` and `node --version` on each Machine, with a 20 second timeout. A notice then gives the step: install Node.js first when it is missing, else `npm i -g @usebruno/cli`. It has a Copy button.
- Each Run writes the CLI's JSON report and a progress file, and deletes both after reading them. On this computer they are `data/brunr/run-*.json` and `run-*.log` in the app home. On another Machine they are `/tmp/brunr-*.json` and `/tmp/brunr-*.log`.
- A report or progress file left behind by a timed-out Run is deleted at the next Run. The panel also deletes `run-*.json` and `run-*.log` files left by an earlier session when it starts.

Progress during a folder or Collection Run:

- While the CLI runs, Brunr reads the progress file every 500 ms and redraws only when it changed. The CLI writes one line as each Request finishes, such as `products/List Products (200 OK) - 23 ms`.
- Brunr works out the order the CLI sends the Requests in, so it can name the Request that runs next. In each folder the CLI sends the subfolders first, sorted by name and then moved to their `seq` place, then the Requests by `seq`, a missing `seq` counting as 1. When the finished Requests do not match that order, the running Request is not named and only the counts and the finished list show.
- A finished Request's live mark comes from its HTTP status only: ✓ for 2xx and 3xx, ✗ otherwise. Assertions and tests are not shown live. The final result replaces the live list, so a Request can change from ✗ to ✓ or back.

A Run's output goes to the Response pane of the focused tab. The pane is reused when the tab has one. Otherwise it opens to the right of the focused pane, or in a new tab when no pane has focus.

## The Response pane

A Run of one Request shows:

- A top line with the Request's name, method and URL, then the status with its text, the time and the size.
- Four views: Response, Headers (with the count), Timeline and Tests (passed over total). The Tests label turns red when anything failed.
- Response is a read-only editor with syntax colours for JSON, HTML and XML. A body over 400000 characters is cut.
- Timeline shows the Request as it was sent: resolved URL, headers and body, then the status and time.
- Tests lists each assertion and each script test with its error text.

While a folder or Collection Run is in progress, the pane shows:

- A summary line with a spinner and `4 of 16`.
- The list of finished Requests as they finish, each with its mark, method, name and status, grouped under their folders as described below. The running Request is the last row, with a spinner in place of the mark, and each folder that holds it shows a spinner beside its count. Request rows cannot be selected until the Run ends.
- When the Run ends, the pane shows the result as below, with the same rows and folds, so the list does not jump.

A single Request Run shows a spinner until it ends.

A folder or Collection Run adds:

- A summary line with the number of Requests, passed, failed and skipped, and the total time.
- A list of Responses, each with a pass or fail mark, method, name and status. A Request with no response shows `ERR`. The first failed Response is selected, else the first.
- The list sits left of the views when the pane is 720px wide or more, and above them when it is narrower.

The list is a tree, as in the panel:

- Each Request sits under the folders it belongs to, indented by depth. Each folder with a listed Request beneath it has a row before its first Request, with an arrow, its name and `<passed>/<total>` at the right. The count is red when any Request beneath it failed, else green.
- The Run target gets no row. A `products` Run shows `top sellers` as a folder row and the Requests directly in `products` at the top level. A Collection Run shows its top-level folders as rows. A Run whose Requests all sit directly in the target has no folder rows.
- During the Run, total is the number of Requests planned beneath the folder and passed counts finished Requests with a 2xx or 3xx status. In the result, both count the listed Responses.
- Clicking a folder row folds or unfolds it. Folders start unfolded. Folds last for that Run only and reset when a new Run starts. When the Run ends, the folders holding the selected and the first failed Request unfold.
- Requests keep the order the CLI ran them in. If one folder's Requests are not consecutive, the folder gets a new row each time it starts again, so no Request shows under the wrong folder.
- A Request missing from the Collection tree is placed by the directories in its path. A folder is named by its folder file, else by its directory name.

A finished Run with more than one Request has a toolbar above the list. Left to right:

- A `Search` field. It keeps the Requests whose name, path or URL holds every word typed, ignoring case.
- Each control below shows a fixed label before its value: `Result`, `Status`, `Method` and `Sort`. The defaults read `Result All`, `Status Any`, `Method Any` and `Sort Run order`. The label stays in the muted colour.
- A result control that cycles on click through `All`, `Failed` and `Passed`. Failed means the same as the mark: a failed assertion or test, a network error or a CLI error. The HTTP status alone never fails a Request.
- A status control that cycles through `Any`, `2xx`, `3xx`, `4xx`, `5xx` and `Error`, which keeps the Requests that got no response.
- A method control that cycles through `Any` and the methods that occur in this Run. The common methods come first in the order GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, then any others alphabetically. A Request that is not HTTP counts under its type, for example `GRPC`.
- A sort control that cycles through `Run order`, `Slowest`, `Fastest`, `Status` and `Name`.

How the toolbar works:

- The four filters combine. A control away from its first value has its value drawn in the accent colour. When the pane is narrow, the text field shrinks first.
- Sorting keeps the folder tree. Requests are sorted inside their own folder and folders keep their Run order. `Slowest` and `Fastest` use the response time and `Status` the status number, with Requests that got no response last. `Name` ignores case. Ties keep the Run order.
- A folder with no Request left is hidden, nested folders too. Folder counts always describe the whole Run, so a filter never changes them.
- The summary line adds `showing <n> of <total>` while a filter is on.
- When nothing matches, the list says `No Requests match.` with a `Clear filters` button that resets the four filters and keeps the sort.
- When the selected Request is filtered out, the first one shown is selected.
- The filters and sort stay as they are for later Runs in the same pane, so `Failed` stays on while a folder runs again. The one exception is the method: when a new Run ends and the chosen method does not occur in it, the method goes back to `Any`.
- While a Run is in progress the toolbar is disabled and the live list shows every Request in Run order, since pass and fail are not known yet.

When the CLI sends no Request, or fails before it starts, the pane shows its message in a box. Open file shows a Request's file in the pane, read only.

Everything in the pane is held in memory and goes when the pane closes.

## Keys

`ctrl-shift-u` (in `keys.json`):

- With the panel hidden, it shows the panel and gives it the keyboard (`mod.open:brunr`).
- With the panel shown and the keyboard in another pane, it hides the panel and leaves the keyboard where it is.
- While the panel holds the keyboard, it hides the panel and hands the keyboard back (`brunr.hide`, in the `mod:brunr` section).

With the keyboard in the panel, keys with `ctrl`, `alt` or the platform key are not used by it:

| Key | Action |
|---|---|
| `up` / `k` | previous row |
| `down` / `j` | next row |
| `home` / `end` | first / last row |
| `left` / `h` | fold the Collection or folder, else go to the parent row |
| `right` / `l` | unfold, else go to the first child |
| `enter` | run a Request, fold or unfold a Collection or folder, pick on the Global environment row |
| `r` | run the Request, folder or Collection |
| `e` | pick the Environment (or the Global environment on its row) |
| `o` | open the Request's file in the Response pane |
| `b` | open Bruno desktop (Collections on this computer only) |
| `esc` / `q` | hand the keyboard back to the pane on the left |

In a picker or menu: `up`, `down`, `enter` and `esc`.

Mouse:

- Click selects a row. Double-click runs a Request or folds a Collection or folder.
- The arrow folds. The play button on a hovered or selected Collection or folder row runs it.
- The Environment chip opens the picker.
- Right-click opens the row's menu: Run, Open file, Run folder or Run Collection, Environment, Global environment, Open Bruno (this computer only), Copy URL, Copy path and Reload.

Command palette entries: "Brunr: Toggle" (`layout.toggle` for the block `brunr`), "Brunr: Keys" and "Brunr: Reload".

## State

- The panel keeps in its localStorage: which Collections and folders are unfolded, the Environment chosen per Collection (keyed by Machine and root) and the Global environment chosen per workspace file. Herdr keeps it in store files under `data/brunr/` in the app home.
- Collections start unfolded and folders folded until you change them.
- Folds in the Response pane's list are held in memory for one Run.
- The Response pane's filters and sort are held in memory by that pane until it closes. They are never written to disk or shared state.
- Runs and Responses are never written to disk. The report and progress files are the only exception, and they live for the length of one Run.
- Shared state holds `brunr.tick`, a counter that makes the other copies of the mod draw again, and `brunr.request`. `brunr.request` holds the last choice a popup made for the panel: a kind, a row key (Machine, Collection path and the path inside it), an action, or an Environment or Global environment name. It never holds Response data or secrets.

## Limits

- Requests with prompt variables are skipped by the CLI.
- OAuth2 works only for the `client_credentials` and `password` grants.
- A YAML file the CLI cannot parse aborts the whole Run, for example an unquoted value containing a colon followed by a space. Brunr's own reader is more forgiving, so the tree can show a Request the CLI will not run.
- A file Brunr cannot read adds to a count on the Collection row, and the footer names the first five.
- There is no cancel for a Run.
- Run progress shows HTTP statuses only. Assertion and test results appear when the Run ends.
- The running Request is named only while the CLI sends Requests in the order Brunr expects. Requests with the same `seq` keep the folder's listing order, which Brunr takes as the file name ignoring case, as Windows lists files. Another Machine may list them in another order.
- On Windows, a timed-out Run may leave the CLI running until it ends by itself, since Brunr ends the `node` that started it.
- Secrets stored in Bruno desktop are empty in a CLI Run (see Environments and secrets).
- On Windows Brunr starts `bru.cmd`, so the npm global folder must be on the PATH Herdr was started with. Without it the panel shows the missing CLI notice.
- Bruno desktop cannot be told to open a specific Request, so "Open Bruno" only starts the app. Brunr looks for it at `<home>/AppData/Local/Programs/Bruno/Bruno.exe` on Windows, `/Applications/Bruno.app` on macOS and `bruno` on the PATH elsewhere.
- `"place": "right"` is not enough to place the panel. On the Herdr version tested, the shipped `main` layout did not dock it, and a personal layout docked it at the window root, full height, with a generated id. The page's Install therefore adds a block with the id `brunr`. `ctrl-shift-u` finds the block by its mod, so it works with any id. The "Brunr: Toggle" palette entry uses the id `brunr`.
- Collections on another Machine are listed and read with `sh` and `cat`, so that Machine needs both.
- A Global environment applies only to Collections listed in the workspace file.
- Paths are used as the Machine gives them. A Collection on WSL is not the same Collection as the same folder seen from Windows.

## How it works

One mod draws every part. Herdr starts a copy of it for the panel, for each Response pane, for each popup and for the key's pass-through, and the props tell them apart.

- `main.js`: the entry. Chooses the copy by its props, loads and watches Collections, handles keys, clicks and Runs.
- `panel.js`: draws the tree, the notices and the footer.
- `response.js`: draws the Response pane.
- `popup.js`: draws the Environment pickers and the row menu.
- `tree.js`: the rows, the key map, the block finder and the confirmation and secret texts. No Herdr calls.
- `runtree.js`: the Response pane's Run list as rows of folders and Requests, with counts and folds, for the live list and the result alike. No Herdr calls.
- `runfilter.js`: the Response pane's filters and sort. Takes a finished Run's Responses and gives the Requests to list, in order, with the whole Run's folder counts. No Herdr calls.
- `store.js`: saved state, the in-memory Run store and the popup-to-panel asks.
- `sources.js`: reads `brunr.json` and the workspace and finds Collection roots. Loads one Collection.
- `machine.js`: every `exec`, `readTextFile`, `watchFolder` and `fs` call. Lists and reads files, checks the CLI, runs `bru` with its output going to the progress file, reads that file on a `cx.timer` while the Run is in progress, reads and deletes reports and progress files and starts Bruno desktop.
- `plan.js`: turns a target and the chosen Environments into the `bru run` arguments, and lists the Requests a Run sends in the CLI's order. No Herdr calls.
- `progress.js`: turns the progress file's text into the finished Requests and the running one. No imports.
- `report.js`: turns the CLI's JSON report, exit code and output into Responses. No Herdr calls.
- `parser.js` and `yaml.js`: read Collection files in both formats and a small YAML subset.
- `icons/`: the panel's SVG icons.

Tests are in `brunr/tests/` in the repo and run with `sh brunr/tests/run.sh`.
