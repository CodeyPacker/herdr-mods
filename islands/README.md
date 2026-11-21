# islands

Herdr with every panel as its own rounded card on the canvas, in whatever theme you pick.

![islands](preview.png?v=605c9c8f679e)

Herdr, but every panel is its own rounded card on the canvas. IntelliJ Islands, basically. Takes whatever theme you pick.

A layout plus six small mod clones that round off the shipped bars and lists and turn the tab bar controls into pills.

Don't want the branch pill under each space name? Add `"props": { "branch_pill": false }` next to `"mod": "islands-spaces"` in the layout.

Want all the tabs in one pill with dividers between them, instead of a pill each? Add `"props": { "joined": true }` next to `"mod": "islands-tabs"`.

Want a wallpaper behind the cards? Drop an image in `~/.config/herdr-app/backgrounds/` and change the layout root to `"background": { "image": "backgrounds/your.png", "fit": "cover" }`.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this layout: https://github.com/CodeyPacker/herdr-mods/tree/main/islands
```

By hand: copy `layouts/*` into `~/.config/herdr-app/layouts/` and every folder from `mods/` into `~/.config/herdr-app/mods/`, then run `herdr-app do layout.switch '{"name":"islands"}'`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
