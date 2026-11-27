---
id: course:linux/module/permissions
title: Users and permissions
requires: []
outcomes: []
tasks: []
drills: []
---

Every file belongs to a user and carries rules about who may read, change or run it. "Permission denied" is the most common error on Linux, and it always has a specific cause. This module covers how to read those rules, how to change them, and how administrator access works.

## Users and groups

Linux is a multi-user system. Every process runs as some **user**, and every file is owned by one.

A user has a name and a numeric ID. A **group** is a named set of users, used to give several people the same access. Each user has one primary group and may belong to others.

One user is special. **root**, with user ID 0, is the administrator. The permission rules do not apply to root. It can read, change and delete anything.

Many users are not people. Services run as their own accounts, such as `www-data` or `postgres`, so that a fault in one service cannot touch another's files.

```bash example whoami readonly
ana@web01:~$ whoami
ana
ana@web01:~$ id
uid=1001(ana) gid=1001(ana) groups=1001(ana),27(sudo),998(docker)
ana@web01:~$ groups
ana sudo docker
```

## Reading permissions

`ls -l` shows the rules for each file in its first column.

```text example mode readonly
   -rw-r--r--  1 ana  staff  240 Mar  3 16:22 notes.txt

   -   rw-   r--   r--        ana     staff
   |    |     |     |          |        |
   |    |     |     |        owner    group
   |    |     |     +-- others:  read only
   |    |     +-------- group:   read only
   |    +-------------- owner:   read and write
   +------------------- type: - file, d directory, l link
```

There are three sets of three letters, for three classes of user.

- **Owner** (user): the user who owns the file.
- **Group**: members of the file's group.
- **Others**: everyone else.

In each set, `r` is read, `w` is write and `x` is execute. A dash means that permission is not given.

The system checks one class only, the first that applies. If you are the owner, the owner's set is used and the other two are ignored, even if they would allow more.

## What the letters mean

The three permissions mean different things for a file and for a directory. The directory meanings surprise people.

| | On a file | On a directory |
| --- | --- | --- |
| `r` read | View the contents | List the names inside it |
| `w` write | Change the contents | Create, rename and delete entries in it |
| `x` execute | Run it as a program | Enter it, and reach the files inside |

Two consequences are worth learning by heart.

- **Deleting a file depends on the directory**, not on the file. To delete a file you need write permission on the directory that holds it. A file you cannot read or write can still be deleted by you if you can write to its directory.
- **To reach a file, you need `x` on every directory in its path.** A world-readable file inside a directory you cannot enter is unreachable.

## Numbers for permissions

Permissions are often written as three digits. Each digit is the sum of the values for one class: read is 4, write is 2, execute is 1.

| Digit | Letters | Meaning |
| --- | --- | --- |
| 7 | `rwx` | 4 + 2 + 1 |
| 6 | `rw-` | 4 + 2 |
| 5 | `r-x` | 4 + 1 |
| 4 | `r--` | 4 |
| 0 | `---` | nothing |

So `644` is `rw-r--r--`: the owner reads and writes, and everyone else reads. `755` is `rwxr-xr-x`: the owner does anything, and everyone else may read and run.

| Mode | Typical use |
| --- | --- |
| `644` | Ordinary files |
| `755` | Programs, scripts and directories |
| `600` | Private files, such as keys |
| `700` | Private directories |
| `640` | Configuration with secrets, readable by a service's group |

## Changing permissions

`chmod` changes a file's permissions. It accepts numbers or letters.

```bash example chmod readonly
chmod 644 notes.txt          # set exactly: rw-r--r--
chmod 600 id_ed25519         # private: rw-------
chmod +x deploy.sh           # add execute for everyone
chmod u+x deploy.sh          # add execute for the owner only
chmod g-w shared.txt         # remove write from the group
chmod o= secret.txt          # remove everything from others
chmod -R g+rX project/       # recursive. X: execute on directories only
```

In the letter form, `u` is the owner, `g` the group, `o` others and `a` all three. `+` adds, `-` removes and `=` sets exactly.

Only the owner of a file, or root, can change its permissions.

## Reading a mode {prediction}

A file is listed as `-rwxr-x--- 1 deploy ops 812 Mar 4 release.sh`. The user `ana` is a member of the group `ops`. The user `bilal` is not.

:::question read-mode
Who can run the script?
- [ ] Only `deploy` :: The group set, `r-x`, also includes execute.
- [x] `deploy` and `ana` :: The owner has `rwx`. Members of `ops` have `r-x`, which includes execute. Others have `---`, so `bilal` cannot even read it.
- [ ] Everyone :: The last three characters are `---`. Others have no access.
:::

## Changing ownership

`chown` changes who owns a file, and `chgrp` changes its group. Changing a file's owner needs root.

```bash example chown readonly
sudo chown www-data /var/www/upload         # change the owner
sudo chown www-data:www-data /var/www/upload   # owner and group
sudo chown -R app:app /srv/app              # a whole tree
sudo chgrp ops /srv/shared                  # only the group
```

A very common fault is a file owned by the wrong user. A service runs as `www-data` and cannot write to a directory owned by `root`. The fix is to give that one directory to the service's user. It is not to make it writable by everyone.

## Becoming root with sudo

Working as root all the time is dangerous, since one mistyped command can destroy the system. The normal arrangement is to log in as an ordinary user and use `sudo` to run single commands as root.

