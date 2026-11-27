---
id: course:linux/module/packages
title: Install and update software
requires: []
outcomes: []
tasks: []
drills: []
---

Software on Linux is installed from packages that a package manager fetches, checks and tracks. This module covers how that works, how to keep a system updated, and how to work out what is installed and where it came from.

## Distributions and package managers

Linux itself is a kernel. A **distribution** combines it with tools, libraries and a way to install software. Ubuntu, Debian, Fedora, Red Hat Enterprise Linux and Alpine are distributions.

Each family has its own **package manager** and package format.

| Family | Examples | Package manager | Format |
| --- | --- | --- | --- |
| Debian | Debian, Ubuntu | `apt` | `.deb` |
| Red Hat | Fedora, RHEL, Rocky, Amazon Linux | `dnf` (older: `yum`) | `.rpm` |
| Alpine | Alpine, common in containers | `apk` | `.apk` |

The commands differ and the ideas are the same. This module shows `apt`, with the others beside it where it helps.

Find out what you are on before anything else.

```bash example os-release readonly
ana@web01:~$ cat /etc/os-release
NAME="Ubuntu"
VERSION="24.04.1 LTS (Noble Numbat)"
ID=ubuntu
ID_LIKE=debian

ana@web01:~$ uname -r          # the kernel version
6.8.0-45-generic
```

## Packages and repositories

A **package** is an archive holding a program's files together with a description: its name, version, what it depends on, and scripts to run at install and removal.

A **repository** is a server that holds thousands of packages with an index of them. The package manager is configured with a list of repositories. It downloads their indexes, and from those it knows what is available.

A package manager does four things that a manual download does not.

- **Resolves dependencies.** If a program needs three libraries, they are installed with it.
- **Verifies.** Packages and indexes are signed, and the signature is checked, so a tampered package is refused.
- **Tracks.** It records every file each package installed, so the package can be removed cleanly or checked later.
- **Updates.** It can upgrade everything installed in one step.

```text example repo readonly
   repositories (signed)              your machine

   +-------------------+   index     +----------------------+
   | main repository   | ----------> | list of what exists  |
   | security updates  |             +----------------------+
   | a vendor's own    |   packages  +----------------------+
   +-------------------+ ----------> | installed, and a     |
                                     | record of every file |
                                     +----------------------+
```

## The everyday commands

```bash example apt readonly
sudo apt update                  # refresh the index of what is available
apt search nginx                 # look for a package
apt show nginx                   # details: version, size, dependencies
sudo apt install nginx           # install
sudo apt remove nginx            # remove, keeping its configuration
sudo apt purge nginx             # remove, including configuration
sudo apt upgrade                 # upgrade everything installed
sudo apt autoremove              # remove dependencies nothing needs now
```

`apt update` does not update any software. It refreshes the list of available versions. `apt upgrade` is what installs newer versions. Running `install` or `upgrade` against a stale index is a common cause of "package not found" and "404" errors, especially in a container image built long ago.

| Task | Debian family | Red Hat family | Alpine |
| --- | --- | --- | --- |
| Refresh the index | `apt update` | (done automatically) | `apk update` |
| Install | `apt install x` | `dnf install x` | `apk add x` |
| Remove | `apt remove x` | `dnf remove x` | `apk del x` |
| Upgrade all | `apt upgrade` | `dnf upgrade` | `apk upgrade` |
| Search | `apt search x` | `dnf search x` | `apk search x` |

## Package not found {prediction}

In a fresh container based on a Debian image, the first command a user runs is `apt install curl`. It fails with "Unable to locate package curl".

:::question apt-update
What is the most likely cause?
- [ ] `curl` does not exist for Debian :: It is one of the most common packages there is.
- [x] The package index is empty or out of date, since `apt update` has not been run :: Small images ship without the index to save space. `apt` does not know what exists until it downloads the lists.
- [ ] The container has no network access :: That would fail with a connection error, not "unable to locate".
:::

## What is installed, and from where

```bash example query readonly
apt list --installed               # every installed package
dpkg -l | grep nginx               # is it installed, and which version
dpkg -L nginx                      # every file the package installed
dpkg -S /usr/sbin/nginx            # which package owns this file
apt-cache policy nginx             # installed and available versions,
                                   # and which repository each is from
which nginx                        # where the command lives
nginx -v                           # ask the program for its version
```

The last two answer a different question from the first four. `which` and `-v` tell you about the program that runs when you type the name. That may not be the packaged one, if a second copy was installed by hand and comes earlier in `PATH`.

When a program behaves unexpectedly, check both: which file runs, and which package, if any, owns that file.

## Keeping a system updated

Updates fix security flaws. A server that is never updated collects known, published vulnerabilities.

- **Security updates** should be applied promptly. Most distributions can install them automatically. On Debian and Ubuntu this is the `unattended-upgrades` package.
- **Some updates need a restart to take effect.** A new kernel runs only after a reboot. A service keeps using an old library until it is restarted. Ubuntu creates the file `/var/run/reboot-required` when a reboot is pending.
- **Distribution releases have an end of life.** After that date, no more security fixes arrive. Know the date for what you run, and plan the move to a newer release before it.

