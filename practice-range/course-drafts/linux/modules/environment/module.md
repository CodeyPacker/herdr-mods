---
id: course:linux/module/environment
title: Variables and the environment
requires: []
outcomes: []
tasks: []
drills: []
---

A shell remembers values in variables, and passes some of them to the programs it starts. This module covers how variables work, how the shell finds programs, how quoting changes what a command receives, and where settings are stored.

## Shell variables

A **variable** is a named value. Set one with `name=value`, with no spaces around the equals sign. Read it by putting `$` in front of the name.

```bash example vars readonly
name="Ana Ruiz"            # set. No spaces around =
echo $name                 # read
echo "Hello, $name"        # used inside double quotes
echo "${name}_backup"      # braces mark where the name ends
unset name                 # remove it
```

The spaces matter. `name = "Ana"` runs a program called `name` with two arguments, and fails with "command not found".

Braces are needed when the name is followed directly by other characters. `$name_backup` is read as a variable called `name_backup`, which does not exist.

A variable that was never set is empty, and using it is not an error by default. That is a common source of bugs, and of the dangerous `rm -rf "$DIR/"` with an empty `DIR`.

## The environment

A plain variable belongs to the shell where it was set. Programs started from that shell do not see it.

`export` marks a variable as part of the **environment**: the set of variables that is copied to every program the shell starts. This is how configuration reaches a program.

```bash example export readonly
ana@web01:~$ color=blue
ana@web01:~$ bash -c 'echo "child sees: $color"'
child sees:

ana@web01:~$ export color
ana@web01:~$ bash -c 'echo "child sees: $color"'
child sees: blue

export APP_ENV=production      # set and export in one step
env                            # list the whole environment
APP_ENV=test ./run.sh          # set it for this one command only
```

The copy goes one way. A child process gets its own copy and can change it. The change never travels back to the parent. A script cannot change the variables of the shell that ran it.

```text example inherit readonly
   shell                       child process (a program you start)
   +--------------------+      +--------------------+
   | color=blue         |      |                    |
   | export APP_ENV=prod| ---> | APP_ENV=prod       |
   +--------------------+ copy +--------------------+

   Only exported variables are copied. Changes in the child
   do not come back.
```

## Variables you will meet

Some variables are set by the system and read by many programs.

| Variable | Holds |
| --- | --- |
| `HOME` | Your home directory |
| `USER` | Your user name |
| `PATH` | The directories searched for programs |
| `PWD` | The current directory |
| `SHELL` | Your login shell |
| `LANG` | Language and character settings |
| `EDITOR` | The editor that programs open for you |

By convention, environment variables are written in capitals.

## How the shell finds a program

When you type `ls`, the shell has to find a file to run. It looks in each directory listed in `PATH`, in order, and runs the first match.

```bash example path readonly
ana@web01:~$ echo $PATH
/usr/local/bin:/usr/bin:/bin:/home/ana/bin

ana@web01:~$ which python3
/usr/bin/python3

ana@web01:~$ type -a python3
python3 is /usr/local/bin/python3
python3 is /usr/bin/python3
```

`PATH` is a list of directories separated by colons. Two things follow from the search order.

- **"command not found"** means no directory in `PATH` contains a program of that name. The program may be installed somewhere that is not on the list.
- **The first match wins.** If two versions are installed, the one in the earlier directory runs. `type -a` shows all of them.

The current directory is not in `PATH`. To run a program in the directory you are in, give a path: `./deploy.sh`. This is a safety feature, so that a file named `ls` placed in a shared directory is not run by accident.

Add a directory by putting it in front of the existing value.

```bash example path-add readonly
export PATH="$HOME/bin:$PATH"
```

## The wrong version {prediction}

A developer installs a new version of a tool into `/opt/tool/bin` and adds the line `export PATH="$PATH:/opt/tool/bin"` to their settings. An older version exists in `/usr/bin`. They run the tool.

:::question path-order
Which version runs?
- [ ] The new one, since it was installed last :: The shell does not consider when a program was installed.
- [x] The old one in `/usr/bin`, since that directory comes earlier in `PATH` :: The new directory was added at the end. The search stops at the first match. Put the new directory at the front: `PATH="/opt/tool/bin:$PATH"`.
- [ ] Neither. The shell reports a conflict :: There is no conflict check. The first match is used silently.
:::

## Quoting

Before running a command, the shell rewrites the line: it replaces variables, expands wildcards and splits the result into words. Quotes control how much of that happens.

| Form | Variables expanded? | Wildcards and word splitting? |
| --- | --- | --- |
| No quotes | Yes | Yes |
| `"double quotes"` | Yes | No |
| `'single quotes'` | No | No |

```bash example quoting readonly
ana@web01:~$ file="my notes.txt"

ana@web01:~$ echo $file         # two words after expansion
my notes.txt
ana@web01:~$ cat $file          # cat gets TWO arguments
cat: my: No such file or directory
cat: notes.txt: No such file or directory

ana@web01:~$ cat "$file"        # one argument
(the file's contents)

ana@web01:~$ echo '$file'       # single quotes: nothing is expanded
$file
```

