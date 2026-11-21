# Gallery thumbnail inventory

The supplied approved reference is preserved as `reference.jpg`. Branch and Git Good are unchanged. Git Good has no source folder in this checkout.

| Mod | Previous gallery assets | Screenshot source |
| --- | --- | --- |
| Branch | `branch/preview.png`, `branch/thumbnail.png` | Already approved. Unchanged. |
| Jump | `jump/preview.png` | Supplied Jump screenshot, showing space and tab cards with surrounding editor blurred |
| Run | `run/preview.png` | Supplied Run screenshot, with the surrounding editor lightly blurred |
| Islands | `islands/preview.png` | UI crop from the old preview, showing cards and code |
| Tourist | `tourist/preview.png` | UI crop from the old preview, showing review scope and depth |
| Zen | `zen/preview.png`, `zen/thumbnail-v6.png` | UI crop from the old Zen thumbnail, showing the focused editor |
| Spotify | `spotify/preview.png`, `spotify/thumbnail.png` | Supplied Spotify screenshot, showing playback and playlists with surrounding editor blurred |
| Portal | `portal/preview.png`, `portal/thumbnail.png` | UI crop from the old preview, showing favorite ports and processes |
| Practice Range | None | Native initial setup |
| Tutor | None | Native course setup. No course generated. |
| Vim Docs | `vim-docs/preview.png`, `vim-docs/thumbnail.png` | UI crop from the old preview, showing commands and favorites |
| Tickets | None | Native empty board from `tickets-tourist-wip` |

Every updated mod has a matching `preview.png` and `thumbnail.png` at 2560 × 1440. Existing tracked alternate thumbnail names also receive the new image. The six `islands-*` implementation mods are presented together as Islands. `kit` is shared source. `personal-sync/usage-limits` explicitly excludes itself from gallery submission.

This branch is based on main. Tickets is present in the user's work branch, so only its gallery assets are added here. Its implementation stays on that work branch. Existing untracked thumbnail experiments in the original checkout are untouched.

Five screenshots reuse the UI panels from the old images at commit `90949f0`. Jump, Run, and Spotify use the supplied screenshots with an 8 px background blur and the original dialog pixels preserved. Spotify is cropped to playback controls and the first playlist rows for legibility. Crop coordinates and blur settings are in `screenshot-crops.json`. Perspective is straightened by resampling the existing pixels. No UI is generated or redrawn. Outer promotional artwork and glowing frames are cropped away. Practice Range, Tutor, and Tickets have no older image in Git history, so their native captures remain unchanged. UI key legends and control icons remain inside the screenshots. No promotional branding, badges, icons, key callouts, or slogans were added.

The shared composition is in `template.html`, designed at 1280 × 720 and exported at 2× resolution for sharp text on Retina displays. Titles, descriptions, prior assets, and screen states are in `mods.json`. To reproduce with Playwright and Chrome installed:

```sh
node scripts/render-thumbnails.mjs
```

An existing installation can be selected with `PLAYWRIGHT_MODULE`. `BROWSER_CHANNEL` defaults to `chrome`. Open `index.html` for every full-size preview, or `preview.png` for the contact sheet.

To prepare the screenshots again, install `sharp` and run `node scripts/extract-thumbnail-screenshots.mjs` before rendering. `SHARP_MODULE` can select an existing installation.
