#!/usr/bin/env python3
"""Rename words across one course module without touching ids, paths or directives.

python3 practice-range/scripts/course-rename.py <module folder> 'old=new' ['old=new' ...]

- Each pair is a whole-word, case-sensitive replace. Quote the shell argument.
  Put longer phrases first: pairs run in the order given.
- Code files (.cs, .ts, .sql) in tasks/*: every word is renamed.
- task.json: only title, prompt, hints, checks, checkLabels, feedback, support,
  typeChecks, rejects and wrong-answer misconceptions are renamed. ids, paths,
  fixture ids, declarations and sources are left alone.
- module.md: only prose. Front matter, code fences, and lines starting with
  @ or ::: are left alone, and so are question choices' ids. Question prompt and
  choice text are renamed.
Print what changed, then verify with scripts/verify-course.mjs.
"""
import json, re, sys
from pathlib import Path

folder = Path(sys.argv[1])
pairs = [tuple(arg.split("=", 1)) for arg in sys.argv[2:]]
if not pairs: sys.exit(__doc__)

def rename(text):
    for old, new in pairs:
        text = re.sub(r"(?<![\w-])" + re.escape(old) + r"(?![\w-])", new, text)
    return text

FIELDS = ("title", "prompt", "feedback", "support")
LISTS = ("hints", "checks", "checkLabels", "typeChecks", "rejects")
changed = []
for task in sorted(folder.glob("tasks/*/task.json")):
    data = json.loads(task.read_text())
    before = json.dumps(data)
    for key in FIELDS:
        if isinstance(data.get(key), str): data[key] = rename(data[key])
    for key in LISTS:
        if isinstance(data.get(key), list): data[key] = [rename(v) if isinstance(v, str) else v for v in data[key]]
    for wrong in data.get("wrongAnswers", []): wrong["misconception"] = rename(wrong["misconception"])
    if json.dumps(data) != before:
        task.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n"); changed.append(str(task))
    for code in task.parent.iterdir():
        if code.suffix in (".cs", ".ts", ".sql"):
            text = code.read_text(); new = rename(text)
            if new != text: code.write_text(new); changed.append(str(code))

md = folder / "module.md"
if md.exists():
    lines = md.read_text().split("\n"); end = lines.index("---", 1); out = lines[:end + 1]; fence = None
    for line in lines[end + 1:]:
        if fence:
            out.append(line); fence = None if line.strip() == fence else fence; continue
        opening = re.match(r"^(`{3,})", line)
        if opening: fence = opening.group(1); out.append(line); continue
        out.append(line if line.startswith(("@", ":::")) else rename(line))
    text = "\n".join(out)
    if text != md.read_text(): md.write_text(text); changed.append(str(md))
print("\n".join(changed) or "nothing changed")
