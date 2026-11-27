---
id: course:security/module/xss
title: Cross-site scripting
requires: []
outcomes: []
tasks: []
drills: []
---

Cross-site scripting is injection into a web page. A user's text is placed into HTML in a way that lets the browser run it as script. This module covers how it happens, what such a script can do, and the layers that prevent it.

The advice here is general guidance, not any organization's policy.

## The flaw

A page is built from fixed HTML and from data. When the data is a user's text and it is placed into the page unchanged, the browser cannot tell it from the page's own markup.

Suppose a page shows a search term back to the user by putting it straight into the HTML. If the term is `shoes`, the result is harmless.

```html
<p>Results for: shoes</p>
```

If the "term" is a script tag, the browser receives this and runs it:

```html
<p>Results for: <script>/* attacker's code */</script></p>
```

This is **cross-site scripting**, shortened to XSS. It is the same mistake as SQL injection, code and data mixed in one string, with HTML as the language and the victim's browser as the interpreter.

## What an injected script can do

A script that runs in a page runs as that site, with everything the site's own scripts can do, in the browser of whoever is looking at the page.

- Read anything on the page: messages, account details, tokens held in the page.
- Send requests to the site as the logged-in user: change the email address, make a purchase, post content.
- Change what the page shows: a false login form, altered payment details.
- Record what the user types.
- Read cookies and browser storage, unless they are protected.

The attacker does not need the victim's password. They are using the victim's own logged-in session, from inside it. If the victim is an administrator, the script has an administrator's rights.

## Three kinds

| Kind | Where the script comes from | Who is hit |
| --- | --- | --- |
| Stored | Saved in the database (a comment, a profile name) and shown to others | Everyone who views it |
| Reflected | Carried in the request (a link with a crafted parameter) and echoed in the response | Whoever opens the link |
| DOM-based | Never reaches the server. Page script reads it from the URL and writes it into the page | Whoever opens the link |

Stored XSS is the most serious, since it needs no trick to deliver. A script in a comment runs for every visitor to that page, including staff who moderate it.

```text example stored readonly
   1. attacker posts a comment containing script

   2. the server saves it        comments table: "<script>...</script>"

   3. victim opens the page      the server puts the comment
                                 into the HTML unchanged

   4. victim's browser           runs the script as the site,
                                 with the victim's session
```

## Output encoding

The main defence is **output encoding** (also called escaping). When data is placed into HTML, each character that has meaning in HTML is replaced by a code that the browser displays as that character and does not act on.

| Character | Replaced by |
| --- | --- |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

After encoding, the script tag from the earlier example arrives as text. The browser shows the characters on the screen and runs nothing.

Encode at the moment of output, not at input. Store the user's text as they typed it. The same text may later go into HTML, a JSON response, a CSV file or an email, and each needs different treatment. Encoding once at the entrance gets all but one of them wrong.

## Let the template engine do it

Nobody should encode by hand. Modern template engines and front-end frameworks encode every value by default. A value placed in a template is treated as text unless you explicitly say otherwise.

That makes XSS in modern code a matter of the exceptions. Look for these.

- **The "raw" or "unsafe" output feature** of the template engine, which switches encoding off for one value.
- **Setting HTML from a string in script**, such as assigning to `innerHTML`. Assigning to `textContent` is the safe counterpart.
- **Framework escape hatches** with names that warn you, such as `dangerouslySetInnerHTML` or `v-html`.
- **Values placed where HTML encoding is the wrong kind**, covered in the next section.

In a code review, search for those features by name. Each use needs a reason, and proof that the value cannot contain user input.

## Context matters

HTML encoding is right for text between tags. A value placed somewhere else in the page needs the encoding of that place, or should not be put there at all.

| Where the value goes | What is needed |
| --- | --- |
| Between tags: `<p>VALUE</p>` | HTML encoding |
| In a quoted attribute: `title="VALUE"` | Attribute encoding, and the quotes must be there |
| In a link target: `href="VALUE"` | Check that the scheme is `http` or `https`. A `javascript:` URL runs script when clicked |
| Inside a script block | Avoid it. Put the data in a data attribute or a JSON block, and read it from script |
| Inside a style block or attribute | Avoid it |

The link case is the one most often missed. HTML encoding leaves `javascript:alert(1)` unchanged, since it contains no special HTML characters. A "website" field in a profile that is used as a link target needs its scheme checked.

```text example contexts readonly
   <p> VALUE </p>                HTML-encode             common, easy

   <a href="VALUE">              also check the scheme   often missed
                                 (allow http, https)

   <script> x = "VALUE" </script>   do not do this       hard to get
                                                         right
```

