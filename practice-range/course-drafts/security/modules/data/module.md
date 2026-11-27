---
id: course:security/module/data
title: Protect personal and sensitive data
requires: []
outcomes: []
tasks: []
drills: []
---

Data that was never collected cannot leak. This module covers how to decide what data deserves which care, how to hold less of it, and the places where sensitive data ends up without anyone having chosen to put it there.

The advice here is general guidance, not any organization's policy. It is not legal advice. Privacy law differs by country and sector, and the rules that apply to a real system must come from the people responsible for compliance where you work.

## Not all data is equal

Protecting everything to the highest standard is too expensive, and protecting everything to the lowest is negligent. The first step is **classification**: sorting data by how much harm its exposure would cause.

A simple scheme has four levels.

| Level | Examples | Typical handling |
| --- | --- | --- |
| Public | Marketing pages, published prices | No restriction |
| Internal | Internal documentation, non-sensitive metrics | Staff only |
| Confidential | Customer names, emails, order history | Need-to-know access, encrypted, logged |
| Restricted | Passwords, payment card data, health records, identity numbers | Strictest controls, minimal access, often regulated |

The exact names matter less than having them, writing down which data is at which level, and having rules for each level that people can follow.

## Personal data

**Personal data** (also called PII, for personally identifiable information) is any information about an identifiable person. It is broader than most people assume.

- **Direct identifiers:** name, email address, phone number, identity number.
- **Indirect identifiers:** an IP address, a device ID, a precise location, an account number.
- **Combinations.** A postcode, a date of birth and a gender are each harmless and together identify most individuals.

Some kinds are treated as especially sensitive in most privacy laws, since exposure can cause serious harm: health data, biometric data, financial details, and information about beliefs, origin or private life.

Removing the name from a record does not make it anonymous. If the remaining fields can be linked back to a person, it is still personal data.

## Collect less

The most reliable protection is not to have the data. This is **data minimisation**.

- **Ask for what the feature needs.** A newsletter sign-up needs an email address. It does not need a date of birth.
- **Question every field** in a form and every column in a table: what is this used for? If nobody can say, do not collect it.
- **Prefer a less precise form.** An age range in place of a date of birth. A city in place of an address. The last four digits of a card in place of the number.
- **Do not copy production data** into development and test environments. Those are far less protected. Use generated data, or data with the identifying fields replaced.

Every field you hold is a field to secure, to include in a breach notice, and to produce or delete when a person asks for their data.

## Keep it for less time

Data kept for ever is exposed for ever. **Retention** means deciding how long each kind of data is needed and removing it afterwards.

- Set a period per kind of data, based on why it is held: account data while the account exists, logs for some months, financial records for as long as the law requires.
- Delete or anonymise automatically, on a schedule. A manual process does not happen.
- Remember the copies: backups, exports, analytics stores, caches, search indexes and the systems of third parties you sent the data to.

A breach of a system with a 90-day retention rule exposes 90 days of data. The same breach without one exposes ten years.

```text example retention readonly
   no retention rule                  90-day retention

   2015 |==========|
   2016 |==========|
   ...  |==========|
   2024 |==========|
   2025 |==========|                  2025 |==|   last 90 days only

   a breach exposes everything        a breach exposes 90 days
   ever collected
```

## The breach that was smaller {prediction}

Two companies suffer the same breach of their order databases. Company A keeps every order since it started, with full card numbers and dates of birth "in case they are useful". Company B keeps the last four card digits, no dates of birth, and removes personal details from orders older than two years.

:::question minimise
How do the two incidents compare?
- [ ] They are the same, since the same flaw was exploited :: The flaw is the same. What it exposed is not.
- [x] Company A has lost full card numbers and years of personal data. Company B has lost far less, and nothing that allows card fraud :: The damage of a breach is set by what was there to take. Company B decided that in advance.
- [ ] Company B is worse off, since it cannot analyse its old orders :: It kept the orders and removed the personal details. Most analysis needs only that.
:::

## Where sensitive data hides

Sensitive data spreads to places nobody designed for it. Most accidental exposure comes from these.

- **Logs.** Request bodies, query strings, headers and error messages often contain personal data, tokens and passwords. Logs are widely readable, kept for a long time and frequently sent to outside services.
- **URLs.** Anything in a query string is recorded in browser history, server logs and proxy logs, and is sent to other sites in the `Referer` header.
- **Error messages and debug pages.**
- **Analytics and tracking tools,** which receive page addresses and form values.
- **Emails and notifications.**
- **Exports and spreadsheets** on laptops and shared drives.
- **Backups,** which hold everything and are often protected less than the database.
- **Caches and search indexes.**
- **Support tools and screenshots.**

When you handle a sensitive field, follow it through the system and list every place it is written.

## Log without leaking

Logs are necessary, and they are the most common unplanned store of sensitive data.

- **Log identifiers, not contents.** `user_id=5521 updated profile` and not the new profile.
- **Never log** passwords, tokens, session IDs, card numbers, identity numbers or full request bodies.
- **Mask by default.** Configure the logging library to redact fields with known names, such as `password`, `token`, `authorization`, `card`.
- **Keep personal data out of URLs,** so it does not land in access logs.
- **Treat logs as sensitive data** themselves: limit who can read them, and set a retention period.

## Mask, tokenise, pseudonymise

When data must be kept, reduce how many places hold the real value.

