---
id: course:security/module/passwords
title: Store passwords safely
requires: []
outcomes: []
tasks: []
drills: []
---

Sooner or later a database is copied by someone who should not have it. How passwords were stored decides whether that is an incident or a catastrophe. This module covers why passwords are hashed, why an ordinary hash is not enough, and what to use.

The advice here is general guidance, not any organization's policy.

## Plan for the database being stolen

Design password storage on the assumption that an attacker will one day hold a full copy of the users table. It happens through SQL injection, a leaked backup, a misconfigured storage bucket or an insider.

The goal is that the copy does not give them the passwords. That matters beyond your own site. People reuse passwords, so a leaked password opens that person's email, bank and workplace accounts too.

So the first rule is absolute: never store a password in a form from which it can be read back. Not in plain text, and not encrypted either.

## Why not encrypt them

Encryption is reversible by design. Whoever has the key can turn the stored value back into the password. The application needs the key to do its work, so the key sits on the same systems as the data. An attacker who can copy the database can usually reach the key as well.

There is also no reason for the system to be able to read a password. To check a login, it only needs to know whether what was typed matches what was set. That can be done without ever being able to recover the original.

A site that can email you your existing password is storing it reversibly. That is a sign of a serious flaw.

## Hashing

A **hash function** turns any input into a fixed-size value, the **hash**, with two properties that matter here.

- **One way.** Given the hash, there is no practical method to compute the input.
- **Deterministic.** The same input always gives the same hash.

To store a password, store its hash. To check a login, hash what was typed and compare the two hashes. The system can verify a password without being able to tell anyone what it is.

```text example hash-check readonly
   SET PASSWORD                         LOGIN

   password typed                       password typed
        |                                    |
        v                                    v
   hash function                        hash function
        |                                    |
        v                                    v
   store the hash  ----- compare -----  hash of the attempt

   The password itself is never stored anywhere.
```

## Why a fast hash fails

General-purpose hash functions such as SHA-256 are built to be fast. A modern graphics card computes billions of them per second. Speed is right for checking files and wrong for passwords.

An attacker with the stolen hashes does not reverse them. They guess. Take a candidate password, hash it, and compare the result with every stolen hash. At billions of guesses a second, every common password, every dictionary word with a digit on the end and every password from earlier breaches is tried within minutes.

Two further weaknesses make it worse when plain hashes are used.

- **Identical passwords have identical hashes.** Crack one, and every user with that password is cracked. The most common hash in the table is the most common password.
- **Precomputed tables.** Lists of hashes for billions of likely passwords already exist. Looking a hash up takes no computation at all.

## Salt

A **salt** is a random value, different for every user, that is combined with the password before hashing. It is stored beside the hash, in the open.

A salt does two things.

- Two users with the same password get different hashes, since their salts differ.
- Precomputed tables become useless. A table would have to be built separately for every salt.

A salt does not need to be secret. Its job is to be unique, so that an attacker must attack each password separately and cannot attack them all at once.

```text example salt readonly
   WITHOUT SALT                        WITH A SALT PER USER

   user   password   hash              user   salt   hash
   ana    sunshine   9f2c...           ana    k3Xp   41ab...
   bilal  sunshine   9f2c...  same     bilal  Tq8w   c07e...  different
   chen   sunshine   9f2c...  same     chen   m1Zr   8d3f...  different

   crack one, get all three            each must be attacked separately
```

## Slow on purpose

A salt forces the attacker to work on each password separately. It does not make each guess slower. The remaining defence is to use a hash function that is slow and costly by design. These are called **password hashing functions**.

| Function | Notes |
| --- | --- |
| Argon2id | The current first choice. Costs both time and memory |
| scrypt | Also memory-hard. A sound choice |
| bcrypt | Older and still acceptable. Input is limited to 72 bytes |
| PBKDF2 | Acceptable with a high iteration count. Used where standards require it |

Each takes a **cost setting** (also called a work factor). Tune it so that one hash takes a noticeable fraction of a second on your servers, for example 100 to 300 ms. A real user does not notice that at login. An attacker's rate of guessing falls from billions per second to a few thousand or less.

The functions that also need a lot of memory, Argon2id and scrypt, resist graphics cards and custom hardware best, since memory is hard to multiply cheaply.

These functions generate and store the salt for you. Their output is one string that contains the algorithm, the cost settings, the salt and the hash. Use a maintained library, and do not assemble the pieces yourself.

```text example cost readonly
   fast hash (SHA-256)                 password hash (tuned to 200 ms)

   attacker: 10,000,000,000 /s         attacker: perhaps 1,000 /s
                                       on the same hardware

   10 billion common passwords         10 billion common passwords
   tried in 1 second                   tried in about 4 months,
                                       for each user separately
```

## Which table {prediction}

A breach exposes a users table. Passwords were stored as unsalted SHA-256 hashes. Of 2 million users, 31,000 share the same hash value.

