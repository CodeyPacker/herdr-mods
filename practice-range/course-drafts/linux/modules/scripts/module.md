---
id: course:linux/module/scripts
title: Shell scripts
requires: []
outcomes: []
tasks: []
drills: []
---

A shell script is a file of commands that the shell runs in order. It turns a procedure you would type by hand into something repeatable. This module covers how to write one, how to make it stop when something goes wrong, and when a script is the wrong tool.

## A first script

A script is a text file. Three things make it runnable.

```bash example first readonly
#!/usr/bin/env bash
# Print the size of the log directory.

du -sh /var/log
```

```bash example run readonly
chmod +x logsize.sh        # give it execute permission, once
./logsize.sh               # run it
bash logsize.sh            # or hand it to bash directly
```

The first line, starting with `#!`, is the **shebang**. It tells the system which program should read the file. `#!/usr/bin/env bash` means "find bash on the `PATH` and use it".

Without a shebang, the file is run by whatever shell happens to be in use, and that differs between systems. On many, `/bin/sh` is not Bash and lacks some of its features. State which shell you wrote the script for.

Lines starting with `#` are comments.

## Make the script stop on errors

By default, a script continues after a command fails. It runs the next line as if nothing had happened. This is the most dangerous property of shell scripts.

Put this line at the top of every Bash script.

```bash example strict readonly
#!/usr/bin/env bash
set -euo pipefail
```

| Setting | Effect |
| --- | --- |
| `-e` | Stop as soon as a command fails |
| `-u` | Treat the use of an unset variable as an error |
| `-o pipefail` | A pipeline fails if any command in it fails, not only the last |

Each one removes a way for a script to do harm quietly. `-u` alone prevents the empty-variable `rm -rf` from the previous module.

`-e` has exceptions. A command whose failure is tested, as in an `if` or before `||`, does not stop the script. Where a failure is expected and acceptable, say so explicitly: `rm tmpfile || true`.

```text example no-strict readonly
   WITHOUT set -e                       WITH set -e

   cd /srv/app/releases/new   fails     cd /srv/app/releases/new   fails
   rm -rf ./*                 runs      (the script stops here)
   in the wrong directory

   The script went on after the         Nothing after the failure runs.
   failed step.
```

## The script that kept going {prediction}

A deploy script has no `set -e`. Its steps are: build the application, run the tests, copy the build to the server, restart the service. The tests fail.

:::question no-set-e
What does the script do?
- [ ] It stops at the failed tests :: Nothing told it to. A failed command only sets an exit status.
- [x] It prints the test failures, then copies the build and restarts the service anyway :: Without `set -e` every line runs regardless. A build that failed its tests is now live.
- [ ] It skips the copy and still restarts the service :: The shell has no notion of which later steps depend on which earlier ones.
:::

## Arguments

Values given after a script's name are available inside it as numbered variables.

| Variable | Holds |
| --- | --- |
| `$1`, `$2`, ... | The first argument, the second, and so on |
| `$0` | The name of the script |
| `$#` | How many arguments were given |
| `"$@"` | All the arguments, each kept as one word |

```bash example args readonly
#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <source-dir> <dest-dir>" >&2
  exit 1
fi

src="$1"
dest="$2"
cp -r "$src" "$dest"
```

Check the arguments first, print a usage message to standard error if they are wrong, and exit with a non-zero status. A script that carries on with a missing argument does something unintended.

`"$@"`, in quotes, is the correct way to pass all arguments on to another command.

## Tests and conditions

`if` runs a command and looks at its exit status. Zero means true.

```bash example if readonly
if grep -q "ERROR" app.log; then
  echo "errors found"
elif [ -s app.log ]; then
  echo "log has content and no errors"
else
  echo "log is empty"
fi
```

The square brackets are a command that tests a condition. `[[ ... ]]` is Bash's improved form, which is more forgiving about quoting. Spaces are required inside the brackets.

| Test | True when |
| --- | --- |
| `[ -f path ]` | A file exists |
| `[ -d path ]` | A directory exists |
| `[ -s path ]` | A file exists and is not empty |
| `[ -z "$var" ]` | The value is empty |
| `[ -n "$var" ]` | The value is not empty |
| `[ "$a" = "$b" ]` | Two strings are equal |
| `[ "$a" -eq "$b" ]` | Two numbers are equal (`-ne`, `-lt`, `-gt`, `-le`, `-ge`) |

Text and numbers use different operators. `=` compares strings, and `-eq` compares numbers.

## Loops

```bash example loops readonly
# over a list of words
for env in dev staging prod; do
  echo "checking $env"
done

# over files, using a pattern (never by parsing ls)
for f in /var/log/*.log; do
  echo "$f has $(wc -l < "$f") lines"
done

# over the lines of a file
while read -r host; do
  ping -c 1 "$host" > /dev/null && echo "$host up"
done < hosts.txt

# a counter
for i in $(seq 1 5); do
  echo "attempt $i"
done
```

Quote the loop variable where you use it, as in `"$f"`, so that names with spaces survive.

## Functions

A **function** names a group of commands, so that a script reads as a list of steps.

```bash example functions readonly
log() {
  echo "$(date +%T) $*" >&2
}

backup_db() {
  local name="$1"
  log "backing up $name"
  pg_dump "$name" > "/srv/backups/$name.sql"
}

backup_db shop
backup_db billing
```