- **Masking** shows part of a value: `**** **** **** 4242`. Support staff can confirm a card with a customer without ever seeing the number.
- **Tokenisation** replaces a sensitive value with a meaningless stand-in, the token. The real value is kept in one tightly guarded vault. Every other system stores and passes around the token. Payment processing commonly works this way: your system holds a token and the payment provider holds the card.
- **Pseudonymisation** replaces identifiers with artificial ones, so that records can still be linked to each other and no longer directly to a person. The mapping is kept separately. It lowers risk. The data is still personal, since the mapping exists.
- **Anonymisation** removes the link to a person permanently. It is much harder to achieve than it sounds, since combinations of ordinary fields can identify people again.

The greatest gain is often to keep the most sensitive data out of your system altogether. If a specialist provider holds the card numbers, your own breach cannot expose them.

```text example tokenise readonly
   WITHOUT TOKENISATION               WITH TOKENISATION

   orders DB:    card 4242...4242     orders DB:    token tok_9f2c
   billing DB:   card 4242...4242     billing DB:   token tok_9f2c
   support tool: card 4242...4242     support tool: **** 4242
   logs:         card 4242...4242     logs:         token tok_9f2c

   the card number is in 4 places     the card number is in 1 place:
                                      the provider's vault
```

## Control and record access

For confidential and restricted data, who can read it matters as much as how it is stored.

- **Need to know.** Access is granted for a role's actual tasks. Most engineers do not need to read customer records.
- **Access is logged.** Record who viewed which sensitive record and when. Logging reads, and not only changes, is what makes misuse by insiders detectable.
- **Bulk access is special.** Reading one customer's record is routine. Exporting 100,000 is not. Limit it, require approval and alert on it.
- **Show less.** Internal tools should mask sensitive fields by default, with a deliberate, logged action to reveal one.

## People's rights over their data

Many privacy laws give people rights over data about them, such as the GDPR in Europe. The details vary. The common ones affect system design.

- **Access.** A person may ask what you hold about them and receive a copy.
- **Correction.** They may ask for wrong data to be fixed.
- **Deletion.** They may ask for their data to be erased, within limits.
- **Purpose limitation.** Data collected for one purpose should not be quietly used for another.

These are far easier to honour when planned for. Know where each person's data lives, across every store and every third party, and be able to find it by one identifier. A system with personal data scattered through twenty tables and five vendors, and no map of it, cannot answer a deletion request with confidence.

## Third parties

Every outside service that receives your data extends your attack surface to theirs: analytics, error tracking, email delivery, support desks, AI services.

- Send each one the minimum it needs. An error tracker does not need request bodies.
- Know which services hold what, and keep the list current.
- Check what a service does with the data, where it stores it and how long it keeps it.
- Remove integrations that are no longer used. Each was given data and usually a credential.

## The query string {prediction}

A password reset page is reached by a link such as `https://app.example.com/reset?email=ana@example.com&token=k3Xp9aTq8w`. The page loads a script from an analytics provider.

:::question url-leak
Where does the email address and token end up?
- [ ] Only in the user's inbox and browser :: The address of a page is recorded and shared in several places automatically.
- [x] In the server's access logs, in browser history, and with the analytics provider :: Query strings are logged by servers and proxies, kept in history, and sent to third-party scripts and in the `Referer` header. A live reset token in a URL is a credential in all of those places.
- [ ] Nowhere, since the connection uses HTTPS :: HTTPS protects the address in transit. It does nothing about where each end records it.
:::

## Exercise: follow the data {independent}

A telehealth product lets patients book video appointments. A booking stores: full name, date of birth, email, phone, a free-text "reason for visit", an insurance number and a payment card. The team reports:

1. The application logs every request body at debug level, and debug logging is on in production.
2. The test environment is refreshed weekly from a copy of the production database.
3. The support tool shows all fields of a booking to all 80 support agents.
4. Bookings are never deleted.
5. An error tracking service receives the full request and response for every error.
6. The card number is stored in the bookings table.

Classify the data. Then say what you would change for each of the six, and name the one you would do first.

## One possible answer {walkthrough}

**Classification.** The reason for visit is health data, and the insurance number and card number are highly sensitive: all three are restricted. Name, date of birth, email and phone are confidential, and here they are tied to a medical service, which raises their sensitivity.

**Changes**

1. **Logs.** Turn off body logging in production. Log identifiers and outcomes only, mask known sensitive fields, and treat the existing logs as holding health and card data: restrict them and shorten their retention.
2. **Test data.** Stop copying production. Use generated data. Until then, the test environment holds real patients' health data with test-level protection.
3. **Support tool.** Show what the task needs: name, appointment time and status. Mask the insurance number and the reason for visit, with a logged "reveal" for the cases that need it. Limit who can reveal.
4. **Retention.** Set periods with the compliance owner. Medical and financial records often have minimum periods by law, so the answer is not simply "delete". Remove what is not required once the period ends.
5. **Error tracker.** Strip bodies and personal fields before sending. Send an error type, a stack trace and an internal ID.
6. **Card numbers.** Stop storing them. Use the payment provider's tokenisation, so the bookings table holds a token and the last four digits.

**First: item 6, then item 1.** Stored card numbers are the highest-impact data here and the easiest to stop holding. Body logging comes next, since it copies every restricted field, the card number included, into a second, widely readable store.

These are engineering suggestions. For a real product of this kind, the retention periods, the handling of health data and the response to what the logs already contain are decisions for the people responsible for compliance and security.
