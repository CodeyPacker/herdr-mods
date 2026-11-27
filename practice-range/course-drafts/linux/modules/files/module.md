---
id: course:linux/module/files
title: Files and directories
requires: []
outcomes: []
tasks: []
drills: []
---

Everything on a Linux system is arranged in one tree of directories. This module covers how to read a path, how to move around, and how to create, copy, move and delete files without losing any.

## One tree

Linux has a single directory tree. It starts at the **root directory**, written `/`. Every file and every directory sits somewhere beneath it. There are no drive letters. A second disk or a USB stick appears as a directory somewhere in the same tree.

A few directories have the same purpose on every system.

| Directory | Holds |
| --- | --- |
| `/home` | Each user's own files, in `/home/<name>` |
| `/etc` | System-wide configuration files |
| `/var` | Data that changes: logs in `/var/log`, databases, caches |
| `/tmp` | Temporary files, removed at restart |
| `/usr` | Installed programs and libraries |
| `/bin`, `/sbin` | Essential commands |
| `/opt` | Software installed separately from the system's packages |
| `/root` | The administrator's home directory |
| `/dev`, `/proc`, `/sys` | Not real files. Windows onto devices and the running system |

Knowing these saves time. A configuration file is nearly always under `/etc`, and a log under `/var/log`.

```text example tree readonly
   /
   +-- etc/
   |     +-- hostname
   |     +-- ssh/
   |           +-- sshd_config
   +-- home/
   |     +-- ana/
   |           +-- notes.txt
   |           +-- projects/
   |                 +-- site/
   +-- var/
   |     +-- log/
   |           +-- syslog
   +-- tmp/
```

## Paths

A **path** says where a file is. There are two kinds.

An **absolute path** starts at the root, so it begins with `/`. It means the same thing wherever you are: `/home/ana/notes.txt`.

A **relative path** starts from the directory you are in, called the **working directory**. It does not begin with `/`: `projects/site`.

Three short names help.

- `.` is the current directory.
- `..` is the parent directory, one level up.
- `~` is your home directory.

```bash example paths readonly
pwd                      # print the working directory
/home/ana

cd projects/site         # relative: down two levels from here
cd ..                    # up one level, to /home/ana/projects
cd /var/log              # absolute: the same from anywhere
cd ~                     # home. Plain "cd" does the same
cd -                     # back to the directory you were in before
```

Most "No such file or directory" errors come from a relative path used from the wrong directory. When unsure, run `pwd`.

## Listing

`ls` lists a directory. Its long format shows what each entry is.

```bash example ls readonly
ana@web01:~$ ls -la
drwxr-xr-x  4 ana  ana  4096 Mar  4 13:50 .
drwxr-xr-x  5 root root 4096 Jan 12 09:14 ..
-rw-------  1 ana  ana   812 Mar  4 13:10 .bash_history
-rw-r--r--  1 ana  ana  3771 Jan 12 09:14 .bashrc
-rw-r--r--  1 ana  ana   240 Mar  3 16:22 notes.txt
drwxr-xr-x  3 ana  ana  4096 Feb 20 11:05 projects

# first character: d = directory, - = ordinary file, l = link
# then permissions, link count, owner, group, size, date, name
```

A name that starts with a dot is **hidden**. `ls` leaves it out unless you add `-a`. Hidden files are mostly configuration, such as `.bashrc`. They are not protected in any way. They are only out of sight.

Useful options: `-l` long format, `-a` include hidden, `-h` readable sizes, `-t` newest first, `-r` reverse the order.

## Which directory {prediction}

A user's working directory is `/home/ana/projects`. They run `cd ../../bilal/docs`.

:::question relative
Where do they end up?
- [ ] `/home/ana/projects/bilal/docs` :: Each `..` goes up a level first. The path does not continue downwards from the start.
- [x] `/home/bilal/docs` :: The first `..` leads to `/home/ana`, the second to `/home`. Then down into `bilal` and `docs`.
- [ ] `/bilal/docs` :: Two levels up from `/home/ana/projects` is `/home`, not the root.
:::

## Creating

```bash example create readonly
mkdir reports                 # make a directory
mkdir -p data/2025/march      # make it and any missing parents
touch notes.txt               # make an empty file, or update its time
```

Without `-p`, `mkdir data/2025/march` fails if `data/2025` does not exist. With it, the whole chain is created, and an existing directory is not an error. That makes `mkdir -p` the form to use in scripts.

## Copying and moving

`cp` copies. `mv` moves, and it is also how a file is renamed.

```bash example copy-move readonly
cp notes.txt notes.bak            # copy a file
cp notes.txt reports/             # copy into a directory, same name
cp -r projects projects-backup    # copy a directory and its contents

mv notes.txt ideas.txt            # rename
mv ideas.txt reports/             # move into a directory
mv reports/ archive/              # move or rename a directory
```

Both overwrite an existing destination without asking. Copying `a.txt` onto `b.txt` replaces `b.txt`, and its old contents are gone. Add `-i` to be asked first, or `-n` to never overwrite. On recent systems `cp -n` still works and prints a warning that suggests the newer spelling, `--update=none`.

