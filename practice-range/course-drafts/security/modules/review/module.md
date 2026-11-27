---
id: course:security/module/review
title: Review an application
requires: []
outcomes: []
tasks: []
drills: []
---

This module has no new ideas. You review a small application with faults in it, and then plan the security of a new feature. Do each exercise on paper before you read its answer.

The advice here is general guidance, not any organization's policy.

## How to use this module

Each exercise has a step where you work alone and a step with one possible answer. The answers are not the only good ones. Compare your reasoning with them, and pay most attention to anything you did not think of at all.

When you review a system for security, ask the same questions each time.

1. What is worth protecting here, and who would want it?
2. Where does input cross a trust boundary, and where is it used?
3. How does the system know who is asking, and how could that be faked?
4. For each action, where is the check that this user may do this to this object?
5. What secrets exist, where are they kept, and what can each one reach?
6. If this were breached, how would anyone find out?

## Review 1: a customer portal {independent}

A company runs a portal where customers view invoices and update their details. Read the description and list every problem you find. Rank them.

```text example portal readonly
   LOGIN
   - passwords are stored as SHA-256 hashes, without a salt
   - "unknown user" and "wrong password" are different messages
   - no limit on login attempts, no MFA
   - the session cookie is set without HttpOnly, Secure or SameSite
   - the session ID is the user ID, Base64-encoded

   PAGES
   - GET /invoices/{id} returns any invoice to any logged-in user
   - the search page builds its SQL by joining the search text in
   - the invoice page shows the customer's "notes" field as raw HTML
   - POST /profile copies every field in the request onto the user row
   - GET /admin/export?all=true is linked only from the admin menu
     and checks only that the caller is logged in

   OPERATIONS
   - the database password and payment key are in the repository
   - the application logs every request body
   - nothing is alerted on, and logs are kept on the web server
```

## The most urgent one {prediction}

Before you read the full list, choose from three of the faults.

:::question portal-urgent
Which fault lets an attacker become any user with the least effort?
- [ ] The unsalted password hashes :: They matter after the database has been copied. Something else needs no theft at all.
- [x] The session ID is the user ID in Base64 :: Base64 is an encoding. Anyone can encode another user's ID, set it as their cookie and be that user, including an administrator. No password, no flaw to exploit, no noise.
- [ ] The missing limit on login attempts :: Guessing passwords takes many requests. Forging a session takes one.
:::

## Review 1: what is wrong {walkthrough}

**Become anyone, at once**

1. **Forgeable session ID.** Generate IDs from a secure random source, at least 128 bits, with the session kept on the server.
2. **SQL injection in search.** The whole database can be read through it. Use parameters.

**Reach other people's data**

3. **No ownership check on invoices.** Every invoice is readable by counting through IDs. Add the customer ID from the session to the query.
4. **The admin export checks only for a login.** Any customer can download everything. Check the role on the endpoint, deny by default, and re-authenticate for a full export.
5. **Mass assignment on the profile.** A customer can set fields such as a role or another account's ID. Accept a listed set of fields.

**Attack other users**

6. **Stored cross-site scripting in notes.** Script placed in notes runs for whoever views the invoice, including staff. Encode on output.
7. **Unprotected cookie.** Without `HttpOnly` that script can read the session. Without `Secure` it can travel in the clear. Without `SameSite` every state-changing request can be forged from another site. Set all three, and add CSRF tokens.

**Weak login**

8. **Unsalted fast hashes.** A copied table is cracked in hours. Move to Argon2id, wrapping the existing hashes first.
9. **No attempt limit and no MFA.** Credential stuffing works unhindered. Rate limit, and offer MFA, required for staff.
10. **User enumeration.** Use one message for both cases.

**No safety net**

11. **Secrets in the repository.** Rotate both now, and move them to a secrets manager.
12. **Request bodies in logs.** The logs hold passwords and personal data. Stop, and restrict the logs that exist.
13. **No detection.** Logs on the web server vanish with it, and nothing raises an alert. Ship logs to a central store and alert on failed logins, refused access and exports.

The ranking follows what an attacker needs. Items 1 and 2 need nothing but a browser. Items 3 to 5 need an ordinary account, which anyone can register. The rest make each of those worse, or leave the company unable to tell that any of it happened.

## Review 2: a small change {independent}

A developer opens a change that adds "share this report by link". The description reads:

- A new endpoint `GET /shared?report_id=123&uid=5521` returns the report with no login, so that people outside the company can view it.
- The link is generated in the browser from the report ID and the current user's ID.
- The report page includes the viewer's name in the title, taken from a `name` parameter in the URL.
- To speed up loading, the API now sends `Access-Control-Allow-Origin` with the value of the request's `Origin` header, and allows credentials.

List the problems in this change, and describe how the feature should be built.

## Review 2: what is wrong {walkthrough}

**Problems**

