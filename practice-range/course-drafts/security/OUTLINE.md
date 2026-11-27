# Security

A reading course about the common security flaws in web applications and how to prevent them. It is written for developers and is defensive throughout: each flaw is shown only as far as needed to recognise it and fix it. It has no code to run and needs nothing installed.

Status: all 15 modules are written, built and registered as `course:security`, content version 0.1.0-preview.1. Nobody has worked through it as a learner. It has not been reviewed by a security specialist.

## Who it is for

Someone who has built or worked on a web application or an API and wants to recognise and prevent security flaws in their own code. The API design and Networking courses are useful background for the modules on sessions, cross-site requests and TLS.

## Modules

The manifest expands each key with `course:security/module/`. Each module is one `module.md` in the Markdown format described at the top of `scripts/course-markdown.mjs`.

| Module | What the reader can do afterwards |
| --- | --- |
| 1. **mindset** · Think like a defender | Mark trust boundaries and list threats to a feature with STRIDE. |
| 2. **input** · Treat all input as untrusted | Validate with allowlists, and make data safe where it is used. |
| 3. **injection** · Injection | Prevent SQL and command injection by keeping code and data apart. |
| 4. **xss** · Cross-site scripting | Prevent it with output encoding for the right context. |
| 5. **authentication** · Authentication | Design login, MFA and password reset flows that resist attack. |
| 6. **passwords** · Store passwords safely | Use a salted, slow hash and migrate an old scheme. |
| 7. **sessions** · Sessions and tokens | Protect the session credential and end a session properly. |
| 8. **csrf** · Cross-site requests | Explain CSRF and the same-origin policy, and what CORS does not do. |
| 9. **authorization** · Authorization | Find missing access checks and deny by default. |
| 10. **crypto** · Cryptography in practice | Choose between hashing, a MAC, encryption and a signature. |
| 11. **secrets** · Secrets | Keep secrets out of code, rotate them, and respond to a leak. |
| 12. **dependencies** · Dependencies and the supply chain | Scan, pin and update third-party code, and protect the pipeline. |
| 13. **data** · Protect personal and sensitive data | Classify data, hold less of it, and find where it leaks. |
| 14. **detect** · Detect and respond | Decide what to log and alert on, and follow incident response. |
| 15. **review** · Review an application | Review an application and a change, and design a feature securely. |

The course has 198 steps, 30 questions and 37 examples, in about 25,000 words.

## How a module is built

Each module explains an idea in short steps with diagrams, asks two questions where the reader predicts an outcome, and ends with an exercise on paper followed by one possible answer. Most exercises are reviews of a flawed design, since recognising a flaw is the skill being taught.

## Decisions

- D1: **Defensive only.** A flaw is shown with the smallest textbook example that makes its cause clear, such as a quote that ends a SQL string. The course has no working exploit code, no payload lists and no guidance on attacking systems.
- D2: **Every module marks its advice as general guidance.** Each module's opening says the advice is general guidance and not any organization's policy. The test fails if a module lacks that. The first and last modules also say that an organization's security team and policies take precedence.
- D3: **The data module says it is not legal advice.** Privacy law is described only in general terms, and retention and notification decisions are left to the people responsible for compliance.
- D4: **The incident module tells the reader to report, not to investigate alone.** Its exercise ends by handing the notification decision to the security, legal and privacy roles.
- D5: **Language-neutral.** Code is written as SQL, HTTP, HTML or plain-word pseudocode. No programming language is assumed or compared.
- D6: **Standards are named, not quoted.** OWASP, NIST and STRIDE are referred to by name so that a reader can look them up. No text is copied from them.
- D7: **A final review module.** It adds no new ideas. It has one application to review, one change to review and one feature to design.

## Checks

`tests/course-security.test.mjs` checks the built pack: 15 available modules, no exercises to run, every example read-only with a known fence and no line over 76 characters, every question shown with feedback on every choice, an exercise and a worked answer in every module, the general-guidance statement in every module's opening, example domains only, and nothing that looks like a live credential. It also drives an enrollment through the course service.

## Not verified

- The course has not been reviewed by a security specialist. Security advice dates quickly, and a specialist review is the most valuable check it has not had.
- Specific recommendations were written from knowledge of published guidance and not checked against its current text: password hashing settings, minimum password length, cookie defaults in browsers, and algorithm choices.
- Nobody has opened the course in the app.
- The text was reviewed by its author only.

## Before this is used at work

This course lives in a personal repository and is general education. If it is ever offered to colleagues as training, it should first be checked against the organization's own security policies and confirmed with the security team, since a learner may read its recommendations as the organization's position.

## Scope

Outside this course: penetration testing, exploit development, malware, network and infrastructure hardening, cloud provider security services, mobile application security, cryptographic design, and compliance frameworks in any detail.
