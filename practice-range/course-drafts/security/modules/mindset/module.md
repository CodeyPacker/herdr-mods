---
id: course:security/module/mindset
title: Think like a defender
requires: []
outcomes: []
tasks: []
drills: []
---

Security is the work of keeping a system doing what it should for the people it should, when someone is trying to make it do otherwise. This module gives you the vocabulary and one method for finding what could go wrong before an attacker does.

The advice in this course is general guidance for learning. It is not any organization's policy. Where you work, the security team's rules come first.

## What is being protected

Security has three goals, known together as the **CIA triad**.

| Goal | Means | Broken when |
| --- | --- | --- |
| Confidentiality | Only the right people can read the data | Customer records are leaked |
| Integrity | Only the right people can change the data, and changes are correct | An order's price is altered |
| Availability | The system works when it is needed | The site is knocked offline |

Most people think of confidentiality first. The other two matter as much. A bank whose balances can be edited has a worse problem than one whose balances can be read.

Start any security discussion by naming the **assets**: the things worth protecting. They are usually data (personal details, payment data, credentials), money, and the ability to act as someone (an account, an admin role, a signing key).

## Threats, vulnerabilities and risk

Three words are often mixed up.

- A **threat** is something bad that could happen: someone reads another user's messages.
- A **vulnerability** is a weakness that makes it possible: the messages endpoint does not check who is asking.
- **Risk** is how much the two matter together: how likely it is, multiplied by how bad it would be.

Risk is what you manage. You cannot remove every vulnerability, and you do not need to. A weakness in an internal tool that holds no sensitive data matters less than the same weakness in the login page.

So security work is a matter of priorities. The question is never "is this perfectly secure". It is "what are the worst things that could happen here, and which ones have we left open".

## The attack surface

The **attack surface** is every place where someone outside can send input to the system or get output from it.

- Every URL and API endpoint, including old and undocumented ones.
- Every form field, header, cookie, query parameter and uploaded file.
- Admin panels, debug pages and status endpoints.
- Open ports, storage buckets, message queues.
- The people who can be tricked, and the dependencies you install.

A smaller surface is easier to defend. Removing an unused endpoint, closing a port or deleting a feature nobody uses is security work, and it is often the cheapest kind.

```text example surface readonly
   +----------------------------------------------------------+
   |                      your system                         |
   |                                                          |
   |   public API        login form        file upload        |
   |   admin panel       webhooks          password reset     |
   |   old /v1 API       debug endpoint    status page        |
   |                                                          |
   +----------------------------------------------------------+
        ^        ^          ^          ^           ^
        every one of these accepts input from outside

   Each entry is a place to defend. Fewer entries, less to defend.
```

## Trust boundaries

A **trust boundary** is a line where data passes from something you do not control to something you do. The clearest one is between a user's browser and your server.

The rule at every boundary is the same: data that crosses it is untrusted until your side has checked it.

Many security bugs come from a wrong belief about where the boundary lies. The browser is on the far side. That includes everything your own JavaScript does there. A check that runs in the browser, a hidden form field, a disabled button, a price stored in the page: the user controls all of these. They can be changed with tools built into every browser.

```text example boundary readonly
   UNTRUSTED                         |  TRUSTED
                                     |
   browser, mobile app               |   your server
   - your JavaScript                 |   - checks every request
   - hidden fields, cookies          |   - holds the real rules
   - anything the user can edit      |   - talks to the database
                                     |
        ---- request ---------------->   check it here, every time
                                     |
                              trust boundary
```

## Checked in the wrong place {prediction}

A shop's checkout page computes the order total in the browser and sends it to the server in a field named `total`. The server charges the card that amount.

:::question client-total
What can a customer do?
- [ ] Nothing. The page's code computes the total correctly :: The page's code runs on the customer's machine, where they can change it or skip it.
- [x] Send any total they like, such as 0.01 :: The request comes from the far side of the trust boundary. The server must compute the total itself from its own prices.
- [ ] Only see the total, not change it :: Every value a browser sends can be edited before it is sent.
:::

## Who attacks, and why

It helps to picture who you are defending against. Their effort and skill differ a great deal.

