---
id: course:security/module/sessions
title: Sessions and tokens
requires: []
outcomes: []
tasks: []
drills: []
---

HTTP does not remember who you are from one request to the next. After login, something has to carry that fact. This module covers the two ways to do it, how each is stolen or misused, and how to end a session properly.

The advice here is general guidance, not any organization's policy.

## The problem

A user proves their identity once, at login. Every later request must show that it comes from that same user, without asking for the password again.

The answer is always a **credential** issued at login and presented with each request. Anyone who holds it is treated as the user. So this credential is as valuable as the password for as long as it is valid, and it needs the same protection.

There are two designs: a session ID that points at data on the server, and a token that carries the data itself.

## Server-side sessions

At login, the server creates a **session**: a record that says "this session belongs to user 17, started at this time". It stores the record in a database or a cache, and gives the browser a **session ID**, which is a long random string.

The browser sends the ID with every request, in a cookie. The server looks the ID up and finds the user.

The ID carries no information. It is only a key to the record. That gives this design its main strength: the server is in control. To log a user out, or to cut off a stolen session, delete the record. The next request with that ID finds nothing.

```text example session readonly
   LOGIN
   browser --- email + password ------------------>  server
           <-- Set-Cookie: sid=k3Xp9aTq8w... -------  creates a record:
                                                      k3Xp9a... = user 17

   LATER REQUESTS
   browser --- Cookie: sid=k3Xp9aTq8w... ---------->  looks up the record
           <-- the page for user 17 ---------------   finds user 17

   LOGOUT: delete the record. The ID now means nothing.
```

## The session ID must be unguessable

If an attacker can guess or predict a valid ID, they are logged in as its owner. So an ID must be:

- **Long and random**, from a cryptographically secure random source, with at least 128 bits of randomness.
- **Never derived** from the user ID, the time or a counter.
- **Replaced at login.** If the ID from before login is kept afterwards, an attacker who planted a known ID in the victim's browser shares the session once the victim logs in. This is **session fixation**. Issue a fresh ID whenever the level of privilege changes.

Use the session mechanism of your framework. It does these things already.

## Cookie attributes

A session cookie should be set with attributes that limit where it goes and who can read it.

| Attribute | Effect |
| --- | --- |
| `HttpOnly` | Script in the page cannot read the cookie. An injected script cannot copy the session |
| `Secure` | The cookie is sent only over HTTPS, never in the clear |
| `SameSite=Lax` or `Strict` | The cookie is not sent on most requests started by other sites. The next module explains why |
| `Path` and `Domain` | Limit which URLs receive it. Keep the domain as narrow as possible |
| An expiry | Without one, the cookie lasts until the browser closes. With one, it persists |

```http example cookie readonly
Set-Cookie: sid=k3Xp9aTq8wm1ZrV7; HttpOnly; Secure; SameSite=Lax; Path=/
```

All three of `HttpOnly`, `Secure` and `SameSite` belong on every session cookie. Leaving one out removes a layer for no benefit.

## Tokens that carry their own data

The second design puts the information in the credential. The best-known format is the **JSON Web Token** (JWT). It has three parts joined by dots.

- A **header** that says how it is signed.
- A **payload** of **claims**: who the user is, when the token expires, who issued it.
- A **signature** over the first two, made with a key that only the issuer holds.

A server that receives the token checks the signature and the expiry and then trusts the claims, without looking anything up. That makes tokens convenient when many separate services need to verify a user, since none of them needs access to a shared session store.

Two facts about a JWT are often misunderstood.

- The payload is **encoded, not encrypted**. Anyone who holds the token can read it. Never put a secret in it.
- It cannot be changed without breaking the signature. A user who edits `"role": "user"` to `"role": "admin"` produces a token that fails verification, provided the server really verifies.

```text example jwt readonly
   header . payload . signature

   {"alg":"RS256"}        how it is signed
   {"sub":"17",           who it is about
    "exp":1741100000,     when it stops being valid
    "iss":"auth.example.com",
    "aud":"orders-api"}   who it is meant for
   (signature)            proves the first two parts are unchanged

   Readable by anyone who holds it. Changeable by nobody without the key.
```

## Validate a token completely

A token is only as safe as its verification. Every one of these checks is required.

- **The signature**, using a key you already trust. Fix the algorithm in your own configuration. A classic flaw was to accept whatever algorithm the token's header named, including `none`.
- **The expiry** (`exp`). Reject an expired token.
- **The issuer** (`iss`). It must be the one you expect.
- **The audience** (`aud`). It must be your service. Without this check, a token issued for one service can be replayed against another.

Use a maintained library and configure all four. Hand-written JWT handling is a common source of serious flaws.

## The trouble with revoking tokens