```bash example sudo readonly
sudo systemctl restart nginx       # run one command as root
sudo -u postgres psql              # run a command as another user
sudo -l                            # list what you are allowed to run
sudo -i                            # open a root shell (use sparingly)
```

`sudo` asks for your own password, checks a rule file to see whether you are allowed, runs the command and records it in a log. Who did what as root can be traced.

Use it deliberately. If a command fails with "Permission denied", find out why before reaching for `sudo`. Often the right fix is a change of ownership or group. Running everything with `sudo` also creates files owned by root, which then cause permission errors for the ordinary user later.

One trap: `sudo` applies to the command, not to a redirection. In `sudo echo "x" > /etc/file`, the shell opens `/etc/file` as you, before `sudo` runs, and it fails. Use `echo "x" | sudo tee /etc/file`.

## Why 777 is the wrong fix

`chmod 777` gives read, write and execute to everyone. It makes "Permission denied" go away, which is why it is so often suggested. It does so by removing the protection entirely.

On a server, "everyone" includes every service account. If a web application is broken into, the attacker runs as its user. With correct permissions they can touch only that application's files. With 777 scattered about, they can change other applications, scripts that root runs, and configuration.

The correct approach is to find out which user needs access, and grant that user or its group the least that works.

1. Which user is the process running as? (`ps` shows it.)
2. Who owns the file, and what is its mode? (`ls -l`.)
3. Change the owner or group, or add one permission for that class.

```text example least readonly
   the service runs as "app" and must write to /srv/app/uploads

   WRONG                               RIGHT

   chmod -R 777 /srv/app               chown app:app /srv/app/uploads
                                       chmod 750 /srv/app/uploads

   every user and service can          only "app" writes, its group
   change everything in it             reads, and nobody else gets in
```

## Defaults for new files

New files get their permissions from a setting called the **umask**, which removes permissions from the starting values. The usual umask, `022`, gives new files `644` and new directories `755`. A umask of `077` makes new files private, `600` and `700`.

You rarely change it. Knowing it exists explains why a file you created came out with the permissions it has.

## Three special bits

A few modes have a fourth digit or an unusual letter. You need to recognise them.

- **setuid** (`s` in the owner's execute position). The program runs as the file's owner, not as the user who started it. `passwd` is setuid root, so that an ordinary user can change their own password. A setuid root program with a flaw gives root access, so there should be very few.
- **setgid on a directory.** New files inside inherit the directory's group. Useful for shared project directories.
- **The sticky bit** (`t` on a directory). Only a file's owner may delete it, even though everyone can write to the directory. `/tmp` has it.

## Cannot write {prediction}

A deploy script runs as the user `deploy` and fails with "Permission denied" when writing to `/srv/app/releases`. `ls -ld /srv/app/releases` shows `drwxr-xr-x 4 root root`.

:::question cannot-write
What is the cause, and the right fix?
- [ ] The script lacks execute permission. Run `chmod +x` on it :: The script ran. It failed when it tried to write.
- [x] The directory is owned by root and only its owner may write. Give the directory to `deploy` with `chown` :: `deploy` falls in "others", which has `r-x`: it may list and enter, and may not create files. Changing the owner grants exactly what is needed.
- [ ] Permissions are too strict. Run `chmod 777` on it :: That would work, and it would let every user and service on the machine write there.
:::

## Exercise: fix the access {independent}

A web application runs as the user `webapp`. Its files are under `/srv/webapp`. Three engineers in the group `devs` deploy it. You see this.

```text example access-listing readonly
   drwxrwxrwx  root    root   /srv/webapp
   -rwxrwxrwx  root    root   /srv/webapp/config/database.conf
   drwxr-xr-x  root    root   /srv/webapp/uploads
   -rw-r--r--  ana     ana    /srv/webapp/bin/start.sh
   -rw-rw-rw-  webapp  webapp /srv/webapp/logs/app.log
```

The application reports that it cannot save uploaded files, and `start.sh` fails with "Permission denied" when run. `database.conf` contains the database password.

List what is wrong with each of the five lines. Then write the commands to set sensible ownership and modes.

## One possible answer {walkthrough}

**Problems**

1. `/srv/webapp` is `777`: any user or service can create and delete entries in it.
2. `database.conf` is `777`: every account on the machine can read the database password, and can replace the file.
3. `uploads` is owned by root with `755`. The application, running as `webapp`, is in "others" and cannot create files. This is the upload failure.
4. `start.sh` has no execute bit, which is the "Permission denied". It also belongs to one person, so the other engineers cannot update it.
5. `app.log` is writable by everyone, so any account can alter or erase the log.

**Commands**

```bash example access-answer readonly
# the tree belongs to the app, with the deploy group
sudo chown -R webapp:devs /srv/webapp

# directories: owner and group may enter and write, others nothing
sudo chmod 770 /srv/webapp /srv/webapp/uploads

# the secret: owner reads and writes, group reads, others nothing
sudo chmod 640 /srv/webapp/config/database.conf

# the script: owner and group may run it
sudo chmod 750 /srv/webapp/bin/start.sh

# the log: only the app writes, the group may read
sudo chmod 640 /srv/webapp/logs/app.log
```

**Notes**

- Not one of the fixes is `777`. Each grants a named user or group the least that works.
- Whether `devs` should be able to read `database.conf` is a decision. If engineers do not need the production password, make it `600`.
- A tighter design would make the code read-only for the `webapp` user and writable only by the deploy process, with `uploads` and `logs` as the only places the running application can write. An application that cannot change its own code is harder to take over.
