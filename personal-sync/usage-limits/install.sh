#!/bin/sh
# Install nozikov's usage-limits mod with our personal rounded-corner patch.
set -eu

sync_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_dir="$HOME/.config/herdr-app"
revision=19fda912acc4f0212e5958d03ccd35081fe4395d

for tool in git herdr-app; do
    command -v "$tool" >/dev/null 2>&1 || {
        printf 'Required command not found: %s\n' "$tool" >&2
        exit 1
    }
done

# These are the mod references in layout.template, except usage-limits itself.
for mod in islands-workspace-chrome islands-spaces islands-agents islands-tabs islands-pane islands-workspace-status files changes; do
    [ -f "$app_dir/mods/$mod/main.js" ] || {
        printf 'Install Islands first. Missing mod: %s\n' "$mod" >&2
        exit 1
    }
done

temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/herdr-usage-sync.XXXXXX")
trap 'rm -rf "$temp_dir"' EXIT
trap 'exit 1' HUP INT TERM
repo_dir="$temp_dir/upstream"
git clone https://github.com/nozikov/herdr-usage-limits.git "$repo_dir"
git -C "$repo_dir" checkout --detach "$revision"
git -C "$repo_dir" apply "$sync_dir/rounded-corners.patch"
cp "$repo_dir/LICENSE" "$repo_dir/mods/usage-limits/LICENSE"
herdr-app check "$repo_dir/mods/usage-limits"

destination="$app_dir/mods/usage-limits"
layout_path="$app_dir/layouts/islands-usage-limits.json"
mkdir -p "$app_dir/backups/usage-limits" "$app_dir/mods" "$app_dir/layouts"
backup_dir=$(mktemp -d "$app_dir/backups/usage-limits/install.XXXXXX")
if [ -e "$destination" ] || [ -L "$destination" ]; then
    [ ! -L "$destination" ] || {
        printf 'Refusing to replace a symlink: %s\n' "$destination" >&2
        exit 1
    }
    cp -R "$destination" "$backup_dir/mod"
fi
if [ -f "$layout_path" ]; then
    cp "$layout_path" "$backup_dir/layout.json"
fi
mkdir -p "$destination"
cp -R "$repo_dir/mods/usage-limits/." "$destination/"
cp "$sync_dir/layout.template" "$layout_path"
herdr-app check "$destination"
herdr-app do layout.switch '{"name":"islands"}'
herdr-app do layout.switch '{"name":"islands-usage-limits"}'
printf 'Installed usage limits. Backup: %s\n' "$backup_dir"