```bash example updates readonly
apt list --upgradable                # what would be upgraded
sudo apt update && sudo apt upgrade  # refresh, then upgrade
cat /var/run/reboot-required         # exists if a reboot is needed
sudo needrestart                     # which services use old libraries
```

## Versions and holding them

A distribution release ships one version of each package and, as a rule, keeps to it. Fixes are applied to that version, and it does not jump to a new major version. That stability is the point: an update should not break what works.

It also means the packaged version of a tool may be old. There are several ways to get a newer one, each with a cost.

- **The vendor's own repository.** Many projects publish one. You add it and its signing key, and the package manager handles the rest. This is the best option where it exists.
- **A version manager** for a language runtime, which installs versions under your home directory.
- **A container**, which carries its own version and leaves the host alone.
- **Building from source,** which nothing tracks and nothing updates.

To stop a package from being upgraded, hold it.

```bash example hold readonly
sudo apt-mark hold postgresql-16       # keep this version
apt-mark showhold                      # list held packages
sudo apt-mark unhold postgresql-16
```

A held package also misses security fixes, so hold with a reason and review the list.

## Adding a repository is a matter of trust

A repository can install anything on your system as root. Its packages run install scripts with full rights. Adding one is the same decision as giving its owner administrator access.

- Add only repositories from sources you have reason to trust.
- Use the repository's signing key, so that packages are verified.
- Prefer the distribution's own packages where they are good enough.

The same caution applies to the common instruction "run this to install", which pipes a script from a web address straight into a shell.

```bash example curl-sh readonly
# runs whatever that server sends, as you, or as root with sudo
curl -fsSL https://example.com/install.sh | sh

# better: download it, read it, then run it
curl -fsSL https://example.com/install.sh -o install.sh
less install.sh
sh install.sh
```

Reading an install script takes a few minutes, and it shows what it will change on your system. This is general guidance, not a statement of any organization's policy.

## Other ways software arrives

Not everything comes from the system package manager.

| Source | Example | Tracked by |
| --- | --- | --- |
| System packages | `apt install nginx` | The package manager |
| Language package managers | `pip`, `npm`, `gem`, `cargo` | That tool, per project or per user |
| Universal packages | `snap`, `flatpak` | Their own tools |
| A downloaded binary | A file copied to `/usr/local/bin` | Nothing |
| Source code | `make install` | Nothing |
| Containers | An image | The container runtime |

Problems begin when these overlap. Installing a library with the system package manager and again with a language's own tool gives two copies, and which one a program picks up depends on search order. Keep them apart: system packages for the system, and a project's own dependencies inside the project or in a container.

By convention, software installed by hand goes under `/usr/local` or `/opt`, so that it never collides with files the package manager owns.

## Two of the same {prediction}

A server has a tool installed from the distribution's package at `/usr/bin/tool`, version 2.1. Later someone installs version 3.0 by hand into `/usr/local/bin/tool`. `PATH` is `/usr/local/bin:/usr/bin:/bin`. A month later, `apt upgrade` updates the package to version 2.2.

:::question two-copies
Which version runs when someone types `tool`?
- [ ] 2.2, since it was updated most recently :: The shell does not consider which file is newest.
- [x] 3.0, since `/usr/local/bin` comes first in `PATH` :: The hand-installed copy still wins the search. The package manager updated its own file and knows nothing of the other. The 3.0 copy will also never receive a security update.
- [ ] Neither. The package manager removes the conflicting copy :: It only manages files it installed itself.
:::

## Exercise: work out what is going on {independent}

You are asked to look at a server. Write the commands you would run for each question, and say what you would conclude.

1. Which distribution and release is this, and is it still supported?
2. Is `openssl` installed, at what version, and from which repository?
3. A colleague says `node --version` prints `v14.21.3`, although they "installed version 20 last week". How do you find out why?
4. Are security updates outstanding, and is a reboot pending?
5. Someone wants to install a tool by running `curl ... | sudo bash` from a blog post. What do you suggest?

## One possible answer {walkthrough}

```bash example pkg-answer readonly
# 1
cat /etc/os-release

# 2
dpkg -l openssl
apt-cache policy openssl

# 3
type -a node
ls -l "$(which node)"
dpkg -S "$(which node)"
echo "$PATH"

# 4
sudo apt update && apt list --upgradable
ls /var/run/reboot-required
```

**Conclusions**

1. The file gives the name and version. Compare the version with the distribution's published end-of-life date. If that date has passed, upgrading the release is the first job, since nothing else will receive fixes.
2. `dpkg -l` shows whether it is installed and its version. `apt-cache policy` shows which repository that version came from and whether a newer one is available.
3. `type -a` lists every `node` on the `PATH`, in search order. Almost certainly there are two: the old one in an earlier directory, and version 20 somewhere later, or in a directory that is not on the `PATH` at all for this user or service. `dpkg -S` shows whether the file that runs belongs to a package. The fix is to remove the old one or to put the right directory first.
4. The list shows what would be upgraded. If the reboot file exists, an earlier update is waiting for a restart, and the machine is still running the old kernel or libraries.
5. Download the script and read it first. Look for an official package or the vendor's repository, which would also deliver updates. If the script is the only way, run it in a test machine or a container before a server, and avoid `sudo` unless the script truly needs it. This is general guidance, not a statement of any organization's policy.