:::question unsalted
What does an attacker learn at once?
- [ ] Nothing, since SHA-256 cannot be reversed :: It does not need reversing. The repetition itself is information.
- [x] That 31,000 users chose the same password, almost certainly a very common one, which will be found in seconds :: Without a salt, equal passwords give equal hashes. The most frequent hash is the weakest password, and cracking it once opens all 31,000 accounts.
- [ ] The passwords of all 2 million users :: Not at once. Common ones fall quickly, and long random ones may never be found.
:::

## Raising the cost over time

Hardware gets faster, so a cost setting that was right five years ago is too low today. The stored string records the settings each hash was made with, which allows a gradual upgrade.

At each successful login, the system has the password in hand for a moment. If the stored hash uses old settings or an old algorithm, compute a new hash with the current settings and replace it. Active users are upgraded without noticing.

Accounts that never log in keep their old hashes. For a migration away from something weak, such as unsalted hashes, either wrap the old hash inside the new function at once, or expire those passwords and require a reset.

## Pepper

A **pepper** is a secret value added to every password before hashing, kept outside the database, in a secrets store or a hardware module. An attacker who has only the database then cannot test guesses at all, since they lack the pepper.

It is an extra layer, useful where the database is the more likely thing to leak. It adds work: the pepper must be protected and cannot be changed easily. It is optional. A slow, salted hash is not.

## Handling the password in transit

A password also has to travel from the user to the hash function.

- **Always over TLS.** A password sent over plain HTTP can be read on the way.
- **Never in a URL.** URLs are stored in browser history, server logs and proxy logs. Send credentials in the request body.
- **Never in logs.** A common accident is logging whole request bodies for debugging, which fills the logs with passwords. Exclude credential fields from logging explicitly.
- **Do not limit the length to something small**, or forbid characters. The hash output has a fixed size whatever the input. Do set a generous upper bound, such as a few hundred characters, so that nobody can make the server hash megabytes.

## Compare carefully

When the system compares secrets, such as tokens or hashes, it should use a comparison that takes the same time whether the values differ at the first character or the last. An ordinary comparison stops at the first difference, and the time it takes can leak how much of a guess was right. This is a **timing attack**.

Password hashing libraries do this correctly in their verify function. Use that function, and do not compare hash strings yourself.

## Other secrets are not passwords

The slow hash is for secrets chosen by people, which are short and guessable. A long random token, such as an API key or a reset token with 128 bits or more of randomness, cannot be guessed in the first place.

Such tokens should still be stored hashed, so that a database copy does not hand them over. For these a fast hash such as SHA-256 is acceptable, since nobody can run through the possibilities. The slow function would only add delay to every API request.

## The login that logged {prediction}

To debug a login problem, a developer adds a line that writes the full request body of every failed login to the application log. The log is kept for a year and can be read by 40 engineers and a log vendor.

:::question logged
What has been created?
- [ ] A useful debugging aid with no security effect :: The request body of a login contains the password.
- [x] A plain-text store of passwords, including near-misses of real ones, readable by many people :: Failed logins are often the right password with one typing error, or the user's password for another site. The careful hashing in the database is bypassed by the log beside it.
- [ ] A risk only if the log is leaked outside the company :: Forty readers and a vendor is already wide exposure. Passwords should be readable by nobody.
:::

## Exercise: review the storage {independent}

A ten-year-old application stores passwords like this.

- The users table has a `password_md5` column, holding the MD5 hash of the password. MD5 is a fast hash that is no longer considered safe for any security use.
- There is no salt.
- Passwords are limited to 16 characters, and the characters `'`, `"` and `;` are forbidden.
- A "forgot password" feature emails a new password in plain text, which the user keeps until they change it.
- There are 3 million accounts. About 40% have not logged in for two years.

Say what is wrong with each point. Then describe a migration to a sound scheme that does not require every user to reset their password on the same day.

## One possible answer {walkthrough}

**Problems**

- **A fast, broken hash.** MD5 is computed at tens of billions per second, and tables of MD5 hashes for common passwords are published. A stolen table is effectively plain text for most users.
- **No salt.** Equal passwords share a hash, and precomputed tables apply directly.
- **Length and character limits.** A 16-character cap blocks passphrases. The forbidden characters suggest that passwords are being joined into SQL somewhere, which is a second problem to look for.
- **A password by email.** It sits in an inbox indefinitely, and it shows the system chooses passwords for users. Use a single-use reset link.

**Migration**

1. **Wrap at once.** For every row, compute `argon2id(old_md5_hash)` with a fresh salt and store that, marked as "wrapped". Delete the MD5 column. From this moment a stolen database no longer contains fast hashes, for all 3 million accounts, including the inactive ones. No user is involved.
2. **Upgrade at login.** When a user logs in, compute MD5 of what they typed, verify it against the wrapped value, and on success store a plain `argon2id(password)` and mark the row as current.
3. **Lift the limits** on length and characters at the same time, and fix whatever code made them necessary.
4. **Replace the reset flow** with a random, expiring, single-use link.
5. **After some months**, expire the passwords of accounts still marked "wrapped" and require a reset at their next visit, or remove accounts that are long abandoned.

Step 1 is the one that matters most. It removes the danger on the first day, without waiting for anyone to log in.
