---
id: course:security/module/injection
title: Injection
requires: []
outcomes: []
tasks: []
drills: []
---

Injection happens when data supplied by a user is treated as part of a command. This module covers how it works in SQL and in shell commands, and the one defence that removes the whole class of bug.

The advice here is general guidance, not any organization's policy. The examples show how a flaw arises so that you can recognise and prevent it in your own code.

## Code and data in one string

Many systems accept commands as text: a database takes SQL, a shell takes a command line, a template engine takes a template. When a program builds such a command by joining fixed text and a user's value into one string, the receiver cannot tell which part came from where. It reads the whole string as a command.

If the user's value contains characters that mean something in that language, the value can end the data part early and add commands of its own. That is **injection**.

Every form of injection has the same cause: code and data mixed in one string. Every reliable fix has the same shape: keep them apart.

## SQL injection

Suppose a login check builds its query by joining strings. In plain words, the program does this:

```text
query = "SELECT * FROM users WHERE email = '" + email + "'"
```

With the email `ana@example.com`, the database receives a normal query.

```sql
SELECT * FROM users WHERE email = 'ana@example.com'
```

Now suppose the value sent as the email is `x' OR '1'='1`. The database receives this:

```sql
SELECT * FROM users WHERE email = 'x' OR '1'='1'
```

The apostrophe in the input closed the text value. The rest was read as SQL. The condition is now true for every row, so the query returns every user.

The same flaw lets an attacker read other tables, change data or delete it, depending on what the database account is allowed to do. It has been one of the most common serious flaws in web applications for decades.

```text example sqli readonly
   fixed text:   SELECT * FROM users WHERE email = '        '
                                                    ^      ^
   user value:                                      x' OR '1'='1

   joined:       SELECT * FROM users WHERE email = 'x' OR '1'='1'
                                                    |  |_________|
                                                    |   now part of
                                                 data   the command
```

## Parameters

The fix is to send the statement and the values separately. The statement contains placeholders, and each value travels beside it as a **parameter**.

```sql
SELECT * FROM users WHERE email = $1
```

The database parses the statement first, with the placeholder standing for "one value goes here". Then it receives the value. Whatever the value contains, it is used as one value. An apostrophe in it is an apostrophe in an email address. It cannot become SQL, because the command was fixed before the value arrived.

This is called a **parameterised query** or a prepared statement. Every database library supports it. Use it for every value, every time, including values you believe are safe. There is no need to judge each case, and no way to judge one wrongly.

```text example params readonly
   STRING JOINING                      PARAMETERS

   one string:                         statement:
   "... WHERE email = 'x' OR ..."      "... WHERE email = $1"

   the database sees one command       values, sent separately:
   and cannot tell which part          $1 = "x' OR '1'='1"
   the user wrote
                                       the command is fixed first, so
                                       the value can only be a value
```

## What parameters cannot do

A parameter can stand for a value. It cannot stand for a table name, a column name or a keyword such as `ASC`.

So a feature like "sort by the column the user chose" cannot be parameterised directly. The safe pattern is an allowlist. Compare the user's choice with a fixed list, and put your own text into the statement.

```text
allowed = { "name": "name", "price": "price", "newest": "created_at" }
column  = allowed[user_choice]        refuse if it is not in the list
query   = "SELECT ... ORDER BY " + column
```

The text joined into the query comes from your list. The user only chose which entry.

Query builders and ORMs (libraries that generate SQL from objects) use parameters for you in their normal methods. They also have "raw" methods that accept a string. Injection in modern code is nearly always found there.

## Parameterised or not {prediction}

A search endpoint runs this, where `term` comes from the user and is sent as a parameter, and `order` comes from the user and is joined into the string:

```text
"SELECT * FROM products WHERE name LIKE $1 ORDER BY " + order
```

:::question partial-param
Is the query safe?
- [ ] Yes, since it uses a parameter :: One value is a parameter. The other is pasted into the command.
- [x] No. The `order` value is joined into the SQL text :: Anything sent as `order` becomes part of the command. Use an allowlist of column names for it.
- [ ] Yes, since `ORDER BY` cannot change data :: Text injected there can still read data from other tables through subqueries, and can make the query very slow.
:::

## Command injection

The same flaw exists when a program builds a shell command from user input.

Suppose a service makes thumbnails by running a command line built from a file name:

```text
run_shell("convert " + filename + " thumbnail.png")
```

A shell gives meaning to many characters. A `;` ends one command and starts another. If the file name sent is `photo.jpg; rm -rf /srv/data`, the shell runs two commands, and the second one deletes data.

