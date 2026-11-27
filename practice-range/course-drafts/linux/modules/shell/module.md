---
id: course:linux/module/shell
title: The shell and commands
requires: []
outcomes: []
tasks: []
drills: []
---

A shell is a program that reads what you type and runs other programs for you. Nearly every server is managed through one. This module covers what a command is made of, how to find out what a command does, and how a command reports success or failure.

## What a shell is

Three words get mixed up.

- A **terminal** is the window that shows text and takes your typing.
- A **shell** is the program running inside it that reads each line and acts on it.
- A **command** is one line you give the shell, usually the name of a program and some instructions for it.

The most common shell on Linux is **Bash**. This course uses it. Other shells, such as Zsh, behave the same for everything here unless stated.

A shell waits, showing a **prompt**. You type a line and press Enter. The shell runs it, shows any output and prints the prompt again.

```bash example prompt readonly
ana@web01:~$ date
Tue Mar  4 14:02:11 UTC 2025
ana@web01:~$

# ana     the user you are logged in as
# web01   the name of the machine
# ~       the current directory (~ is your home directory)
# $       an ordinary user (# here would mean the administrator)
```

## The parts of a command

A command line is a list of words separated by spaces. The first word is the program to run. The rest are passed to that program.

Those remaining words are of two kinds.

- **Options** (also called flags) change how the program behaves. They start with a dash.
- **Arguments** say what the program should act on, such as a file name.

```bash example parts readonly
ls -l --all /var/log

# ls         the program: list a directory's contents
# -l         a short option: long format, one entry per line
# --all      a long option: include hidden entries
# /var/log   an argument: the directory to list
```

Short options are one dash and one letter, and several can be joined: `ls -la` means `ls -l -a`. Long options are two dashes and a word. Many options have both forms, and `-a` and `--all` are the same thing.

Some options take a value: `head -n 20 file.txt` shows the first 20 lines.

Linux is case-sensitive. `ls` and `LS` are different names, and so are `Notes.txt` and `notes.txt`.

## Spaces separate words

Since a space ends a word, a file name with a space in it is read as two arguments. Wrap such a name in quotes, or put a backslash before the space.

```bash example spaces readonly
cat my notes.txt        # two arguments: "my" and "notes.txt"
cat "my notes.txt"      # one argument
cat my\ notes.txt       # one argument
```

This is the cause of a great many confusing errors. Quoting is covered properly in the module on variables.

## Finding out what a command does

Nobody remembers every option. The system documents itself, and using that documentation is a normal part of working.

- `man ls` opens the **manual page** for a command. Move with the arrow keys or the space bar, search by typing `/` and a word, and leave with `q`.
- `ls --help` prints a short summary of options, for most commands.
- `type ls` says what kind of thing a name is, and where the program lives.

A manual page is a reference. It is dense. Read the one-line description at the top, then search inside it for the word you need.

```bash example help readonly
man grep            # the full manual for grep. Press q to quit
grep --help         # a short list of options
type grep           # grep is /usr/bin/grep
man -k compress     # search all manual pages for a word
```

## Which word is which {prediction}

Look at this command: `tail -n 50 -f /var/log/app.log`

:::question parts
How does the shell split it?
- [ ] One program, `tail -n`, with three arguments :: The program name is only the first word. `-n` is an option passed to it.
- [x] The program `tail`, the option `-n` with the value 50, the option `-f`, and one argument, the file :: The first word is the program. Words that start with a dash are options, and `-n` takes the next word as its value.
- [ ] Two programs, `tail` and `-f`, run one after the other :: Nothing here separates two commands. Everything after `tail` is handed to it.
:::

## Moving around the line

A few keys save a great deal of typing.

| Key | Does |
| --- | --- |
| Tab | Completes a command or file name. Press twice to list the choices |
| Up and Down | Step through earlier commands |
| Ctrl+R | Search the history as you type |
| Ctrl+A, Ctrl+E | Jump to the start or end of the line |
| Ctrl+C | Stop the running command |
| Ctrl+L | Clear the screen |
| Ctrl+D | End input. At an empty prompt, this logs you out |

Use Tab constantly. It is faster, and it catches mistakes: if a name does not complete, it probably does not exist.

