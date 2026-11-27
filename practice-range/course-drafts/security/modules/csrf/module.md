---
id: course:security/module/csrf
title: Cross-site requests
requires: []
outcomes: []
tasks: []
drills: []
---

A browser will send a request to your site from a page on someone else's, and it will attach your cookies when it does. This module covers the attack that follows from that, the rule that keeps sites from reading each other's data, and what CORS does and does not do.

The advice here is general guidance, not any organization's policy.

## The same-origin policy

An **origin** is a scheme, a host and a port taken together: `https://app.example.com` is one origin, and `https://api.example.com` is another, since the hosts differ.

Browsers enforce the **same-origin policy**: script running on one origin cannot read responses from another origin. A page on a stranger's site cannot fetch your bank's account page and read the balance, although you are logged in to the bank in another tab.

This rule is the base of web security. Without it, any site you visited could read your email.

Note what the rule covers. It stops a page from **reading** another origin's response. It does not stop a page from **sending** a request to another origin. That gap is what this module is about.

```text example origin readonly
   https://app.example.com:443/orders/7
   \___/   \_____________/ \_/
   scheme       host       port        these three are the origin

   https://app.example.com     and  https://app.example.com/x    same
   https://app.example.com     and  http://app.example.com       different
   https://app.example.com     and  https://api.example.com      different
```

## Cross-site request forgery

Cookies are attached to requests by the browser automatically, according to where the request is going. Historically it did not matter which page started the request.

So consider a user who is logged in to their bank. In another tab, they open a page controlled by an attacker. That page contains a hidden form addressed to the bank, and submits it with script.

```html
<form action="https://bank.example.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker-account">
  <input type="hidden" name="amount" value="5000">
</form>
```

The browser sends the request to the bank and attaches the bank's session cookie. The bank sees a correctly authenticated request for a transfer and carries it out. The user saw nothing.

This is **cross-site request forgery** (CSRF). The attacker never sees the cookie and cannot read the response. They do not need to. They only need the action to happen.

```text example csrf readonly
   1. victim is logged in to bank.example.com   (cookie in the browser)

   2. victim opens evil.example.net

   3. that page submits a hidden form to
      bank.example.com/transfer

   4. the browser attaches the bank's cookie    <- the whole problem

   5. the bank sees a valid session and
      performs the transfer
```

## What makes a request forgeable

A request can be forged when three things are true.

- It **changes something**: transfers money, changes an email address, deletes data.
- It is **authenticated by something the browser attaches automatically**: a cookie, or HTTP basic authentication.
- It **contains nothing the attacker cannot predict**. Every parameter can be filled in by the attacker's page.

Remove any one of the three and the attack fails. The defences below each remove one.

An API that is authenticated only by a token in an `Authorization` header, added by script, is not open to CSRF. The browser does not add that header by itself, so another site's page cannot cause it to be sent.

## SameSite cookies

The `SameSite` cookie attribute tells the browser when to attach a cookie to a request that another site started.

| Value | The cookie is sent on cross-site requests |
| --- | --- |
| `Strict` | Never. Even following a link from another site arrives logged out |
| `Lax` | Only for top-level navigation with a safe method, such as clicking a link. Not for form posts, images or script requests |
| `None` | Always. Requires `Secure` |

With `SameSite=Lax`, the hidden form post in the example arrives without the session cookie, and the bank treats it as a request from someone not logged in.

Modern browsers apply `Lax` when no value is given. Set it explicitly anyway. Do not depend on a default that has differed between browsers and over time.

`Lax` is the usual choice. `Strict` suits very sensitive applications, at the cost that a link from an email opens a logged-out page.

## Anti-CSRF tokens

The older, stronger defence removes the predictability. The server gives each session a random **CSRF token** and includes it in every form it renders, as a hidden field. When a form is submitted, the server checks that the token in the request matches the one for the session.

An attacker's page cannot read the token, because the same-origin policy stops it reading your pages. So it cannot build a request the server will accept.

Web frameworks provide this. Turn it on, and do not switch it off for particular endpoints because it was inconvenient.

Use both layers: `SameSite` cookies, and tokens on every state-changing request. Each covers gaps in the other, such as older browsers, or sibling subdomains that count as the same site.

## Safe methods must be safe

`SameSite=Lax` still sends cookies on a cross-site `GET` navigation. Tokens are normally checked only on `POST`, `PUT`, `PATCH` and `DELETE`. Both rest on one assumption: a `GET` request never changes anything.

An endpoint such as `GET /account/delete?confirm=yes` breaks that assumption. A plain link or an image tag on another site triggers it, with the cookie attached.

So `GET` must only read. Anything that changes state uses another method. This is an HTTP rule first and a security rule second.

## The delete link {prediction}

A site's session cookie is `SameSite=Lax`. To remove an item, its pages link to `GET /cart/remove?item=42`. An attacker's page contains a link to that URL, labelled "Claim your prize".

