# CI/CD

A reading course about build and deployment pipelines: getting a change from a commit to production quickly and safely. It has no code to write and nothing in it is run by the app. Each module explains a few ideas, shows them as pipeline files, commands and plain-text diagrams, asks the reader to judge some situations, and ends with a short exercise followed by one possible answer.

Status: all 16 modules are written, built and registered as `course:ci-cd`, content version 0.1.0-preview.1. Nothing is committed yet. Nobody has read it through as a learner.

## Who it is for

Someone who uses version control and has opened a pull request, and wants to understand, write and review pipelines. It assumes no programming language. Every example uses one running product, a small web service called tracker, shipped as a container image.

## Modules

The manifest expands each key with `course:ci-cd/module/`. Modules are read in order, but any can be opened directly.

| Module | What the reader can do afterwards | Diagrams and examples |
| --- | --- | --- |
| 1. **flow** · From a commit to production | Explain CI, continuous delivery and continuous deployment, and trace a change to production. | The three terms on one line. A pipeline with gates. The cost of a late defect. |
| 2. **integrate** · Integrate small changes often | Keep a shared branch releasable with small changes and checks on every pull request. | Branch protection. Long and short branches. Two green pull requests that break `main`. |
| 3. **workflow** · Read a pipeline file | Read a GitHub Actions workflow and say what runs, where, and in what order. | A first workflow. Workflow, trigger, job, step. Outputs and `needs`. Jobs that share no files. |
| 4. **triggers** · Decide when a pipeline runs | Choose the events that start a pipeline and stop runs from colliding. | Events and filters. Manual inputs. Concurrency groups. A deployment race. |
| 5. **stages** · Order the checks | Arrange checks so that the cheapest failures are found first. | Three stages. The test pyramid. A matrix. Keeping evidence after a failure. |
| 6. **speed** · Keep the pipeline fast | Shorten a pipeline with caching and parallel work, and deal with flaky tests. | Step timings. A cache key. Shards. A test that fails one run in four. |
| 7. **artifacts** · Build once and keep the result | Produce one identified artifact per change and reuse it in every later step. | Build once against rebuilding. Naming by commit. Publishing an image. A deployment record. |
| 8. **environments** · Promote through environments | Move one artifact through development, staging and production with the right gates. | The path of one image. Environment-scoped values. Protection rules. A promotion workflow. |
| 9. **secrets** · Handle secrets and identity | Give a pipeline access without long-lived keys, and limit what untrusted code can reach. | The secret store. Federated identity. Minimum permissions. Pinning. Script injection. |
| 10. **deploy** · Deploy without downtime | Choose between rolling, blue-green and canary, and check a release before users see it. | The three strategies. Slot swap. A smoke test script. A full deploy job. |
| 11. **rollback** · Go back quickly | Plan how to undo a release, and separate deploying code from turning a feature on. | Rollback as a deployment. Back or forward. Feature flags. A rollback workflow. |
| 12. **database** · Change the database safely | Change a database's structure in steps that old and new code can both run against. | One database, two versions. A rename that breaks. Expand and contract. |
| 13. **reuse** · Reuse pipeline code | Share pipeline logic between repositories without copying it. | Copies drifting. A composite action. A reusable workflow. Thirty callers at `@main`. |
| 14. **infrastructure** · Describe infrastructure as code | Describe an environment in a file, preview a change, and explain drift. | A Bicep file. A `what-if` preview. Parameter files. A rename that deletes a database. |
| 15. **measure** · Know whether it is working | Measure a delivery process with four numbers and notice a bad release quickly. | The four measures. A deployment log. A deployment marker on a graph. Gamed targets. |
| 16. **capstone** · Review and design a pipeline | Review a flawed pipeline and design one for a small service. | A workflow with fourteen problems. A repaired outline. A worked design. |

The course has 157 steps, 32 questions, 81 examples, and 17 exercises with worked answers. It is about 18,200 words of reading.

## How a module is built

The step kinds and file layout are those of the API design course, described in `../api-design/FORMAT.md`. The example fences are `text` for diagrams and terminal output, `yaml` for workflows, `bash` for scripts and `bicep` for the infrastructure file.

## Decisions

- D1: **A reading course.** Checking a learner's pipeline would mean running it, which needs a hosted runner, a repository and a cloud account. None of that can be a dependency of the app.
- D2: **Principles first, one tool for the examples.** The ideas are general. The worked syntax is GitHub Actions and the deployment target is Azure (Container Registry, App Service slots, federated sign-in, Bicep), because that is what the author's organization uses. Module 1 says so and the last step says what carries over to other tools.
- D3: **Invented names only.** The examples use `tracker`, `acme` and `example.com`. Nothing was copied from a real repository. The real workflows were read only to learn which tools and commands are in use.
- D4: **General guidance on security.** Module 9 says it is general guidance and points the reader to their organization's own policy.
- D5: **Plain-text diagrams**, at most 76 characters wide.

## Checks

`tests/course-ci-cd.test.mjs` checks the built pack and drives an enrollment. Every `yaml` example was parsed once with a YAML parser, by hand, and all 30 parse.

## Not verified

- No workflow in the course was run on GitHub, and no `az` command or Bicep file was run against Azure. They parse as YAML. Whether GitHub and Azure accept every line was not tested.
- Action versions such as `actions/checkout@v5` and `azure/login@v3`, and the Bicep API version, are the ones seen in use or known to the author. They were not checked against the current releases.
- Nobody has looked at the rendered lessons in the app, and the `bicep` fence may show as plain text.
- The accuracy of the text was reviewed by its author only.

## Scope

Outside this course: other pipeline tools' syntax, Kubernetes deployment, writing tests, monitoring tools in detail, and compliance frameworks.
