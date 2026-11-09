# Personal usage-limits setup

The mod belongs to [nozikov](https://github.com/nozikov/herdr-usage-limits).
This folder stores only our rounded-corner patch, personal layout template,
and installer. It is not a gallery submission or a redistributed mod.

With Herdr running and Islands installed, run from this repository on either computer:

```sh
git pull
python3 personal-sync/usage-limits/install.py
```

The installer downloads the pinned upstream version, applies the patch, validates
the mod, copies it into Herdr, and selects the personal layout. Existing files
are backed up first. Credentials and session state remain local.