`history` lists the commands you have run. Be aware that anything typed on a command line is saved there, which is one reason never to type a password as part of a command.

## Success and failure

Every program ends by returning a number to the shell, called its **exit status** (or exit code).

- `0` means success.
- Any other number, from 1 to 255, means some kind of failure. The meaning of each number depends on the program.

The shell keeps the status of the last command in a special variable, `$?`.

```bash example status readonly
ana@web01:~$ ls /etc/hostname
/etc/hostname
ana@web01:~$ echo $?
0

ana@web01:~$ ls /no/such/file
ls: cannot access '/no/such/file': No such file or directory
ana@web01:~$ echo $?
2
```

The exit status is how scripts and other programs know whether a step worked. It matters more than the text on the screen. A program can print a message and still succeed, or print nothing and fail.

## Chain commands on their result

The shell can decide whether to run a command from the status of the one before.

- `a && b` runs `b` only if `a` succeeded.
- `a || b` runs `b` only if `a` failed.
- `a ; b` runs `b` afterwards, whatever happened.

```bash example chain readonly
mkdir build && cd build        # enter the directory only if it was made
ping -c 1 db01 || echo "db01 is not reachable"
make test ; echo "finished"    # the echo runs either way
```

The difference between `&&` and `;` is important. `cd /tmp/work ; rm -rf *` deletes everything in whatever directory you are in if the `cd` fails. With `&&`, the delete does not run.

## Chained with a semicolon {prediction}

Someone types `cd /srv/app/cache ; rm -rf *` to clear a cache. The directory `/srv/app/cache` does not exist, and their current directory is `/srv/app`.

:::question semicolon
What happens?
- [ ] Nothing, since the directory does not exist :: The `cd` fails. The command after the semicolon runs anyway.
- [x] The `cd` fails, and `rm -rf *` then deletes everything in `/srv/app` :: A semicolon runs the next command whatever the first one did. With `&&`, the failed `cd` would have stopped the line.
- [ ] The shell asks for confirmation before deleting :: `rm -rf` does not ask. The `f` means force.
:::

## Reading an error message

When a command fails, it usually says why, in a fixed shape: the program's name, what it was acting on, and the reason.

| Message | Usually means |
| --- | --- |
| `command not found` | No program of that name on this system, or a typing error |
| `No such file or directory` | The path is wrong, or you are in a different directory from the one you think |
| `Permission denied` | The file exists and your user may not do this to it |
| `Is a directory` | You gave a directory to a command that wants a file |
| `Not a directory` | Part of the path is a file |

Read the whole message before trying again. Most of them say exactly what is wrong.

## Exercise: read the commands {independent}

For each line, name the program, the options and the arguments. Say what you expect it to do, using only what this module covered, and say how you would find out the rest.

1. `ls -lh /var/log`
2. `cp -r "Project Files" backup`
3. `grep -i error app.log && echo found`
4. `mkdir reports ; cd reports`
5. `sort -n -r scores.txt`

Then say what is risky about line 4, and rewrite it.

## One possible answer {walkthrough}

1. **Program** `ls`. **Options** `-l` and `-h`, joined. **Argument** `/var/log`. It lists that directory in long format. What `-h` does is not something this module covered. `man ls` or `ls --help` says that it prints sizes in readable units such as K and M.
2. **Program** `cp`. **Option** `-r`. **Arguments** `Project Files` and `backup`. The quotes make the first name one argument, though it contains a space. It copies something to `backup`. The manual says `-r` copies a directory and everything in it.
3. **Program** `grep`, with the option `-i` and two arguments: the word to look for and the file. Then `&&` runs `echo found` only if `grep` succeeded. `grep` succeeds when it finds a match, so "found" is printed only when the word is in the file.
4. Two commands. `mkdir` makes a directory, and then `cd` enters it.
5. **Program** `sort`, with options `-n` and `-r` and one argument. The manual says `-n` sorts by number and `-r` reverses, so the largest number comes first.

**Line 4.** With a semicolon, `cd reports` runs even if `mkdir` failed. Here that is mostly harmless: `cd` fails too, or enters an older directory of the same name. The habit is what is dangerous, since the next command in such a chain may delete or overwrite. Write `mkdir reports && cd reports`, so the second step depends on the first.