1. **Every report is public.** The endpoint needs no login, and the link has only guessable numbers. Anyone can read any report by changing `report_id`. The `uid` adds nothing, since it is not checked and is guessable too.
2. **The link is made in the browser.** The server never recorded that this report was shared, so it cannot tell a real share from a made-up link, and cannot revoke one.
3. **Reflected cross-site scripting** through `name`, if it is written into the page without encoding. Even with encoding, the page shows whatever name the link's author chose, which helps a phishing message look real.
4. **The CORS change disables the same-origin policy** for the whole API. Any website can read users' data with their cookies. It is unrelated to loading speed and should not be in this change.

**How to build it**

- "Share" is a server action. The owner calls `POST /reports/123/shares`. The server checks that the caller owns the report, creates a random token of at least 128 bits, stores its hash with the report ID, the creator and an expiry, and returns the link.
- The public endpoint is `GET /shared/{token}`. It looks the token up, checks the expiry, and returns that one report and nothing else.
- The owner can list and revoke shares. Each view is logged.
- The token goes in the path, and the page loads no third-party scripts, so the token is not passed on in a `Referer` header.
- No names or other content come from the URL.
- The CORS setting stays as an explicit list of the company's own origins.

The lesson is about review. Each line of the description sounds like a small convenience. Reading a change with the six questions from the start of this module is what shows that one of them publishes every report.

## Design: a feature from the start {independent}

Your team will build "team invitations" for a product where organizations have members with the roles `member` and `admin`. An admin enters an email address and a role. The invited person receives an email with a link, and joining through it makes them a member of the organization with that role.

Design it with security in mind. Write the flow, the checks at each step, what is stored, what is logged, and the limits you would set. Use STRIDE to check your design.

## Design: one possible answer {walkthrough}

**Flow and checks**

1. **Create.** `POST /organizations/{org_id}/invitations` with `email` and `role`. The server checks, from the session, that the caller is an admin of `org_id`. It validates the email format and that `role` is one of the two allowed values. It generates a random token of 128 bits or more and stores only its hash.
2. **Email.** The message contains the link with the token, and names the organization and the inviter, so the recipient can judge it. It contains no other data.
3. **Accept.** The recipient opens the link and must log in or register. The server then checks that the token's hash exists, is unused and has not expired, and that the logged-in account's verified email matches the invited email. Only then does it add the membership, with the role stored on the invitation and never a role from the request. It marks the invitation as used.

**Stored.** Organization ID, invited email, role, token hash, inviter, created and expiry times, and when and by whom it was used.

**Limits.** Invitations expire after 7 days and work once. Each organization and each admin has a cap on invitations per day. Admins can list and revoke pending invitations.

**Logged.** Invitation created, revoked, accepted and refused, with actor, organization, role and source. An invitation to the `admin` role raises an alert, or needs a second admin to approve.

**STRIDE check**

| | Threat | Covered by |
| --- | --- | --- |
| S | Someone else uses a forwarded or leaked link | The accepting account's verified email must match the invited one |
| T | The role or organization is changed at acceptance | Both are read from the stored invitation, not from the request |
| R | An admin denies having invited someone | The inviter is recorded and logged |
| I | The endpoint reveals whether an email has an account | The response is the same either way |
| D | The feature is used to send floods of email to strangers | Rate limits per admin and per organization |
| E | A member invites themselves as an admin | Only admins may invite, checked on the server. Admin invitations are alerted on |

The two decisions that carry the most weight are matching the email at acceptance and reading the role from the stored record. Without the first, an invitation link is a bearer token to anyone who sees it. Without the second, any invitation can become an admin invitation.

## What to check first {prediction}

You have one hour to look at an unfamiliar web application before it goes live. You cannot review everything.

:::question one-hour
Where is the hour best spent?
- [ ] Reading the cryptographic code for subtle flaws :: Most applications use standard libraries there. The common serious flaws are elsewhere.
- [x] Checking that each endpoint verifies the caller may act on that specific object, that queries use parameters, and that no secrets are in the repository :: Missing access checks, injection and leaked secrets are common, severe and quick to look for.
- [ ] Checking that the password rules require symbols :: Composition rules add little. This would not find anything serious.
:::

## Where to go next {explanation}

You can now look at a system and ask where input enters, how identity is established, where access is checked, what secrets exist and how a breach would be noticed.

Four habits are worth keeping.

- **Distrust everything from across a boundary**, and make it safe at the place where it is used.
- **Check authorization on the server, per object, on every request**, and deny by default.
- **Hold less:** fewer secrets, less data, fewer dependencies, fewer open endpoints.
- **Assume something will get through**, and make sure it would be seen.

Security knowledge dates quickly. New kinds of flaw appear, and advice changes. Good places to keep current are the OWASP Top 10 and its cheat sheets, the security guidance for the frameworks you use, and the published reviews of real incidents, which teach more than any list.

At work, your organization's security team and its policies take precedence over anything in this course. When in doubt about something real, ask them.
