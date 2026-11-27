# Networking

A reading course about how a request crosses a network and why it fails. It has no code to write and needs nothing installed. Every command it shows is printed with what to look for in the output.

Status: all 15 modules are written, built and registered as `course:networking`, content version 0.1.0-preview.1. Nobody has worked through it as a learner.

## Who it is for

Someone who can use a terminal and has called a web page or an API, and wants to know what happens between the client and the server. It is the base for the system design course.

## Modules

The manifest expands each key with `course:networking/module/`. Each module is one `module.md` in the Markdown format described at the top of `scripts/course-markdown.mjs`.

| Module | What the reader can do afterwards |
| --- | --- |
| 1. **model** · How data crosses a network | Describe packets, hops and layers, and name the step that failed. |
| 2. **addresses** · IP addresses and subnets | Read an address and a CIDR range, and tell private from public. |
| 3. **ports** · Ports and sockets | Explain why a running server cannot be reached from another machine. |
| 4. **dns** · Names and DNS | Explain a lookup, read the common records, and plan a change around the TTL. |
| 5. **tcp** · TCP and UDP | Tell refused from timed out from reset, and say when UDP fits. |
| 6. **http** · HTTP on the wire | Read a request and response as sent, and say what HTTP/2 and HTTP/3 changed. |
| 7. **tls** · TLS and certificates | Say what TLS guarantees and which certificate check failed. |
| 8. **routing** · Routing, gateways and NAT | Follow a packet through a route table and NAT. |
| 9. **firewalls** · Firewalls and network rules | Write narrow, stateful rules and lay out public and private subnets. |
| 10. **proxies** · Proxies and reverse proxies | Explain what a reverse proxy changes, and read the errors it produces. |
| 11. **balancing** · Load balancers | Choose a method, design a health check, and drain a server. |
| 12. **timeouts** · Timeouts, retries and backoff | Set timeouts along a chain and retry only when safe. |
| 13. **latency** · Latency and where time goes | Estimate a request's time by counting round trips. |
| 14. **debug** · Find where a request fails | Test stage by stage and name the first stage that fails. |
| 15. **review** · Trace and review a request path | Trace a request, review a flawed layout and plan one. |

The course has 154 steps, 30 questions and 51 examples (diagrams, commands and HTTP messages), in about 15,700 words.

## How a module is built

Each module explains an idea in short steps with plain-text diagrams, asks two questions where the reader predicts an outcome, and ends with an exercise on paper followed by one possible answer.

## Decisions

- D1: **A reading course.** Checking a learner's network commands would mean running them against real machines, which the app cannot set up or make repeatable.
- D2: **Only documentation addresses and names.** Every address is private, loopback, or from a range reserved for examples (`203.0.113.0/24`, `198.51.100.0/24`), and every name is under `example.com`, `example.net` or `example.org`. The test fails on any other. One exception is named in the test: `9.9.9.9`, a public DNS resolver used in one `dig` command.
- D3: **IPv4 in the examples.** IPv6 is introduced and the ideas carry over. IPv4 addresses are shorter to read in diagrams.
- D4: **Commands for three systems where they differ.** Linux, macOS and Windows forms are shown for listing ports and testing a connection.
- D5: **Security advice is marked as general guidance.** Where a lesson recommends a practice, such as closing SSH to the internet, it says the advice is general and not any organization's policy.
- D6: **A final review module.** It adds no new ideas. It has one end-to-end trace, one layout to review and one to plan.

## Checks

`tests/course-networking.test.mjs` checks the built pack: 15 available modules, no exercises to run, every example read-only with a known fence and no line over 76 characters, every question shown with feedback on every choice, an exercise and a worked answer in every module, documentation addresses and names only, and nothing that looks like a live credential. It also drives an enrollment through the course service.

## Not verified

- Nobody has opened the course in the app, so the look of the tables and diagrams at the pane's real width is unseen.
- No command in the course was run. They were written from knowledge of the tools, and option names can differ between versions.
- The typical figures (round-trip times, default timeouts, certificate lifetimes) are rounded and stated as typical. They were not checked against current sources.
- The text was reviewed by its author only.

## Scope

Outside this course: Wi-Fi and Ethernet details, BGP, VPN setup, IPv6 addressing in depth, WebSockets, service meshes and packet capture tools.
