# Docker

A reading course about packaging and running software with Docker. It has no code to write and nothing in it is run by the app. Each module explains a few ideas, shows them as commands, Dockerfiles, Compose files and plain-text diagrams, asks the reader to judge some situations, and ends with a short exercise followed by one possible answer.

Status: all 16 modules are written, built and registered as `course:docker`, content version 0.1.0-preview.1. Nobody has read it through as a learner.

## Who it is for

Someone who can use a terminal and has run a program from the command line, and wants to package and run software with Docker. It does not assume any programming language. Every example uses one running product: a small web service called tracker and its PostgreSQL database. The service happens to be started with `node server.js`, because a Dockerfile has to start something. The course teaches no Node.js and makes no comparison with any other stack.

## Modules

The manifest expands each key with `course:docker/module/`. Modules are read in order, but any can be opened directly.

| Module | What the reader can do afterwards | Diagrams and examples |
| --- | --- | --- |
| 1. **containers** · What a container is | Explain what a container and an image are, and what a container isolates. | Image and containers. What is isolated. Virtual machines against containers. Client, daemon, registry. |
| 2. **run** · Run and manage containers | Start, inspect, stop and remove containers, and know their state. | The steps of `docker run`. The life of a container. A crowded `docker ps -a`. |
| 3. **images** · Name and find images | Read an image name, choose a tag deliberately, and say what a digest guarantees. | The parts of a name. Tag against digest. Shared layers in a pull. |
| 4. **dockerfile** · Write a Dockerfile | Write a Dockerfile and control what goes into the build. | A first Dockerfile. The build context. A `.dockerignore`. A copy that leaks `.env`. |
| 5. **layers** · Use layers and the build cache | Order a Dockerfile so that rebuilds are fast and layers stay small. | The layer stack. Cache reuse in two orders. Cleanup in one step. `docker history`. |
| 6. **start** · Start and stop cleanly | Choose between CMD and ENTRYPOINT and make a container stop when asked. | CMD and ENTRYPOINT combinations. Exec and shell form. The stop timeline. Exit codes. |
| 7. **config** · Configure a container | Give one image different settings in different places, with no secrets in it. | One image in three places. ARG against ENV. A password leaked through a build argument. |
| 8. **storage** · Keep data | Say where a container's data lives and choose a volume, a bind mount or neither. | The writable layer. Three kinds of mount. A volume mounted at the wrong folder. A backup. |
| 9. **network** · Connect containers | Publish a port, connect containers by name, and explain `localhost` inside one. | Private ports. Publishing. A named network. The `localhost` mistake. |
| 10. **compose** · Describe an app with Compose | Describe a multi-container app in one file and run it with one command. | A full `compose.yaml`. Variables and `.env`. Secrets as files. A development override. |
| 11. **health** · Start in order and stay up | Make services wait for what they need, restart after failure, and stay within limits. | Started against ready. Health checks. Conditions. A restart loop. Limits. |
| 12. **small** · Build small images | Use a multi-stage build and a suitable base image to ship only what runs. | Two stages. A multi-stage Dockerfile. Where 1.4 GB came from. Build targets. |
| 13. **secure** · Run with less privilege | Reduce what a container can do and what an image is trusted to contain. | Rings of defence. A non-root user. A hardened service. Build secrets. |
| 14. **ship** · Tag, push and release | Tag and push an image so that what was tested is exactly what runs. | Build, push, pull, run. Promotion. Platforms. Labels. |
| 15. **debug** · Find out why it failed | Work out why a container stopped, cannot be reached, or lost its data. | The order of questions. State and exit code. Reaching a service. Disk use. |
| 16. **capstone** · Review and containerize an app | Review a flawed setup and plan how to containerize a small app. | A Dockerfile with ten problems. A Compose file with nine. A worked design. |

The course has 160 steps, 32 questions, 89 examples, and 18 exercises with worked answers. It is about 16,800 words of reading.

## How a module is built

The step kinds are the same as in the API design course, described in `../api-design/FORMAT.md`. That file is also the format reference for this course. The only difference is the set of example fences: `text` for diagrams and terminal output, `bash` for commands, `dockerfile` and `yaml` for files.

## Decisions

- D1: **A reading course, not a hands-on one.** Checking a learner's Dockerfile or commands would need a running Docker daemon, image downloads and a new runner in the app. That is a large dependency for every learner, and it fails on machines where Docker is not installed or not started. As a reading course it needs nothing beyond the app. The introduction says that every command can be typed by a reader who has Docker.
- D2: **Plain-text diagrams**, at most 76 characters wide, for the same reasons as in the API design course.
- D3: **Versions are always named.** Every image in an example carries a version, because the course teaches that. The exceptions are the examples that show the mistake. A test checks this.
- D4: **One machine.** The course stops before orchestration. The last step says what carries over.
- D5: **General guidance on security.** Modules 7, 10 and 13 cover secrets and privilege as practice, say that they are general guidance, and point the reader to their organization's own policy.
- D6: **Invented values.** Passwords in examples read `example-only`. Digests and identifiers are made up and shortened.

## Checks

`tests/course-docker.test.mjs` checks the built pack and drives an enrollment. The Compose examples that are whole files were validated once with `docker compose config`, by hand, with Docker Compose v5.5.1. Two fragments (`compose/worker` and `health/depends`) name a service defined in the main file and are not valid alone.

## Verified on 2026-11-27

The course was checked against Docker 29.8.1 on Docker Desktop, with a small test application, and corrected where the result differed.

- All seven complete Dockerfiles build. The image tags the course names exist in the registry.
- Confirmed by running: exec form against shell form as PID 1 and how each responds to `docker stop`, the entrypoint wrapper with `exec`, the non-root user, `.dockerignore`, build arguments and the way a secret passed as one shows in `docker history`, layer caching after a source change, `--target`, build secrets, labels, volume persistence and the wrong mount path that loses data, bind mounts, published ports, names resolving on a user network and not on the default one, `localhost` inside a container, memory limits and exit code 137 with `OOMKilled`, and the debugging commands.
- The Compose files were run as real stacks: the first two-service file, the health check with ordered start and a one-off migration, the hardened final file with a secret file, a read-only root and dropped capabilities, variable substitution, and `down -v` removing the volume.
- Corrected: `docker image ls` prints different columns and larger sizes on this version, the default wait of `docker stop` was about 3 seconds and not 10, `--time` is now spelt `--timeout` (`-t` works on both), and published ports are also listed in IPv6 form.

## Not verified

- Pushing to a registry and multi-platform builds with `buildx --push`. No registry was used.
- `docker compose watch` in use. Its configuration was validated only.
- Sample terminal output is still written by hand to show the shape of real output. Sizes in particular depend on the Docker version, and the course now says so.
- Older Docker versions and Docker on Linux without Docker Desktop.
- Nobody has looked at the rendered lessons in the app.
- The accuracy of the text was reviewed by its author only.

## Scope

Outside this course: orchestration (Kubernetes, Swarm), building a registry, continuous integration systems in detail, rootless Docker and user namespaces in depth, Windows containers, and other container tools.
