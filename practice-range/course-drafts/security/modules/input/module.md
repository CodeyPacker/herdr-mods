---
id: course:security/module/input
title: Treat all input as untrusted
requires: []
outcomes: []
tasks: []
drills: []
---

Most attacks arrive as input: a value the system accepts and then uses in a way the sender chose. This module covers where input comes from, how to validate it, and why validation alone is never the whole defence.

The advice here is general guidance, not any organization's policy.

## Everything from outside is input

Input is more than the fields of a form. It is every value that comes from the far side of a trust boundary.

- URL paths and query parameters.
- Request bodies: form fields, JSON, XML.
- Headers, including `User-Agent`, `Referer` and `X-Forwarded-For`.
- Cookies.
- Uploaded files: their content, their name and their declared type.
- Data from other systems: webhooks, API responses, imported files.
- Data read back from your own database, if a user put it there earlier.

The last item surprises people. A comment that a user stored yesterday is still user input today. It was untrusted when it arrived, and storing it did not make it safe.

A request that your own page generated is not safe either. Anyone can send a request by hand, with any values, without going near your page.

## Validation

**Validation** checks that input is what the system expects before the system uses it. Check on the server, at the boundary, on every request.

Check these, in this order.

1. **Type.** Is it a number, a date, a boolean, as required?
2. **Length and size.** Is it within sensible limits?
3. **Range.** Is the quantity between 1 and 100? Is the date in the future?
4. **Format.** Does it look like an email address, a postcode, an identifier?
5. **Membership.** Is it one of the allowed values?
6. **Business rules.** Does this user own this item? Is this combination allowed?

When validation fails, reject the request with a clear error. Do not try to repair bad input and carry on. Guessing what the sender meant is how filters get bypassed.

Checks in the browser are a convenience for honest users, who see an error without waiting for the server. They provide no security, since the sender can skip them.

## Allow what is good

There are two ways to write a check.

A **blocklist** names what is forbidden: reject input containing `<script>` or `DROP TABLE`. It fails, because there are endless ways to write a harmful value and the list never has all of them: different capitalisation, different encodings, a different tag.

An **allowlist** names what is permitted: a username is 3 to 30 letters, digits or underscores. Anything else is refused. It works because it describes the small set of good values and makes no attempt to list the bad ones.

Prefer an allowlist wherever the valid values can be described. For a value chosen from a list, such as a sort column, compare it against the list and use your own copy of the matching entry, never the text the user sent.

```text example allowlist readonly
   request:  GET /products?sort=price

   BLOCKLIST                           ALLOWLIST

   reject if sort contains             allowed = [name, price, date]
   ";" or "--" or "drop"               if sort is not in allowed:
                                           refuse
   misses: every trick                 use the entry from the list
   not on the list

   tries to name the bad               names the good
```

## Free text cannot be allowlisted

Some input has no narrow format: a name, a comment, an address. Names contain apostrophes, hyphens and letters from every alphabet. Rejecting `O'Brien` is a bug, not a defence.

For free text, validate what you can, which is length and the absence of control characters, and accept the rest. Then make it harmless at the place where it is used.

That is the second half of input handling, and the more important one.

## Make it safe where it is used

Data becomes dangerous when it is placed into a context that gives some characters special meaning: a SQL statement, an HTML page, a shell command, a file path. What counts as dangerous depends on that destination. An apostrophe matters in SQL and not in a file name. A `<` matters in HTML and not in SQL.

So no single cleaning step at the entrance can make a value safe for every later use. The defence belongs at each exit, in the form that suits that destination.

| Destination | Defence |
| --- | --- |
| A SQL statement | Parameters, never pasted text |
| An HTML page | Output encoding for the exact place in the page |
| A shell command | Avoid the shell. Pass arguments as a list |
| A file path | Use a generated name. Check the final path stays inside the allowed folder |
| A URL to fetch | An allowlist of hosts |
| A log line | Remove line breaks, so one entry cannot pose as two |

Validate at the entrance, and encode or parameterise at each exit. Each catches what the other misses. The next two modules cover the two most important exits in detail.

```text example in-out readonly
                       +-------------------+
   input  ---------->  |   your system     | ---> SQL      parameters
   validate here       |                   | ---> HTML     encode
   (type, length,      |  stored and       | ---> shell    no shell
    range, format)     |  passed around    | ---> files    safe paths
                       +-------------------+
                                             make it safe at each exit,
                                             in the way that exit needs
```

## The filter {prediction}

A developer protects a comment field by removing the text `<script>` from every comment before saving it.