- **Automated scanners.** Programs that try every address on the internet for known weaknesses. They find anything exposed within hours. Most real attacks start here.
- **Opportunists.** People using published tools and leaked password lists. They go where it is easy.
- **Targeted attackers.** People who want your system in particular and will spend time on it.
- **Insiders.** People with legitimate access who misuse it, or whose accounts are taken over.
- **Users who make mistakes.** Not attackers at all. A system should not let an honest mistake cause a breach.

The first two account for most incidents, and they are stopped by basics: updated software, strong authentication, checked input and nothing exposed that need not be.

## Principles that hold everywhere

A few ideas apply to every later module.

- **Least privilege.** Give each user, service and key only the access it needs. A stolen key can then do only what that key could do.
- **Defence in depth.** Use several independent layers, so that one mistake is not a breach. Validation, a parameterised query and a database account with limited rights each stop SQL injection on their own.
- **Deny by default.** Start with nothing allowed and add what is needed. A new endpoint that someone forgot to configure is then closed, not open.
- **Fail closed.** When a check cannot be completed, refuse. A permission service that is down should mean "no access", not "everyone in".
- **Keep it simple.** Complex systems hide mistakes. The more that can be understood at a glance, the fewer surprises.
- **Do not rely on secrecy of the design.** Assume an attacker knows how the system works. Security must come from keys and checks, not from nobody knowing the URL.

## Threat modelling

**Threat modelling** is a structured way of asking what could go wrong, done before or while building. Four questions are enough.

1. **What are we building?** Draw the parts and the data flowing between them. Mark the trust boundaries.
2. **What can go wrong?** Go through each part and each arrow.
3. **What will we do about it?** Fix it, reduce it, or accept it knowingly.
4. **Did we do a good job?** Check afterwards.

For the second question, a list of prompts called **STRIDE** helps. Ask each of the six about every part.

| Letter | Threat | Question to ask |
| --- | --- | --- |
| S | Spoofing | Can someone pretend to be another user or service? |
| T | Tampering | Can someone change data they should not? |
| R | Repudiation | Could someone deny an action, with no record to show otherwise? |
| I | Information disclosure | Can someone read what they should not? |
| D | Denial of service | Can someone make it stop working? |
| E | Elevation of privilege | Can someone gain rights they were not given? |

A half-hour session with a whiteboard finds design flaws that no later code review will, because they are flaws in what was decided, not in how it was written.

## Fail open or closed {prediction}

A service checks permissions by calling a separate authorization service. The code is written so that if that call times out, the request is allowed, "to avoid an outage".

:::question fail-open
What does this design mean in practice?
- [ ] It is a sensible way to stay available :: It keeps the service up by removing the access check whenever the dependency is slow.
- [x] Anyone who can make the authorization service slow gets access to everything :: This is failing open. An attacker, or a plain overload, turns off the access control. Fail closed: no answer means no access.
- [ ] Nothing, since timeouts are rare :: Rare events are the ones attackers try to cause on purpose.
:::

## Exercise: model a feature {independent}

A team adds "export my data" to a web application. A logged-in user clicks a button. The server builds a ZIP file of that user's records, stores it in a storage bucket, and emails the user a link to download it.

Draw the flow as a list of steps. Mark the trust boundaries. Then go through STRIDE and write at least one threat for each letter, with what you would do about it.

## One possible answer {walkthrough}

**Flow**

1. The browser sends "export" with the session cookie. (Boundary: browser to server.)
2. The server queues a job with the user's ID.
3. A worker reads that user's records and writes a ZIP to storage.
4. The server emails a link. (Boundary: the link leaves your system and travels by email.)
5. Someone opens the link and downloads the file. (Boundary: internet to storage.)

**Threats**

| | Threat | Response |
| --- | --- | --- |
| S | Someone who takes over a session exports everything in one click | Ask for the password again, or a second factor, before a full export |
| T | The request names a user ID, and an attacker changes it to export another user's data | Take the user ID from the session on the server, never from the request |
| R | A user claims they never requested an export | Record who requested each export, when and from where |
| I | The download link works for anyone who has it, for ever | Make the link expire after a short time, make it unguessable, and require login to use it |
| D | Someone requests thousands of exports and fills storage or the job queue | Limit exports per user per day. Delete files after a few days |
| E | The worker's storage key can read and write every file in the bucket | Give the worker a key that can write only to the exports area |

The most serious are T and I. One lets an attacker choose whose data is exported. The other puts a whole account's data behind a link that sits in an email inbox. Both are design decisions, which is why they are cheapest to catch at this stage.
