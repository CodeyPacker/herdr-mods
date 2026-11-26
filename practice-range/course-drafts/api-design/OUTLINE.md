# API design

A reading course about designing APIs. It has no code to write and needs no compiler, database, repo or AI. Each module explains a few ideas, shows them as requests, responses and plain-text diagrams, asks the reader to judge some designs, and ends with a short design exercise followed by one possible answer.

Status: all 15 modules are written, built and registered as `course:api-design`, content version 0.1.0-preview.1. Nobody has read it through as a learner yet.

## Who it is for

Someone who can read JSON and has called or built an API, and wants to design one well. It does not teach HTTP from nothing, and it does not teach any programming language. Every example uses one running product: a task tracker with projects, tasks and comments, reached over HTTP with JSON.

## Modules

The manifest expands each key with `course:api-design/module/`. Modules are read in order, but any can be opened directly.

| Module | What the reader can do afterwards | Diagrams and examples |
| --- | --- | --- |
| 1. **contract** · An API is a promise | Explain what an API promises, who depends on it, and why its design is hard to change. | The boundary between clients and server. Two styles for the same job. |
| 2. **resources** · Model resources and name them | Turn a problem into resources with clear, consistent addresses. | An address tree. An inconsistent API to review. A many-to-many design. |
| 3. **methods** · Choose the method | Choose a method by what it promises: safe, idempotent, or neither. | A lost reply and a retry. PUT against PATCH. A GET that deletes. |
| 4. **status** · Answer with the right status | Choose a status code that tells the client who has to act next. | The four families. A failure reported as 200. |
| 5. **shapes** · Shape requests and responses | Design bodies that are consistent and hard to misread. | A good task. A bad one. Absent, null and empty in a PATCH. |
| 6. **errors** · Design errors people can act on | Design an error a program can branch on and a person can fix. | A problem-details error. An error that leaks internals. A validation error. |
| 7. **lists** · Return lists that scale | Design filtering, sorting and paging for a growing collection. | Offset paging drifting. Cursor paging. |
| 8. **writes** · Make writes safe to retry | Make creates safe to retry and stop silent overwrites. | An idempotency key. A lost update. If-Match and 412. |
| 9. **versioning** · Change without breaking | Tell a breaking change from a safe one and plan how an API evolves. | Expand and contract. Sunset headers. Release notes to classify. |
| 10. **auth** · Know who is calling | Separate who the caller is from what they may do. | The two gates, 401 and 403. A key in an address. |
| 11. **limits** · Protect the service | Design limits and caching that tell clients what to do. | Rate limit headers. Backoff. A conditional request and 304. |
| 12. **async** · Handle slow work and events | Design jobs for slow work and webhooks for news. | A job and its status. An event. An import from start to finish. |
| 13. **styles** · Choose an API style | Compare resource, procedure, query and event styles. | One operation in three styles. |
| 14. **docs** · Describe and review an API | Describe an API precisely and review a design. | An OpenAPI fragment. A thin reference entry. A review checklist. |
| 15. **capstone** · Review and design a whole API | Review a flawed API and design a small one from a brief. | A flawed API with twelve problems. A worked design for time tracking. |

The course has 131 steps, 30 questions, 48 examples, and 16 design exercises with worked answers. It is about 12,000 words of reading.

## How a module is built

| Step kind | Used for |
| --- | --- |
| explanation | Reading. Often with a diagram or an HTTP exchange below it. |
| prediction | A situation and a question with three answers. Every answer has feedback that says why. |
| debugging | A flawed design to inspect, with a question about what is wrong. |
| independent | A design exercise to do on paper. Nothing is checked. |
| walkthrough | One possible answer to the exercise before it. |

A wrong answer to a question can be retried, and the feedback explains the reasoning either way. Because there are no checked exercises, a module's status in the app stops at "read". The app's rule that only an unaided coding pass counts as demonstrated skill is unchanged, and this course never claims one.

## Decisions

- D1: **Plain-text diagrams.** The lesson view renders Markdown and fenced code, and has no diagram or image renderer. Diagrams are drawn with ordinary characters inside a fenced block, at most 76 characters wide. They need no library, no build step and no network, and they are readable in a diff. Mermaid was considered and rejected because rendering it would need a JavaScript diagram library or a headless browser, in the app or at build time.
- D2: **No runner.** A reading course names no language and no runner. Nothing in it executes, so it has no dependency at all beyond the app.
- D3: **HTTP and JSON as the worked style.** The principles are general, and module 13 compares other styles. One concrete style keeps the examples comparable from module to module.
- D4: **General guidance on security.** Module 10 covers authentication and authorization as design topics. It says so in its introduction and points the reader to their organization's own policy and review.

## Scope

Outside this course: building a server, any framework, HTTP itself in depth, OAuth flows step by step, GraphQL and gRPC schema design in detail, API gateways, and performance tuning.