## The link field {prediction}

A profile page shows a user's website as a link. The template engine HTML-encodes the value automatically. A user sets their website to `javascript:` followed by some script.

:::question link-scheme
What happens when another user clicks the link?
- [ ] Nothing. The value was HTML-encoded :: Encoding changes characters such as `<` and `"`. This value contains none of them, so it passes through unchanged.
- [x] The script runs in the page :: A `javascript:` URL is executed when followed. Encoding is the wrong defence here. Accept only values that begin with `http://` or `https://`.
- [ ] The browser blocks it, since it is not a web address :: Browsers follow `javascript:` URLs in links.
:::

## When users may write HTML

Some features need users to supply formatted content: a rich-text editor, a comment with bold and links. Encoding everything would show the tags as text.

The answer is **sanitisation**: parse the HTML and keep only an allowlist of harmless tags and attributes, such as `b`, `i`, `p`, `a` with a checked `href`. Everything else is dropped.

Use a well-maintained sanitising library for this. Writing your own with pattern matching does not work, since HTML has too many odd corners. A safer design where it fits is to store a simple format such as Markdown and generate the HTML yourself.

## Content Security Policy

A **Content Security Policy** (CSP) is a response header that tells the browser which scripts the page is allowed to run. It is a second layer: if an injection gets past the encoding, the browser may still refuse to run it.

```http example csp readonly
Content-Security-Policy: default-src 'self'; script-src 'self';
  object-src 'none'; base-uri 'self'
```

This policy says that scripts may be loaded only from the site's own origin. A script tag written into the page by an attacker is inline script, which the policy does not allow, so the browser does not run it.

A strict policy requires that the page has no inline script of its own, which older sites often do. Policies can be tried in a report-only mode first, where violations are reported and nothing is blocked.

CSP reduces the damage from a mistake. It does not replace encoding.

## Protect the session cookie

One more layer limits what a successful script can take. A cookie marked `HttpOnly` cannot be read by script at all. The browser still sends it with requests, and script in the page cannot see its value.

A session cookie should always be `HttpOnly`. An injected script can then still act as the user while the page is open, and it cannot copy the session to use later from elsewhere.

This is also the reason not to keep session tokens in browser storage that scripts can read. Anything a script can read, an injected script can read.

## The moderator {prediction}

A forum encodes comments correctly on the public pages. The internal moderation tool, written later by another team, displays reported comments using the template engine's "raw" output, so that moderators "see the comment exactly as posted".

:::question admin-xss
What is the consequence?
- [ ] None. Only staff see that tool :: Staff are the most valuable targets, since their sessions have the most rights.
- [x] A comment containing script runs in the moderator's browser, with moderator rights :: Stored XSS reaches whoever views the data, wherever it is shown. Every page that displays user text must encode it, internal tools included.
- [ ] The public site becomes vulnerable too :: The public pages still encode. The flaw is in the one tool that does not.
:::

## Exercise: review the page {independent}

A product review page does the following. For each item, say whether it is safe, and what to change.

1. Shows the reviewer's display name between tags, through the template engine's normal output.
2. Shows the review text using the engine's "raw" output, because reviews may contain line breaks.
3. Puts the reviewer's name into a script block: `var author = "NAME";`
4. Shows a link to the reviewer's own website, with the address taken from their profile.
5. Reads a `highlight` parameter from the URL in page script and writes it into the page with `innerHTML`.
6. Sets the session cookie without the `HttpOnly` flag, because a script needs to read it.

## One possible answer {walkthrough}

1. **Safe.** Normal template output encodes the value.
2. **Unsafe: stored XSS.** Raw output of user text runs any script in a review, for every visitor. Use normal encoded output, and keep the line breaks with a style rule that preserves them, or by converting line breaks to `<br>` after encoding.
3. **Unsafe.** HTML encoding does not protect inside a script block. A name containing a quote, or `</script>`, breaks out. Put the name in a data attribute, which is an ordinary encoded attribute, and read it from script.
4. **Unsafe unless the scheme is checked.** A `javascript:` address would run on click. Accept only `http` and `https` when the profile is saved, and check again when the link is rendered.
5. **Unsafe: DOM-based XSS.** Text from the URL is written as HTML. Use `textContent`, which treats it as text.
6. **A weak layer.** With no `HttpOnly`, any of the flaws above lets a script copy the session. Mark the cookie `HttpOnly`, and change the script so that it does not need the cookie's value.

A Content Security Policy that forbids inline script would have blunted items 2, 3 and 5. It is worth adding, and each of those still needs its own fix.
