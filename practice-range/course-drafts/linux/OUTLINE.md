# Linux and the shell

A reading course about working on a Linux system from the command line: files, pipes, permissions, processes, scripts, services, networking, SSH and diagnosing a machine. It has no code to run in the app and needs nothing installed. Every command is printed with what it does, and most with the output to expect.

Status: all 15 modules are written, built and registered as `course:linux`, content version 0.1.0-preview.1. Nobody has worked through it as a learner. Its commands were run in an Ubuntu container on 2026-11-27.

## Who it is for

Someone who has used a terminal a little or not at all, and needs to work on Linux servers, in containers and in pipelines. It is the base under the Docker and CI/CD courses, which assume the shell, permissions, processes and exit statuses.

## Modules

The manifest expands each key with `course:linux/module/`. Each module is one `module.md` in the Markdown format described at the top of `scripts/course-markdown.mjs`.

| Module | What the reader can do afterwards |
| --- | --- |
| 1. **shell** · The shell and commands | Read a command, look up what it does, and use its exit status. |
| 2. **files** · Files and directories | Read paths, and copy, move and delete files safely. |
| 3. **viewing** · Read and search files | Read long files, search with patterns, and find files. |
| 4. **pipes** · Pipes and redirection | Redirect output and errors, and build a pipeline. |
| 5. **text** · Process text | Sort, count, extract and replace text. |
| 6. **permissions** · Users and permissions | Fix a permission error without making files world-writable. |
| 7. **processes** · Processes and signals | Stop a process properly and keep a task running after logout. |
| 8. **environment** · Variables and the environment | Explain how PATH finds a program, and quote values correctly. |
| 9. **scripts** · Shell scripts | Write a script that stops on errors and cleans up. |
| 10. **packages** · Install and update software | Work out what is installed and from where. |
| 11. **services** · Services and logs | Control a service and find why it will not start. |
| 12. **network** · Network tools | Test a connection step by step with the standard tools. |
| 13. **ssh** · Remote access with SSH | Use keys, a config file and a jump host. |
| 14. **disk** · Disks, memory and load | Measure disk, inodes, memory and load, and read the numbers. |
| 15. **review** · Diagnose a broken server | Diagnose two broken servers and review a faulty script. |

The course has 196 steps, 30 questions and 154 examples (command listings, terminal sessions and diagrams). Its step text is about 19,000 words, and the examples carry much of the content.

## How a module is built

Each module explains a group of commands in short steps, with the commands and their output shown as examples. It asks two questions where the reader predicts what a command does, and ends with an exercise followed by one possible answer. The exercises can be done on paper, and a reader with a Linux machine can type them.

## Decisions

- D1: **A reading course.** A hands-on version would need the app to run a learner's commands in a disposable Linux environment and inspect the result, on Windows and macOS as well. That is a new runner and a container or virtual machine dependency. The course is written so that it can be followed in any Linux shell, including WSL or a container.
- D2: **Bash, on current mainstream distributions.** Commands are shown for the Debian family first, with the Red Hat and Alpine forms beside them where they differ. systemd is assumed for services.
- D3: **Dangerous commands are shown with their safe habit.** `rm -rf`, `find -delete`, `sed -i`, `chmod 777`, `kill -9` and `curl | sh` each appear with the preview step or the alternative. Several exercises are built around the damage one of them does.
- D4: **Strict mode from the first script.** The scripts module introduces `set -euo pipefail` and quoted variables as the default, and the review module shows a real loss caused by their absence.
- D5: **The tools, not the theory, for networking.** The Networking course explains addresses, DNS and TCP. This course's network module covers the commands and refers to that one.
- D6: **Security advice is marked as general guidance** in the SSH and packages modules.
- D7: **A final review module.** It adds no new ideas. It has two servers to diagnose and one script to review.

## Checks

`tests/course-linux.test.mjs` checks the built pack: 15 available modules, no exercises to run, every example read-only with a known fence and no line over 76 characters, every question shown with feedback on every choice, an exercise and a worked answer in every module, example domains only, and nothing that looks like a live credential. It also drives an enrollment through the course service.

## Verified on 2026-11-27

The commands in modules 1 to 15 were run in a fresh `ubuntu:24.04` container, and the course was corrected where the result differed.

- Confirmed as written: exit statuses, globbing, redirection and pipeline behaviour, the `sort`, `uniq`, `cut`, `awk`, `tr` and `sed` examples, permission checks between three users, signals, quoting and `PATH` behaviour, the scripts (also clean under `shellcheck`), `apt` and `dpkg` queries, the SSH key, config, jump host and host key cases, and the disk and inode commands.
- The three unit files pass `systemd-analyze verify`, and the flawed one is reported as not executable.
- An SSH server in the container refused a key when the home directory was mode 777, with the log line the review module quotes.
- Corrected: `cp -n` prints a warning on current Ubuntu, the `ss` and `ps` samples lacked columns, the `top` summary lacked its last field, `nc` needs `-w` to give up quickly, and the wording about `ExecStart` and `PATH`.
- The Alpine `apk` commands were run in `alpine:3.20`.

## Not verified

- **Anything that needs systemd running as PID 1.** `systemctl start`, `enable`, `status` and `journalctl` output could not be exercised in a container. The status and journal samples are illustrative.
- The Red Hat family commands (`dnf`, `firewall-cmd`), and `ufw`, `tmux`, `iotop` and `traceroute`.
- Commands that need a real second machine or a real disk: `lsblk` on hardware, `rsync` and `scp` between hosts, and the missing-route case.
- The sample outputs are still illustrative. They were composed to show one point each, and were checked for format against real output.
- Nobody has opened the course in the app.
- The text was reviewed by its author only.

## Scope

Outside this course: editors such as vim in any depth, kernel internals, filesystems and partitioning, LVM and RAID, SELinux and AppArmor, containers (see the Docker course), configuration management tools, and shells other than Bash.
