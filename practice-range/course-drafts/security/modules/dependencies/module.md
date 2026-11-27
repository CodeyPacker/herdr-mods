---
id: course:security/module/dependencies
title: Dependencies and the supply chain
requires: []
outcomes: []
tasks: []
drills: []
---

Most of the code in an application was written by someone else. This module covers the risks that come with that, how to keep third-party code current, and how to protect the path from source code to running software.

The advice here is general guidance, not any organization's policy.

## Most of your code is not yours

A typical application's own code is a small fraction of what runs. The rest is libraries, their libraries, a language runtime, a base container image and an operating system.

A package you install is a **direct dependency**. The packages it needs in turn are **transitive dependencies**. A project that lists 40 packages commonly installs over a thousand.

Every one of them runs with the full rights of your application. It can read your environment, your files and your secrets, and it can make network requests. Installing a package means trusting its authors, and the authors of everything it depends on, with all of that.

```text example tree readonly
   your application
   |
   +-- web-framework                  direct
   |     +-- http-parser              transitive
   |     +-- template-engine          transitive
   |           +-- string-utils       transitive
   +-- database-driver                direct
   |     +-- connection-pool          transitive
   +-- image-library                  direct
         +-- compression-lib          transitive
         +-- ... and so on

   3 packages chosen, many more installed. All of it runs as your app.
```

## Known vulnerabilities

Flaws are found in libraries constantly. When one is published, it gets an identifier, a **CVE** number, and usually a fixed version is released.

From that moment the flaw is public knowledge. Attackers scan the internet for applications still running the old version. Many large breaches used a flaw whose fix had been available for weeks or months and had not been applied.

So the first job is to know when something you use has a known flaw.

- **Dependency scanners** compare the versions you have installed against databases of known vulnerabilities and report matches. Most ecosystems have one built in or freely available, and code hosting platforms run them automatically.
- **Run them in the pipeline** on every build, and on a schedule, since a new flaw can be published for code that has not changed.

A scanner produces noise. Not every finding matters to you: the vulnerable function may never be called, or the package may be used only in development. Judge findings by severity and by whether the flaw is reachable, and have a clear rule for how fast each level must be fixed.

## Keep up to date

The surest way to be able to apply a security fix quickly is to already be on a recent version. A project that is three major versions behind cannot take a one-line patch. It first faces weeks of upgrade work, during which the flaw stays open.

- **Update routinely and in small steps.** Frequent small updates are low-risk. A large jump once every two years is a project.
- **Automate the proposals.** Tools such as Dependabot and Renovate open a change for each available update, which your tests then check.
- **Have good tests.** Automated updates are only as safe as the tests that run on them.
- **Watch for end of life.** A version of a language or framework that is no longer supported receives no security fixes at all. Plan upgrades before that date.

## Pin what you install

A dependency declaration such as "version 2.x" means the exact version is chosen at install time. Two builds of the same commit can then contain different code.

A **lock file** records the exact version of every package, direct and transitive, together with a hash of its contents. Installing from it gives the same code every time.

- **Commit the lock file.**
- **Install from it in the pipeline**, with the command that fails if the lock file and the declaration disagree.
- **Review changes to it.** A lock file change is a code change. It is where a new package or a new version enters.

Pinning does not mean never updating. It means updates happen as a visible, reviewed change, and not silently at build time.

## The unpinned build {prediction}

A project declares its dependencies with version ranges and has no lock file. Its pipeline installs the latest matching versions on every build. On Tuesday, the maintainer account of a small transitive dependency is taken over, and a harmful version is published. The project's nightly build runs.

:::question unpinned
What happens?
- [ ] Nothing, since nobody changed the project's code :: The code did not change. What the build installs did.
- [x] The harmful version is installed and shipped, with no change anyone could review :: Without a lock file, each build takes whatever is newest. A lock file would have kept the previous version until someone chose to update.
- [ ] The package registry blocks harmful packages :: Registries remove them once reported, which is often days later.
:::

## Malicious packages

Not every bad package is an accident. Attackers publish harmful code on purpose.

- **Typosquatting.** A package with a name one keystroke from a popular one, waiting for a mistyped install command.
- **Dependency confusion.** A public package with the same name as a company's private one. A misconfigured installer prefers the public one.
- **Account takeover.** A legitimate maintainer's account is compromised and a harmful version is published under the trusted name.
- **A handover.** An abandoned package is given to a new maintainer, who adds harmful code.

Defences:

- Check the exact name before installing, especially when copying from a tutorial or a generated suggestion.
- Configure private package names so that they resolve only from your private registry.
- Use lock files with hashes.
- Be cautious with install scripts, which run code at install time.
- Be slower to adopt a version that was published in the last few hours.

## Choosing a dependency

Every dependency is a long-term commitment. Before adding one, ask:

- **Do we need it?** A package for a ten-line function adds its whole dependency tree and all future maintenance.
- **Is it maintained?** Look at recent releases, the response to reported issues and the number of maintainers.
- **How widely is it used?** Wide use means more people who would notice a problem.
- **How large is its own tree?**
- **Does it have a way to report security issues**, and a history of fixing them?