Inside a function, `$1` and `$2` are the function's own arguments. Declare variables with `local`, or they are visible to the whole script and can overwrite each other.

A function returns an exit status, with `return`, and sends data back by printing it.

## Exit status and cleanup

A script should end with a status that says whether it worked. Other scripts, schedulers and pipelines rely on it.

```bash example trap readonly
#!/usr/bin/env bash
set -euo pipefail

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

# ... work in "$workdir" ...

echo "done"
```

`trap ... EXIT` registers a command to run when the script ends, for any reason, including an error. It is the reliable way to remove temporary files or release a lock.

`mktemp` creates a temporary file or directory with a unique, unpredictable name. Use it in place of a fixed name such as `/tmp/work`, which two runs of the script would fight over.

## Habits that prevent damage

- **Quote every variable**: `"$var"`.
- **Start with `set -euo pipefail`.**
- **Check arguments and required tools** at the top.
- **Send error messages to standard error**, with `>&2`.
- **Use full paths** for files, and do not depend on the directory the script was started from.
- **Offer a dry run** for anything destructive: a mode that prints what would be done.
- **Make it safe to run twice.** `mkdir -p` and "create if missing" steps let a script be run again after a partial failure.
- **Run a linter.** `shellcheck` reads a script and reports quoting mistakes and other common faults.

## Scheduling

To run a script regularly, give it to a scheduler. The traditional one is **cron**. Each user has a table of jobs, edited with `crontab -e`.

```text example cron readonly
   # minute  hour  day-of-month  month  day-of-week   command
     30      2     *             *      *             /srv/bin/backup.sh
     */15    *     *             *      *             /srv/bin/check.sh
     0       9     *             *      1-5           /srv/bin/report.sh

   02:30 every day
   every 15 minutes
   09:00 on Monday to Friday
```

Scheduled jobs fail in their own ways.

- They run with a minimal environment. Your `PATH` and variables are not there. Use full paths.
- Nobody is watching. Redirect output to a log, and make failures visible.
- A long job may still be running when the next run starts. Use a lock so that two copies do not overlap.

On current systems, systemd timers do the same job with better logging. The services module mentions them.

## When not to write a shell script

Shell is the right tool for gluing commands together: run these five programs in order and stop if one fails.

It is the wrong tool when the script needs real data structures, arithmetic beyond counting, careful error handling, JSON, or tests. Shell has many traps, and they multiply with length.

A reasonable rule is that when a script passes about a hundred lines, or starts to need arrays and string handling, it should be rewritten in a general programming language.

## Tested or not {prediction}

A script starts with `set -e`. One line is `grep -q "ready" status.txt`, used as a plain statement to check that a service is ready. The word is not in the file.

:::question set-e-grep
What happens?
- [x] The script stops at that line :: `grep` exits with status 1 when nothing matches, and with `set -e` a failing command ends the script. If "not found" is an expected outcome, test it with `if`.
- [ ] The script continues, since `grep` printed no error :: A missing match prints nothing and still returns a non-zero status.
- [ ] The script continues, since `-q` hides the failure :: `-q` hides the output. The exit status is unchanged.
:::

## Exercise: review the script {independent}

This script is meant to archive yesterday's logs and delete the originals. List every problem you can find. Then rewrite it.

```bash example bad-script readonly
cd /var/log/app
tar -czf /backups/logs.tar.gz *.log
rm *.log
echo done
```

## One possible answer {walkthrough}

**Problems**

1. **No shebang.** It may be run by a shell other than the one intended.
2. **No `set -e`.** If `cd` fails, `tar` and `rm` run in whatever directory the script was started from, and `rm *.log` deletes the wrong files.
3. **Deleting after a possible failure.** If `tar` fails, for example on a full disk, `rm` still runs. The logs are gone and no archive exists.
4. **A fixed archive name.** Each run overwrites the previous archive. Only one day is ever kept.
5. **No check that anything matched.** With no `.log` files, the pattern stays as the literal text `*.log` and both commands fail in a confusing way.
6. **Files in use.** The application may still be writing to the current log. Deleting it loses lines and may not free the space.
7. **No useful exit status or messages.** It prints "done" whatever happened.

**Rewritten**

```bash example good-script readonly
#!/usr/bin/env bash
set -euo pipefail

log_dir="/var/log/app"
backup_dir="/backups"
stamp=$(date -d yesterday +%F)
archive="$backup_dir/logs-$stamp.tar.gz"

cd "$log_dir"

shopt -s nullglob
files=( *."$stamp".log )
if [ "${#files[@]}" -eq 0 ]; then
  echo "no logs for $stamp" >&2
  exit 0
fi

tar -czf "$archive" "${files[@]}"
tar -tzf "$archive" > /dev/null      # check the archive can be read
rm -- "${files[@]}"
echo "archived ${#files[@]} files to $archive"
```

**What changed**

- `set -euo pipefail` means a failed `cd` or `tar` ends the script before anything is deleted.
- The archive name includes the date, so earlier days are kept.
- It takes only yesterday's rotated logs, by name, and leaves the file the application is writing.
- `nullglob` makes a pattern with no matches expand to nothing, and the empty case is handled as a normal outcome.
- The archive is read back before the originals are removed.

It is now about twenty lines, with an array in it. That is close to the point where another language would be the better choice.
