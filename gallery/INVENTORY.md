# Gallery thumbnail inventory

The supplied approved reference is preserved as `reference.jpg`. Branch and Git Good are unchanged. Git Good has no source folder in this checkout.

| Mod | Previous gallery assets | Screenshot source |
| --- | --- | --- |
| Branch | `branch/preview.png`, `branch/thumbnail.png` | Already approved. Unchanged. |
| Jump | `jump/preview.png` | Native space and tab picker |
| Run | `run/preview.png` | Native process list with a running Storybook process |
| Islands | `islands/preview.png` | Native Islands layout, cropped below the brand row |
| Tourist | `tourist/preview.png` | Native tour setup for this repository |
| Zen | `zen/preview.png`, `zen/thumbnail-v6.png` | Native Islands layout with Zen enabled |
| Spotify | `spotify/preview.png`, `spotify/thumbnail.png` | Native sign-in setup. No account connected. |
| Portal | `portal/preview.png`, `portal/thumbnail.png` | Native local listening-process list |
| Practice Range | None | Native initial setup |
| Tutor | None | Native course setup. No course generated. |
| Vim Docs | `vim-docs/preview.png`, `vim-docs/thumbnail.png` | Native searchable command reference |
| Tickets | None | Native empty board from `tickets-tourist-wip` |

Every updated mod has a matching `preview.png` and `thumbnail.png` at 1280 × 720. Existing tracked alternate thumbnail names also receive the new image. The six `islands-*` implementation mods are presented together as Islands. `kit` is shared source. `personal-sync/usage-limits` explicitly excludes itself from gallery submission.

This branch is based on main. Tickets is present in the user's work branch, so only its gallery assets are added here. Its implementation stays on that work branch. Existing untracked thumbnail experiments in the original checkout are untouched.

`gallery/sources/*.png` are cropped native captures, with no repainted UI. Screens were captured in a temporary Herdr home except Jump and Run, which were captured from the installed app. Native key legends and control icons remain inside the screenshots. No promotional branding, badges, icons, key callouts, or slogans were added.

The shared composition is in `template.html`. Titles, descriptions, prior assets, and screen states are in `mods.json`. To reproduce with Playwright and Chrome installed:

```sh
node scripts/render-thumbnails.mjs
```

An existing installation can be selected with `PLAYWRIGHT_MODULE`. `BROWSER_CHANNEL` defaults to `chrome`. Open `index.html` for every full-size preview, or `preview.png` for the contact sheet.