There are two defences, in order of preference.

1. **Do not use a shell.** Call a library function for the task. Most things a shell command does can be done by a library.
2. **If you must run a program, pass arguments as a list.** Every language has a way to start a program with its arguments as separate items and no shell in between. The program receives each argument exactly as given. No character is special, because nothing is parsing a command line.

```text example command readonly
   UNSAFE: one string, parsed by a shell

   run_shell("convert " + filename + " thumbnail.png")

   filename = "a.jpg; rm -rf /srv/data"
   the shell runs:   convert a.jpg
                     rm -rf /srv/data thumbnail.png

   SAFE: a list of arguments, no shell

   run_program(["convert", filename, "thumbnail.png"])

   the program gets one odd file name, and fails to find the file
```

## The same flaw in other places

Wherever a string is interpreted, injection is possible.

- **Templates.** If user input is used as a template, and not as a value given to a template, the template engine may execute expressions inside it.
- **Queries to other stores.** Document databases and search engines have query languages too. Passing a user's JSON straight in as a query lets the user add operators.
- **LDAP, XPath, regular expressions.** Each has characters with special meaning.
- **Log files.** A line break in input lets one request write what looks like a second, false log entry.
- **Email headers.** A line break in a "subject" value can add recipients.
- **Dynamic code.** Functions that evaluate a string as code must never receive user input.

The question to ask of any code is: is a string being built here that something else will interpret? If so, find that system's way of passing values separately.

## Limit the damage

Parameters prevent the flaw. A second layer limits what happens if a flaw slips through anyway.

- **Least privilege for the database account.** The account the application uses should be able to read and write its own tables and nothing more. It should not be able to drop tables, read other databases or act as an administrator. An injected command can do only what the account may do.
- **Separate accounts** for separate jobs: one for the application, another for migrations, another, read-only, for reporting.
- **Do not show database errors to users.** A raw error message tells an attacker the table names and the kind of database. Log the detail and show a generic message.

## How it is found

You do not have to wait for an attacker.

- **Code review.** Look for strings built with user input that are passed to a database, a shell or an evaluator. In a review, any string joining near SQL deserves a second look.
- **Static analysis.** Tools that read code can flag these patterns automatically.
- **Tests.** A test that sends an apostrophe in every text field catches the crudest cases.

## The helpful error {prediction}

A site's search box shows this when a user types an apostrophe:

```text
ERROR: syntax error at or near "'" in
SELECT id, title FROM articles WHERE title LIKE '%'%'
```

:::question error-leak
What has gone wrong? Choose the most complete answer.
- [ ] Only that a raw error is shown to the user :: That is one problem. The error also proves a worse one.
- [x] The query is built by joining strings, and the error tells an attacker so, along with the table and column names :: An apostrophe broke the SQL, which means input reaches the command. The message then shows exactly how. Use a parameter, and show a generic error.
- [ ] Nothing. The database rejected the bad query :: It rejected this one because it was malformed. A carefully formed value would run.
:::

## Exercise: find the injection {independent}

A reporting service has these four pieces of code, written here in plain words. For each, say whether it is open to injection, and how to fix it.

1. `"SELECT * FROM invoices WHERE id = " + id`, where `id` comes from the URL and "is always a number".
2. A parameterised query: `SELECT * FROM invoices WHERE customer_id = $1`, with the customer ID from the session.
3. `"SELECT * FROM " + table + " LIMIT 10"`, where `table` comes from a dropdown in the page.
4. `run_shell("pdf-export --out /tmp/" + name + ".pdf")`, where `name` is a report title typed by the user.

## One possible answer {walkthrough}

1. **Open.** "Always a number" is a belief about the page, and the request can carry anything. Send `id` as a parameter. Also validate that it is an integer and reject it otherwise, which gives a clean error and a second layer.

2. **Safe.** The value is a parameter, and it comes from the server's own session, not from the request. Nothing to change.

3. **Open.** A table name cannot be a parameter, and a dropdown is no restriction, since the request can be sent by hand. Keep a fixed list of the tables that may be shown, look the user's choice up in it, and join your own text. Ask also whether users should be choosing tables at all.

4. **Open, twice.** The title goes into a shell command, so `;` or `$( )` in it runs other commands. It is also used in a file path, so `../` in it writes outside `/tmp`. Start the program with a list of arguments and no shell. Generate the file name yourself, such as a random identifier, and keep the title only as a label.

Item 1 is the most instructive. The developer was not careless. They trusted a fact about their own page. Parameters remove the need for that trust.
