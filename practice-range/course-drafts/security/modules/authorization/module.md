---
id: course:security/module/authorization
title: Authorization
requires: []
outcomes: []
tasks: []
drills: []
---

Authorization decides what a known user may do. Missing or wrong checks here are the most common serious flaw in web applications. This module covers how those checks go missing, how to structure them, and how to give out no more access than is needed.

The advice here is general guidance, not any organization's policy.

## The check that is not there

After login, the system knows who is asking. Authorization is the separate question of whether this user may perform this action on this particular thing.

The usual failure is not a wrong rule. It is a missing one. An endpoint checks that the user is logged in and then does what the request says, for whichever record the request names.

In lists of the most serious web application risks, such as the OWASP Top 10, **broken access control** sits at the top. It is easy to introduce, since forgetting a check produces no error and no failing test. Everything works for honest users.

## Changing the ID

Suppose an endpoint returns an invoice: `GET /invoices/1041`. The code confirms the user is logged in and loads invoice 1041.

A user who is shown their own invoice at `/invoices/1041` tries `/invoices/1042`. If the server returns it, they can read every invoice in the system by counting.

This flaw is called an **insecure direct object reference** (IDOR). The request names an object directly, and the server never asks whether it belongs to the caller.

The fix is to check ownership on every access. The most reliable way is to make ownership part of the query itself.

```sql
-- flawed: any invoice, for anyone who is logged in
SELECT * FROM invoices WHERE id = $1;

-- fixed: only this user's invoice
SELECT * FROM invoices WHERE id = $1 AND customer_id = $2;
```

The second parameter comes from the session on the server, never from the request. An invoice that belongs to someone else is then simply not found.

```text example idor readonly
   user 17 is logged in

   GET /invoices/1041     owned by 17     ->  shown          correct
   GET /invoices/1042     owned by 23     ->  shown          the flaw

   The server checked "is someone logged in?"
   It never checked "does invoice 1042 belong to user 17?"
```

## Random IDs are not a check

A common response is to replace `1042` with a long random identifier, so that the next one cannot be guessed. That helps. It does not fix the flaw.

Identifiers leak. They appear in links people share, in browser history, in logs, in emails and in the `Referer` header. Once someone has an identifier, an endpoint with no ownership check serves the record.

Unguessable IDs are a useful extra layer, and they stop an attacker from counting through every record. The authorization check is still required.

## Two directions

Access control fails in two directions, and both need checking.

**Horizontal.** A user reaches another user's data at the same level: someone else's invoice, messages or profile. This is the IDOR case.

**Vertical.** A user performs an action that needs a higher level: an ordinary user calls an administrator's endpoint. A typical cause is an admin page that is hidden from the menu and whose endpoints check nothing.

Hiding a button is not access control. The endpoint behind it is reachable by anyone who knows or guesses its address.

```text example directions readonly
   VERTICAL
                 admin functions       <- a normal user calls an
                       ^                  admin endpoint
                       |
   user A  <---------> user B          <- user A reads user B's data
                 HORIZONTAL
```

## The hidden page {prediction}

An application shows an "Admin" link in the menu only to administrators. The page it leads to, `/admin/users`, and the endpoint it calls, `POST /admin/users/delete`, check only that the caller is logged in.

:::question hidden-admin
What can an ordinary user do?
- [ ] Nothing, since they cannot see the link :: Not seeing a link does not stop anyone from typing its address or sending the request by hand.
- [x] Open the page and delete users, by requesting those addresses directly :: The menu is presentation. The server performs whatever a logged-in user asks for. Every admin endpoint must check the caller's role itself.
- [ ] View the page, without being able to delete :: The delete endpoint has the same missing check as the page.
:::

## Check on the server, every time

Three rules prevent most of these flaws.

- **Enforce on the server.** Anything in the browser is advice to honest users.
- **Check every request.** Not only the page that leads to the action, and not only the first step of a multi-step flow. Each endpoint stands alone, since each can be called alone.
- **Check the specific object.** "May this user edit documents" is not enough. The question is "may this user edit this document".

A flow with several steps is a common trap. Step 1 checks permission and step 3 performs the action. An attacker calls step 3 directly.

## Deny by default

Structure the code so that forgetting a check results in no access.

The fragile design has each endpoint remember to call a check. A new endpoint written in a hurry has none, and is open to everyone.

The sturdy design turns it around. A central layer, such as middleware or a framework's policy system, refuses every request unless a rule explicitly allows it. A new endpoint with no rule is closed. The mistake then shows up as a feature that does not work, which is noticed at once, and not as an open door, which is not noticed at all.

Keep the rules in one place where you can. Authorization logic scattered through a hundred handlers cannot be reviewed.

## Roles and attributes

There are two common ways to express who may do what.

**Role-based access control** (RBAC) assigns users to roles such as `viewer`, `editor`, `admin`, and grants permissions to roles. It is simple to understand and to audit. It struggles when rules depend on the data: "editors may edit only documents in their own department".