A trailing slash on a destination, as in `reports/`, makes your meaning clear: this is a directory to put things in. Without it, if `reports` does not exist, `mv ideas.txt reports` renames the file to `reports`.

## Deleting

`rm` deletes files. There is no recycle bin. A deleted file is gone.

```bash example delete readonly
rm notes.bak                 # delete a file
rm -i *.log                  # ask before each one
rmdir empty-dir              # delete a directory, only if it is empty
rm -r old-project            # delete a directory and everything in it
```

`rm -r` removes a whole tree. With `-f` added, it also suppresses every question and error. `rm -rf` followed by the wrong path is the classic way to destroy a system or a project.

Habits that prevent it:

- Run `ls` with the same path first, and look at what it matches.
- Never run `rm -rf` on a path built from a variable that might be empty. `rm -rf "$DIR/"` with `DIR` unset becomes `rm -rf /`.
- Prefer moving things to a holding directory, and delete later.
- Do not use `sudo` for a delete unless you must.

## Wildcards

The shell expands certain characters into a list of matching file names before the command runs. This is called **globbing**.

| Pattern | Matches |
| --- | --- |
| `*` | Any run of characters, including none |
| `?` | Exactly one character |
| `[abc]` | One of the listed characters |
| `[0-9]` | One character in the range |

`*.log` matches every name ending in `.log`. `report-202?.csv` matches `report-2024.csv` and `report-2025.csv`.

The shell does the expansion, not the command. `rm *.log` becomes `rm a.log b.log c.log` before `rm` starts. So you can preview any pattern safely with `echo` or `ls`.

A `*` does not match hidden files, and a pattern that matches nothing is passed to the command unchanged.

```bash example glob readonly
ana@web01:~/logs$ ls
app.log  app.log.1  db.log  notes.txt

ana@web01:~/logs$ echo *.log
app.log db.log

ana@web01:~/logs$ echo app*
app.log app.log.1
```

## A space in the wrong place {prediction}

Someone means to delete every file ending in `.tmp` in the current directory. They type `rm -f * .tmp`, with a space after the star by mistake.

:::question glob-space
What does the command do?
- [ ] It deletes the `.tmp` files, as intended :: The space made two patterns out of one.
- [x] It deletes every non-hidden file in the directory, and then looks for a file named `.tmp` :: `*` alone matches everything. The shell expands it to all the files and passes them to `rm`. With `-f` there is no question and no error.
- [ ] It fails, since `* .tmp` is not a valid pattern :: Both words are valid arguments. The first is a pattern that matches every file.
:::

## Links

A **symbolic link** (symlink) is a small file that points at another path. Opening it opens the target.

```bash example links readonly
ln -s /srv/releases/v42 /srv/current      # make "current" point at v42

ls -l /srv/current
lrwxrwxrwx 1 root root 17 Mar  4 14:00 /srv/current -> /srv/releases/v42
```

Links are used to give a stable name to something that changes, such as "the current release". If the target is removed, the link stays and points at nothing. That is a broken link, and opening it reports "No such file or directory" although `ls` shows the link.

## Exercise: tidy a directory {independent}

Your working directory is `/home/ana/work`. It contains:

```text
draft v1.txt   draft v2.txt   final.txt   notes.md
img1.png  img2.png  img10.png
old/          (a directory with 300 files)
.env          (a hidden file)
```

Write the commands for each task. Preview anything destructive first.

1. Make a directory `images` and move the three PNG files into it.
2. Make `archive/2025/drafts`, and move the two drafts there.
3. Copy `final.txt` to `final.bak`, without overwriting an existing backup.
4. Delete the `old` directory.
5. Say whether `rm *` would remove `.env`, and whether `img?.png` matches all three images.

## One possible answer {walkthrough}

```bash example tidy-answer readonly
# 1
mkdir images && mv img*.png images/

# 2
mkdir -p archive/2025/drafts
mv "draft v1.txt" "draft v2.txt" archive/2025/drafts/
#    or, with a pattern:   mv draft*.txt archive/2025/drafts/

# 3
cp -n final.txt final.bak

# 4
ls old | head          # look first
rm -r old
```

**Notes**

- In task 1, `&&` means nothing is moved if the directory could not be made. The trailing slash on `images/` means that, if the directory were missing, `mv` would fail and not rename a file to `images`.
- In task 2, the names contain spaces, so they are quoted. The pattern `draft*.txt` also works, since the shell passes each matched name as one argument, spaces included.
- In task 3, a recent system prints a warning for `cp -n` and still does the right thing. `cp --update=none` is the newer spelling, and older systems do not have it.
- In task 4, plain `rm -r` is enough. Adding `-f` gains nothing here and removes the warnings that could save you.

**Task 5.** `rm *` does not remove `.env`, since `*` does not match hidden files. And `img?.png` matches `img1.png` and `img2.png` only. The `?` stands for exactly one character, and `img10.png` has two there. Use `img*.png`.