A self-contained token is valid until it expires. The server looks nothing up, so there is nothing to delete. If a token is stolen, or the user logs out, or an administrator removes someone's access, the token keeps working.

The standard arrangement keeps the damage small.

- A short-lived **access token**, valid for minutes, is sent with each request.
- A long-lived **refresh token** is kept more carefully and used only to obtain new access tokens. It is checked against the server's records each time, so it can be revoked.

When access is removed, the refresh token is revoked. The access token dies by itself within minutes. For cases that cannot wait even that long, services check a list of revoked tokens, which brings back the lookup that tokens were meant to avoid.

| | Server-side session | Self-contained token |
| --- | --- | --- |
| Server keeps state | Yes | No |
| Revoke at once | Yes, delete the record | Not without extra machinery |
| Works across many services | Needs a shared store | Yes |
| Readable by the holder | No, the ID means nothing | Yes |
| Good default for | A web application | APIs called by several services |

For an ordinary web application with one backend, a server-side session in a cookie is simpler and safer. Reach for tokens when you have a reason.

## After the firing {prediction}

A company's internal tool uses JWTs that are valid for 30 days, with no refresh tokens and no revocation list. An employee is dismissed at 10:00, and their account is disabled in the user directory.

:::question revoke
Can they still use the tool at 11:00?
- [ ] No, since the account is disabled :: The tool does not consult the directory on each request. It only verifies the token's signature and expiry.
- [x] Yes, for up to 30 days, with the token they already hold :: A self-contained token stays valid until it expires. Short-lived access tokens with a revocable refresh token would limit this to minutes.
- [ ] Yes, but only to read data :: The token grants whatever it granted before. Nothing about it has changed.
:::

## Where the browser keeps it

In a browser, a credential can live in a cookie or in storage that scripts can read, such as `localStorage`.

Anything script can read, an injected script can steal. One cross-site scripting flaw then hands the attacker a credential they can use from their own machine, for as long as it is valid.

A cookie marked `HttpOnly` cannot be read by script. An injected script can still send requests while the page is open, and it cannot carry the credential away. That is a real difference, and it is why an `HttpOnly` cookie is the better place for a session credential in a web application.

Cookies are sent automatically, which creates the cross-site request problem covered in the next module. `SameSite` is the answer to that.

## Expiry and logout

A session should not last for ever.

- **Idle timeout.** End the session after a period with no activity. Choose the period by sensitivity: minutes for banking, days for a low-risk site.
- **Absolute timeout.** End it after a maximum age whatever the activity, so a stolen session cannot be kept alive indefinitely.
- **Logout that works.** Delete the session record on the server. Clearing the cookie in the browser alone leaves a credential that still works if someone copied it.
- **End sessions on a password change**, and let users see their active sessions and end them.

## Which storage {prediction}

A single-page application keeps its access token in `localStorage` and adds it to each request from script. A cross-site scripting flaw is found in its comments page.

:::question storage
What can the attacker's script do?
- [ ] Only act while the victim has the page open :: That would be the limit if the credential were in an `HttpOnly` cookie.
- [x] Read the token and send it to the attacker, who can then use it from anywhere until it expires :: Script-readable storage is readable by injected script. The session leaves the victim's browser entirely.
- [ ] Nothing, since tokens are signed :: The signature stops the token being altered. It does nothing to stop a valid token being copied and used.
:::

## Exercise: review the session handling {independent}

A web application handles sessions as follows.

1. The session ID is the user's numeric ID followed by the login time, for example `5521-1741096931`.
2. The cookie is set with `Set-Cookie: sid=...; Path=/` and nothing else.
3. The ID a visitor has before login is kept after login.
4. Sessions never expire.
5. "Log out" deletes the cookie in the browser.
6. A second service receives a JWT from the first, decodes the payload to get the user ID, and does not check the signature, "because the network is internal".

List the problem with each and the fix.

## One possible answer {walkthrough}

1. **A guessable ID.** A user ID and a timestamp can be worked out for any account. Generate IDs from a secure random source with at least 128 bits.
2. **No protective attributes.** The cookie can be read by script, sent over plain HTTP and sent on cross-site requests. Add `HttpOnly`, `Secure` and `SameSite=Lax`.
3. **Session fixation.** An attacker who sets a known ID in the victim's browser before login is logged in with them afterwards. Issue a new ID at login.
4. **No expiry.** A session stolen once works for ever. Add an idle timeout and an absolute one.
5. **Logout in name only.** The record still exists on the server, so a copied ID keeps working. Delete the server-side session.
6. **An unverified token.** Anyone who can reach the second service can write a payload with any user ID. Verify the signature with a fixed algorithm and a trusted key, and check expiry, issuer and audience. "Internal" is not a control. One compromised machine inside the network can send requests like any other.

Items 1 and 6 let an attacker become any user without stealing anything. They come first.