Fewer dependencies is a security property. Each one removed is code you no longer have to trust or update.

## Know what you ship

When a serious flaw is announced in a common library, the first question is "are we affected, and where?". Many organizations cannot answer it quickly.

A **software bill of materials** (SBOM) is a list of every component in a piece of software, with versions. Generated at build time and stored for each release, it turns that question into a search.

Base images and system packages belong on the list as well. A container image contains an operating system's worth of packages, and a flaw in one of those is as real as a flaw in an application library. Rebuild images regularly to pick up fixes, and prefer small base images, which contain less.

## The pipeline is production

Whatever can change the build can change what runs. The build and deployment pipeline therefore deserves the same protection as the production system.

- **Protect the main branch.** Require review before merging. No direct pushes.
- **Limit who can change the pipeline definition**, and review those changes.
- **Give the pipeline least privilege.** A job that runs tests needs no deploy credentials. Use short-lived credentials where the platform offers them.
- **Do not run untrusted code with secrets.** A build triggered by an outside contributor's change must not have access to deployment secrets.
- **Pin third-party pipeline steps** to an exact version, preferably by commit hash. A reusable step from someone else's repository is a dependency like any other, and one that runs with your secrets.
- **Build once, and deploy that same artefact** everywhere, so that what was tested is what runs.

```text example pipeline readonly
   source  -->  build  -->  artefact  -->  deploy  -->  running
     ^            ^            ^             ^
     |            |            |             |
   who can      what does    can it be     who and what
   merge?       the build    swapped       can trigger it?
                pull in?     after the
                             build?

   A weakness at any arrow changes what ends up running.
```

## Verify what you run

Two further practices raise the level for systems that need it.

- **Signing.** The build signs each artefact, and the deployment refuses anything without a valid signature. An artefact that was swapped or altered after the build is rejected.
- **Provenance.** A signed record of how an artefact was built: from which commit, by which pipeline. It lets you check that what you run was made from the code you reviewed.

These add work, and they belong after the basics: scanning, lock files, updates and a protected pipeline.

## Code you did not write still needs review

Third-party code enters in other ways than a package manager.

- A snippet copied from a forum answer.
- Code produced by an AI assistant.
- A script piped straight from a URL into a shell.

Read it before running it, and review it as you would a colleague's change. Generated code can contain the flaws from earlier modules, and can suggest a package name that does not exist, which an attacker may later register. Check that every package it names is real and is the one you intend.

## The pipeline step {prediction}

A deployment workflow uses a third-party step from a public repository, referenced by a moving tag, `v2`. The step receives the cloud deployment credentials. The step's repository is compromised and the `v2` tag is moved to a new commit.

:::question pipeline-step
What happens on the next run?
- [ ] The run fails, since the code behind the tag changed :: Nothing checks that. A tag is a label that can be moved.
- [x] The new code runs with the deployment credentials, and can send them anywhere :: A moving tag means "whatever the owner points it at today". Pinning the step to a full commit hash would have kept the reviewed version.
- [ ] Nothing, since third-party steps run in a sandbox :: The step was handed the credentials on purpose. It can use them.
:::

## Exercise: assess the project {independent}

You join a team and find this.

1. 62 direct dependencies. The scanner, run for the first time, reports 140 findings: 3 critical, 21 high and the rest lower.
2. No lock file. The pipeline installs the latest versions.
3. The language runtime reached end of life 14 months ago.
4. The base image is `latest` of a full operating system image, rebuilt "when someone remembers".
5. The pipeline uses nine third-party steps, all referenced by a major version tag, and every job has the production deploy key.
6. Six of the dependencies have had no release in five years.

Put the work in order, with a reason for each position.

## One possible answer {walkthrough}

**1. Triage the 3 critical findings today.** For each, ask whether the vulnerable code is reachable in this application and whether it faces the internet. Patch the ones that are. This is the only item that may be an open door at this moment.

**2. Add a lock file and make the pipeline install from it.** It takes an afternoon, it stops silent changes, and it makes every later step reproducible. Commit it before upgrading anything, so there is a known starting point.

**3. Fix the pipeline's privileges.** Give the deploy key only to the deploy job. Pin the nine third-party steps to commit hashes. This is cheap, and it closes the path with the highest impact, since that key can change production.

**4. Work through the 21 high findings**, then set a rule: critical within days, high within weeks. Turn on automated update proposals so the backlog does not return.

**5. Plan the runtime upgrade.** Fourteen months without security fixes is a growing risk. It is also the largest piece of work, so it needs scheduling. Some findings will disappear with it.

**6. Pin and slim the base image.** Use a specific, small image, and rebuild it on a schedule.

**7. Review the six abandoned dependencies.** Replace or remove them. With 62 direct dependencies, some can probably go altogether.

**8. Generate an SBOM per release**, so that the next urgent question can be answered by searching.

The order puts possible live exposure first, then cheap changes that prevent new problems, then the large upgrade. Fixing all 140 findings in list order would have delayed the three things that matter most.