**Attribute-based access control** (ABAC) decides from attributes of the user, the object and the context: the user's department, the document's owner, the time of day. It expresses fine-grained rules and is harder to reason about.

Most applications use roles for the broad strokes and add ownership checks for particular objects. Whichever model you use, the question is the same: can you say, for any user and any object, whether access is allowed, and can you test it?

## Least privilege

**Least privilege** means giving each user, service and credential only the access its job requires, and no more.

It applies beyond human users.

- **Service accounts.** The application's database account can read and write its own tables. It cannot drop them or read another service's data.
- **API keys.** A key for reading reports cannot issue refunds. Scope keys to one purpose.
- **Cloud roles.** A function that writes to one storage bucket has permission for that bucket, not for all storage.
- **People.** Engineers do not have standing administrator access to production. They request it for a task, for a limited time, and it is logged.

The benefit shows when something is compromised. A stolen credential can do only what that credential could do. This limit is called the **blast radius**. Least privilege keeps it small.

Access also accumulates. People change teams and keep their old permissions. Review access on a schedule and remove what is no longer needed.

## Multi-tenant systems

In a product that serves many customers from one database, each customer is a **tenant**. The most damaging authorization flaw there is one tenant seeing another's data.

Every query must be limited to the caller's tenant. Relying on every developer to add `WHERE tenant_id = ...` to every query will fail eventually. Stronger designs enforce it underneath the application code.

- A data-access layer that adds the tenant condition to every query automatically.
- **Row-level security** in the database: a rule on the table that hides rows of other tenants whatever query is run.
- For the most sensitive cases, a separate database or schema per tenant.

Test it directly. Create two tenants in a test, log in as one and try to read every kind of object that belongs to the other.

## Test the refusals

Functional tests check that allowed things work. Authorization flaws are things that should be refused and are not, so they need tests of their own.

For each endpoint, write tests that call it:

- with no login,
- as a user with too low a role,
- as a user of the right role who does not own the object,
- as a user of another tenant.

Each must be refused. These tests are dull to write, and they are the only automated protection against the most common serious flaw.

One detail on the response: for an object that exists and is not the caller's, returning `404 Not Found` in place of `403 Forbidden` avoids confirming that the object exists.

## The multi-step flow {prediction}

A refund takes three requests: `POST /refunds/start` checks that the caller is a manager and returns a refund ID. `POST /refunds/{id}/amount` sets the amount. `POST /refunds/{id}/confirm` pays it out. Only the first checks the role.

:::question steps
What is the flaw?
- [ ] None. The first step guards the flow :: The steps are separate endpoints, and each can be called without the others.
- [x] Anyone logged in can call the later steps directly, for any refund ID :: A non-manager can set amounts and confirm refunds that a manager started, or guess IDs. Every step must check the role and that the refund belongs to the caller's scope.
- [ ] Only that the flow is slow :: The number of requests is not a security problem.
:::

## Exercise: find the missing checks {independent}

A project management tool has organizations, projects inside them, and tasks inside projects. Users have a role per organization: `member` or `admin`. Review these endpoints. Each one checks only that the caller is logged in.

1. `GET /tasks/{task_id}` returns a task.
2. `PATCH /tasks/{task_id}` updates a task. The body may contain any task field, including `project_id`.
3. `GET /organizations/{org_id}/members` lists members with their email addresses.
4. `POST /organizations/{org_id}/members` adds a member. The body contains `user_id` and `role`.
5. `GET /export?org_id=...` returns all of an organization's data.
6. The front end hides the "Add member" button from non-admins.

Say what an attacker can do with each, and write the check each needs.

## One possible answer {walkthrough}

1. **Read any task in any organization**, by trying IDs. Check: the task's project belongs to an organization the caller is a member of. Do it in the query, by joining tasks to projects to memberships with the caller's user ID.
2. **Change any task, and move it.** Beyond editing other organizations' tasks, setting `project_id` moves a task into or out of a project the caller has no right to. Check membership for the task's current project and for the target project, and accept only a listed set of fields.
3. **Collect every organization's member emails.** Check: the caller is a member of `org_id`.
4. **Join any organization as an admin.** A caller posts their own `user_id` with `role: admin`. Check: the caller is an admin of `org_id`. This is the most serious, since it grants full access to everything else.
5. **Download any organization's data.** Check: the caller is an admin of `org_id`. Take extra care here, since it is the most sensitive read: ask for the password again, rate limit it and log it.
6. **Nothing is protected by this.** It is fine as presentation. The check belongs on endpoint 4.

**The structural fix.** Six endpoints, six missing checks: the pattern is that each handler was meant to remember. Put a rule in front of every route: resolve the organization from the path or from the object, load the caller's role in it, and refuse unless the route's required role is met. A route with no declared rule is refused. Then add tests that call every endpoint as a member of a different organization.