The rule that prevents most shell bugs: **put double quotes around every variable**. Write `"$file"`, never bare `$file`. An unquoted variable that contains a space becomes several arguments, and one that contains `*` is expanded into file names.

Use single quotes when the text must reach the program exactly as written, as with `grep`, `sed` and `awk` patterns.

A backslash removes the special meaning of the one character after it: `\$` is a dollar sign and `\ ` is a space.

## Command substitution

`$(command)` runs a command and puts its output in its place.

```bash example subst readonly
today=$(date +%F)
echo "Backup for $today"
files=$(ls | wc -l)
echo "There are $files entries here"
tar -czf "backup-$(date +%F).tar.gz" /srv/data
```

Quote it for the same reason as a variable: `"$(command)"`.

## Where settings live

Variables and other settings last only for the session. To keep them, put them in a file the shell reads when it starts. These files are called **dotfiles**, since their names start with a dot.

| File | Read when |
| --- | --- |
| `~/.bashrc` | An interactive Bash shell starts, such as a new terminal window |
| `~/.profile` or `~/.bash_profile` | You log in, including over SSH |
| `/etc/profile`, `/etc/environment` | For every user on the system |

A common arrangement is for the login file to load `~/.bashrc`, so that both kinds of shell get the same settings.

A changed file takes effect in new shells. To apply it to the current one, **source** it.

```bash example source readonly
echo 'export EDITOR=vim' >> ~/.bashrc     # add a setting
source ~/.bashrc                          # read it into this shell
```

`source file` runs the commands of a file in the current shell. That is the only way a file can change your current shell's variables. Running a script normally starts a child process, whose changes are lost when it ends.

## Aliases

An **alias** is a short name for a longer command. It lives in the same files.

```bash example alias readonly
alias ll='ls -lah'
alias gs='git status'
alias                  # list all aliases
```

Aliases are a personal convenience. They exist only in your interactive shell, so do not rely on them in scripts, and remember that another person's machine does not have yours.

## Configuration for applications

Environment variables are the standard way to give an application its settings, especially in containers and deployment pipelines. The same program then runs unchanged in test and production, and only its environment differs.

Two cautions.

- **A service does not read your dotfiles.** Something started by the system, a scheduler or a container has only the environment it was given. "It works in my terminal and not as a service" very often means a variable that exists only in your shell.
- **The environment is not private.** Root and the process's owner can read a running process's environment, and it is easy to print in a log. Secrets need more care than a line in `.bashrc`.

## Works in the terminal {prediction}

A script runs correctly when an engineer starts it by hand. Run from a scheduled job at night, it fails with `pg_dump: command not found`. The engineer's `~/.bashrc` contains `export PATH="/usr/lib/postgresql/16/bin:$PATH"`.

:::question cron-path
Why does the scheduled run fail?
- [ ] `pg_dump` is not installed :: It is installed. It runs from the engineer's terminal.
- [x] The scheduled job does not read `~/.bashrc`, so its `PATH` lacks that directory :: A job started by the system gets a minimal environment. Use the full path to the program in the script, or set `PATH` at the top of it.
- [ ] Scheduled jobs cannot run programs outside `/usr/bin` :: They can run anything, given a path that finds it.
:::

## Exercise: explain and fix {independent}

For each situation, say what is happening and what to change.

1. `backup_dir = /srv/backups` gives `backup_dir: command not found`.
2. A script contains `rm -rf $TARGET/*`. The variable `TARGET` was meant to be set by an earlier step that failed.
3. `echo "Total: $count_items"` prints `Total:` although `count` is set to 12. The intent was to print `12_items`.
4. A user runs a script that contains `export API_URL=https://staging.example.com`, and afterwards `echo $API_URL` in their terminal prints nothing.
5. `for f in $(ls *.txt)` breaks on a file named `annual report.txt`.
6. `grep $pattern file.txt` behaves oddly when `pattern` is `a*`.

## One possible answer {walkthrough}

1. **Spaces around `=`.** The shell reads `backup_dir` as a program name. Write `backup_dir=/srv/backups`.
2. **An empty variable.** With `TARGET` unset, the line becomes `rm -rf /*`, which tries to delete the whole system. Quote it and refuse to run when it is empty: `rm -rf "${TARGET:?}"/*`. The `:?` makes the shell stop with an error if the variable is unset or empty. The scripts module adds `set -u`, which catches every such case.
3. **The name runs on.** The shell looks for a variable called `count_items`. Use braces: `"Total: ${count}_items"`.
4. **A child process.** The script ran in its own process, and its `export` ended with it. To change the current shell, run it with `source script.sh`.
5. **Word splitting.** The output of `ls` is split on spaces, so the name becomes two words. Do not parse `ls`. Let the shell match the files: `for f in *.txt`, and use `"$f"` inside the loop.
6. **An unquoted variable.** The shell expands `a*` against the file names in the directory before `grep` runs. If files match, `grep` receives those names in place of the pattern. Write `grep "$pattern" file.txt`.

Four of the six come from one cause: text was expanded or split when it should have been passed through whole. Quoting variables removes most of this class of problem.