:::question get-change
What happens when a logged-in user clicks it?
- [ ] Nothing. `Lax` blocks cross-site requests :: `Lax` blocks cross-site form posts and embedded requests. A top-level navigation with `GET` is allowed, with cookies.
- [x] The item is removed from their cart :: A clicked link is a top-level `GET` navigation, so the cookie is sent. The fault is a `GET` that changes state. Make it a `POST` with a CSRF token.
- [ ] The browser asks the user to confirm :: Browsers do not ask before following a link.
:::

## CORS

Sometimes you want another origin to read your responses. A front end on `app.example.com` calls an API on `api.example.com`. The same-origin policy blocks that by default.

**CORS** (cross-origin resource sharing) is how a server tells the browser to relax the rule for named origins. The server adds response headers, and the browser decides whether the calling page may see the response.

```http example cors readonly
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type, Authorization
```

For requests that are not simple, such as a `PUT` or one with a JSON content type, the browser first sends a **preflight**: an `OPTIONS` request that asks whether the real request is permitted. If the answer does not allow it, the real request is never sent.

## What CORS is not

CORS is widely misread, and the misreadings cause real flaws.

- **CORS is not a defence.** It loosens a protection. A server with no CORS headers is at its most restrictive.
- **CORS does not stop requests from being sent.** A simple cross-site `POST` reaches your server whatever your CORS settings say. CORS only decides whether the page may read the reply. It does not prevent CSRF.
- **CORS is enforced by browsers only.** A script, a command-line tool or another server ignores it. It is no substitute for authentication.

The dangerous configuration is to echo back whatever origin the request names while also allowing credentials. That tells every site on the internet that it may make authenticated requests to your API and read the answers. It disables the same-origin policy for your users.

List the allowed origins explicitly. A wildcard (`*`) is acceptable only for truly public data, and browsers refuse to combine it with credentials.

```text example cors-wrong readonly
   DANGEROUS                              CORRECT

   read the request's Origin header,      compare Origin with a fixed list:
   and send it back as allowed,             https://app.example.com
   with credentials allowed                 https://admin.example.com
                                          allow only an exact match
   = every website may read your
     users' data as them
```

## Clickjacking

A related trick does not forge a request. It gets the user to make a real one. The attacker loads your page in an invisible frame on top of their own page, and places something tempting under the spot where your "Delete account" button sits. The user believes they are clicking the attacker's page.

This is **clickjacking**. The defence is to tell browsers that your pages may not be framed by other sites.

```http example frame readonly
Content-Security-Policy: frame-ancestors 'self'
X-Frame-Options: DENY
```

The first header is the current standard. The second is its older form, still worth sending.

## The permissive API {prediction}

An API sets `Access-Control-Allow-Origin` to whatever value arrives in the request's `Origin` header, and sets `Access-Control-Allow-Credentials: true`. It authenticates with a session cookie that is `SameSite=None`.

:::question cors-echo
What can a page on any other website do when a logged-in user visits it?
- [ ] Nothing, since CORS is enabled :: CORS being "enabled" this way is the fault. It permits every origin.
- [x] Call the API as that user and read the responses :: The cookie is sent, since it is `SameSite=None`, and the echoed origin with credentials tells the browser to let the page read the reply. Any site can extract the user's data.
- [ ] Send requests, without being able to read the replies :: That would be true without the permissive CORS headers. With them, reading is allowed too.
:::

## Exercise: review the endpoints {independent}

An application has a browser front end on `https://app.example.com` and an API on `https://api.example.com`. Sessions use a cookie. Review this setup.

1. The session cookie is `Secure; HttpOnly` with no `SameSite` attribute.
2. `POST /api/email` changes the user's email address. It takes `new_email` and has no CSRF token.
3. `GET /api/logout` ends the session.
4. The API answers every request with `Access-Control-Allow-Origin: *`.
5. The settings page can be loaded in a frame by any site.
6. A separate public endpoint, `GET /api/status`, returns the service's version and needs no login.

For each, say whether there is a problem and what to do.

## One possible answer {walkthrough}

1. **Relies on a browser default.** Most browsers now treat a missing value as `Lax`, and that has not always been so. Set `SameSite=Lax` explicitly.
2. **Forgeable, and serious.** It changes state, is authenticated by a cookie, and has one predictable parameter. An attacker's page changes the victim's email to their own and then uses "forgot password" to take the account. Add a CSRF token, set `SameSite`, and require the password to change an email address.
3. **A state change on `GET`.** Any page can log users out with an image tag. It is a nuisance more than a breach, and it shows a habit that will cause worse. Make it a `POST`.
4. **Too broad, though not catastrophic as written.** Browsers refuse to send credentials with a wildcard, so authenticated data stays unreadable to other sites. The risk is the next change, when someone "fixes" a credentials error by echoing the origin. Replace the wildcard with the one real origin, `https://app.example.com`.
5. **Clickjacking.** Send `Content-Security-Policy: frame-ancestors 'self'`.
6. **Fine as a public endpoint**, with one remark. The exact version number helps an attacker look up known flaws for it. Consider leaving it out.

Item 2 is the one to fix today. It turns a visit to any hostile page into the loss of the account.