:::question blocklist
Why is this not enough?
- [ ] It is enough. Scripts cannot run without that tag :: Script can run from many other places in HTML, such as an event attribute on an image tag.
- [x] There are many other ways to write harmful HTML, and the filter knows only one :: A blocklist never has every variant. Different capitalisation, other tags and attributes all pass. The reliable fix is to encode the comment when it is placed in a page.
- [ ] It breaks comments that mention the word script :: That is a side effect. The security failure is that the filter is easy to get around.
:::

## Files and paths

Uploaded files and file names need extra care, since a file system gives special meaning to parts of a name.

**Path traversal.** If the code builds a path from user input, a name such as `../../etc/passwd` climbs out of the intended folder. The `..` means "parent folder". Never build a path from a name the user supplied. Generate your own name, such as a random identifier, and keep the original only as a label in the database.

**File type.** The declared type and the file extension are both chosen by the sender. A file called `photo.jpg` can contain anything. Check the content, limit the size, and store uploads where they can never be executed as code: outside the web root, or in separate object storage, served with a type you set.

**Size and count.** An upload with no size limit is a way to fill your disk. Set limits on the size of a file, of a request and of the number of files.

```text example traversal readonly
   intended:   /srv/app/uploads/ + filename

   filename = "report.pdf"
       -> /srv/app/uploads/report.pdf            fine

   filename = "../../config/secrets.env"
       -> /srv/app/uploads/../../config/secrets.env
       =  /srv/config/secrets.env                outside the folder
```

## Requests your server makes

Some features fetch a URL the user supplies: "import from a link", a webhook address, a preview of a web page. The server then makes a request to wherever the user says.

The danger is that your server sits inside your network. It can reach internal services, admin panels and cloud metadata addresses that the user cannot reach directly. A user who supplies an internal address gets your server to fetch it for them. This is **server-side request forgery** (SSRF).

Defend with an allowlist of permitted hosts where possible. Otherwise, resolve the name and refuse private, loopback and link-local addresses, do not follow redirects blindly, and run the fetching from a part of the network that can reach nothing internal.

## Structured data and limits

Parsers are part of the attack surface as well.

- **Limit depth and size.** Deeply nested JSON or a huge array can exhaust memory.
- **Reject unknown fields** where you can, or at least ignore them explicitly.
- **Do not bind request data straight onto internal objects.** If a request to update a profile is copied field by field onto the user record, a sender who adds `"is_admin": true` may become an administrator. This is called **mass assignment**. List the fields each endpoint accepts.
- **Turn off features you do not need** in parsers, such as external entities in XML.

## The extra field {prediction}

An endpoint updates a user's profile. The code takes the JSON body and copies every field in it onto the user's database record. The form in the page sends `name` and `bio`.

:::question mass-assign
What happens if someone sends `{"name": "Ana", "role": "admin"}` by hand?
- [ ] The extra field is ignored, since the form does not have it :: The form is in the browser. The server copies whatever arrives.
- [x] Their role is set to admin :: The server trusted the shape of the request. The endpoint must accept only the fields it means to: `name` and `bio`.
- [ ] The request fails validation :: Nothing in the described code validates anything.
:::

## Exercise: review the inputs {independent}

An endpoint lets a user upload a profile picture and choose how it is shown.

```text
POST /profile/picture
fields:  file        the image
         filename    used as the name to save under
         size        "small", "medium" or "large"
         user_id     whose profile to update
         source_url  optional: fetch the image from this address instead
```

For each of the five inputs, say what could go wrong and how you would handle it.

## One possible answer {walkthrough}

| Input | Risk | Handling |
| --- | --- | --- |
| `file` | Not an image. Very large. Contains something harmful | Limit the size. Check the content is a real image by decoding it. Re-encode it to a fresh image. Store it in object storage, never in a folder that can run code |
| `filename` | Path traversal. Overwriting another file. Odd characters | Ignore it for storage. Generate a random name. Keep the original only as a label, encoded when shown |
| `size` | An unexpected value used later in a path or a query | Allowlist: one of three values. Use your own constant for the matching entry |
| `user_id` | Changing someone else's picture | Do not accept it at all. Take the user from the session |
| `source_url` | The server fetching internal addresses (SSRF) | Best: remove the feature. Otherwise allow only `https`, resolve the host and refuse private addresses, limit size and time, and do not follow redirects to other hosts |

Two of the five are best handled by not accepting the input at all. That is often the strongest validation there is. A value the server already knows should never be taken from the request.
