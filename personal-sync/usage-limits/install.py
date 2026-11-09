"""Install nozikov's usage-limits mod with our local rounded-corner patch."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = "https://github.com/nozikov/herdr-usage-limits.git"
REVISION = "048dbe911ee957f42d465d950a5ce04d61fed904"
HERE = Path(__file__).resolve().parent
APP = Path.home() / ".config/herdr-app"


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    layout = (HERE / "layout.template").read_text()
    tree = json.loads(layout)

    def mods(node):
        if "mod" in node.get("content", {}):
            yield node["content"]["mod"]
        for child in node.get("children", []):
            yield from mods(child)

    missing = [name for name in mods(tree) if name != "usage-limits"
               and not (APP / "mods" / name / "main.js").is_file()]
    if missing:
        raise SystemExit("Install Islands first. Missing mods: " + ", ".join(missing))

    with tempfile.TemporaryDirectory(prefix="herdr-usage-sync-") as temp:
        repo = Path(temp) / "upstream"
        run("git", "clone", SOURCE, str(repo))
        run("git", "checkout", "--detach", REVISION, cwd=repo)
        run("git", "apply", str(HERE / "rounded-corners.patch"), cwd=repo)
        staged = repo / "mods/usage-limits"
        shutil.copy2(repo / "LICENSE", staged / "LICENSE")
        run("herdr-app", "check", str(staged))
        destination = APP / "mods/usage-limits"
        layout_path = APP / "layouts/islands-usage-limits.json"
        # Keep existing files before applying the synchronized version.
        if destination.exists():
            backup = Path(temp) / "previous-mod"
            shutil.copytree(destination, backup)
            saved = APP / "backups/usage-limits"
            saved.mkdir(parents=True, exist_ok=True)
            shutil.copytree(backup, saved / REVISION, dirs_exist_ok=True)
        if layout_path.exists() and layout_path.read_text() != layout:
            shutil.copy2(layout_path, layout_path.with_suffix(".json.before-sync"))
        shutil.copytree(staged, destination, dirs_exist_ok=True)
        layout_path.parent.mkdir(parents=True, exist_ok=True)
        layout_path.write_text(layout)
    run("herdr-app", "check", str(destination))
    run("herdr-app", "do", "layout.switch", '{"name":"islands"}')
    run("herdr-app", "do", "layout.switch", '{"name":"islands-usage-limits"}')


if __name__ == "__main__":
    main()
