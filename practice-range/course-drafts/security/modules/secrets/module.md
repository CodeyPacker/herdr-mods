---
id: course:security/module/secrets
title: Secrets
requires: []
outcomes: []
tasks: []
drills: []
---

An application needs passwords, keys and tokens to reach its database and the services it calls. Each one is a way in for whoever holds it. This module covers where secrets leak, where they should live, and what to do when one gets out.

The advice here is general guidance, not any organization's policy.

## What counts as a secret

A **secret** is any value that grants access by being known.

- Database passwords and connection strings.
- API keys and tokens for other services.
- Private keys: for TLS, for signing, for SSH.
- Encryption keys.
- Session signing keys and webhook secrets.
- Cloud credentials.

Non-secret configuration, such as a hostname, a port or a feature flag, needs no such care. The test is simple: if this value were posted publicly, could someone do harm with it?

## Where secrets leak

Secrets rarely leak through clever attacks. They leak through ordinary work.

- **Source code.** A key pasted into a file "for now" and committed.
- **Version history.** Deleted in a later commit and still present in every earlier one.
- **Configuration files** committed by mistake, such as a `.env` file.
- **Logs.** A request logged with its `Authorization` header. A connection string printed in an error.
- **Error pages and stack traces** shown to users.
- **Build systems.** Printed in pipeline output, or baked into a container image layer.
- **Front-end code.** Anything shipped to a browser or a mobile app can be extracted from it.
- **Chat, tickets, email and screenshots**, shared to "help debug".
- **Laptops and backups.**

Public code hosting sites are scanned continuously by automated tools. A cloud key pushed to a public repository is typically found and abused within minutes.

## Out of the code

The first rule is that a secret never appears in source code or in the repository, in any branch.

There are good reasons beyond leaks.

- Everyone with read access to the code, now and in the future, has the secret.
- The same secret ends up in development, testing and production, since the code is the same.
- Changing the secret needs a code change and a deploy.

The code should contain the name of the secret. The value is supplied when the application runs.

```text example in-code readonly
   IN THE CODE                          SUPPLIED AT RUN TIME

   db_password = "S7r0ng!pass"          db_password = read("DB_PASSWORD")

   in the repository for ever           the repository holds only a name
   the same in every environment        each environment has its own value
   changed only by a deploy             changed without touching the code
```

## Deleting is not removing {prediction}

A developer commits a file containing a live API key, notices ten minutes later, deletes the line and commits again. The repository is private and has 60 contributors.

:::question history
Is the key safe now?
- [ ] Yes, since the line is gone :: The current version no longer has it. Every earlier version does.
- [x] No. It is still in the history, and in every clone made in those ten minutes :: A version control system keeps every commit. The only safe response is to treat the key as leaked: revoke it and issue a new one.
- [ ] Yes, since the repository is private :: Private limits who can read it. Sixty people, their laptops and any tool with repository access can.
:::

## Where secrets should live

Supplying a value at run time can be done in several ways, from basic to strong.

**Environment variables.** The platform sets them when the process starts. They keep secrets out of the code, and every platform supports them. Their weaknesses: they are visible to anything running as the same user, they are often dumped in crash reports and debug pages, and there is no record of who read them.

**A secrets manager.** A dedicated service that stores secrets encrypted, hands them out to identities that are permitted, and records every access. Examples are Azure Key Vault, AWS Secrets Manager, Google Secret Manager and HashiCorp Vault. This is the right home for production secrets.

A secrets manager gives you what environment variables cannot:

- **Access control** per secret: this service may read this one and no other.
- **An audit log** of every read.
- **Rotation**, often automatic.
- **One place** to change a value, with no redeploy.

## No secret at all

The best secret is one that does not exist. Many platforms let a workload prove its identity without holding any long-lived credential.

A service running in a cloud is given an identity by the platform itself, called a managed identity, a service account or a workload identity. When it calls the database or the storage service, the platform vouches for it with a short-lived token that it obtains and renews automatically. There is no password to store, leak or rotate.

The same idea applies to deployment pipelines. A pipeline can exchange a short-lived token from its own platform for temporary cloud access, with no stored cloud key. This is often called workload identity federation.

Prefer these wherever they are offered. Each one removes a secret from the system.

```text example identity readonly
   WITH A STORED SECRET

   app ---- password from config ---->  database
            (can leak, must be rotated)

   WITH A PLATFORM IDENTITY

   app ---- "who am I?" ------------>  platform
       <--- short-lived token --------
   app ---- token ------------------->  database
            (nothing stored, expires in minutes or hours)
```

## Scope and separate

A leaked secret does as much damage as it has access. Limit that in advance.

- **One secret per service.** If ten services share one database password, a leak from any of them exposes all, and you cannot tell which leaked.
- **One set per environment.** Development, testing and production have different secrets. A developer's laptop never holds a production credential.
- **Least privilege.** A key for reading from one storage area cannot delete from another.
- **Short lifetimes.** A credential that expires in an hour is of little use to someone who finds it next week.

## Rotation

**Rotation** means replacing a secret with a new one and retiring the old.

Rotate on a schedule, so that a secret that leaked unnoticed stops working eventually. Rotate at once when a secret may have been exposed, and when someone with access to it leaves.

Rotation is only practical if it does not cause an outage, and that must be designed in.

1. Create the new secret while the old one still works.
2. Update the consumers to use the new one.
3. Confirm nothing uses the old one any more.
4. Revoke the old one.

Systems that accept two valid secrets at once for a short period make this painless. A secret that cannot be rotated without downtime will not be rotated, including on the day it leaks. Practise it before you need it.

## Secrets in the front end

Anything sent to a browser or packed into a mobile app is public. Minifying or obscuring the code does not change that. The values can be read from the network traffic or extracted from the app.

So a secret API key can never be used directly from front-end code. The pattern is to keep the key on your server and have the front end call your server, which adds the key and calls the third party.

Some keys are designed to be public, such as a map provider's browser key or a payment provider's "publishable" key. Those are identifiers, and they are protected by restrictions on the provider's side: which domains may use them and what they may do. Check which kind you have. If the provider's documentation says a key must be kept secret, it must not reach the browser.

## Keep them out of logs and pipelines

- **Logs.** Never log `Authorization` headers, cookies, connection strings or whole request bodies. Configure the logging library to mask known secret fields.
- **Error messages.** Show users a generic message. Keep details in the log.
- **Pipelines.** Use the pipeline's secret store, which masks values in output. Do not `echo` a secret to debug it. Do not pass secrets as command-line arguments, which appear in process lists.
- **Container images.** A secret copied in during a build stays in that image layer, even if a later step deletes the file. Supply secrets when the container runs, or use the build tool's secret mount feature.

## Catch them early

People make mistakes, so add checks that catch a secret before it spreads.

- **A pre-commit hook** that scans for patterns that look like keys and blocks the commit.
- **Scanning in the pipeline** and on the code hosting platform, across the whole history.
- **A `.gitignore` entry** for local configuration files, in place from the first commit.

Scanners match known formats, so they miss secrets that have no recognisable shape. They are a safety net, and the habit of never typing a secret into a file is still the main defence.

## When a secret leaks

A leaked secret is an incident. The order of the steps matters.

1. **Revoke it at once.** Make the leaked value useless. This is the only step that actually stops misuse. Do it first, even if it breaks something.
2. **Issue a new secret** and deploy it.
3. **Check for misuse.** Read the access logs of whatever the secret protected, from the time of the leak.
4. **Remove it from where it leaked**, as tidying. This does not make the old value safe, which is why it comes after revocation.
5. **Find out how it happened** and close that path.

The common mistake is to do step 4 first and stop: deleting the commit and hoping nobody saw it. Assume it was seen.

## The key in the app {prediction}

A mobile app includes a secret API key for a paid text-messaging service, so that the app can send verification messages directly. The key is stored obfuscated in the app's code.

:::question mobile-key
What is the exposure?
- [ ] Little, since the key is obfuscated :: Obfuscation slows a reader down. The app has to turn it back into the real key to use it, and that can be observed.
- [x] Anyone can extract the key from the app, or from its network traffic, and send messages at the company's cost :: Everything shipped to a device is in the user's hands. The app should ask the company's own server, which holds the key and decides whether to send.
- [ ] None, since app stores check apps for security :: Store review does not prevent a key from being extracted from a published app.
:::

## Exercise: clean up the secrets {independent}

A team's service is set up as follows.

1. `app.config` in the repository contains the production database password and a payment provider's secret key.
2. The same database password is used by five services and by the developers for local debugging against production.
3. The pipeline prints its environment at the start of every run, "to help with debugging". The logs are kept for 90 days.
4. The Dockerfile copies a `.env` file into the image and deletes it in the next step.
5. Nobody knows how to change the payment key without downtime, so it has not been changed in four years. Two engineers who knew it have left.

Write a plan. Put the steps in order and say what each one achieves.

## One possible answer {walkthrough}

**1. Treat every one of these secrets as leaked, and rotate them.** They are in the repository history, in 90 days of pipeline logs and in image layers, and former staff know them. Nothing done to the files makes the current values safe. Start with the payment key, since it handles money, and work out the two-key rotation with the provider so that there is no downtime.

**2. Move secrets to a secrets manager.** Each service reads its own secrets at start-up, under its own identity. `app.config` keeps only the names. This is what makes the rotation in step 1 repeatable.

**3. Give each service its own database account**, with only the rights it needs. Where the platform supports it, replace the password with a managed identity. Developers get no production credentials on their machines. Debugging against production goes through a logged, time-limited access process.

**4. Stop the leaks at their sources.**

- Remove the environment dump from the pipeline, and use its masked secret store.
- Fix the Dockerfile. The `.env` file is still inside the earlier layer. Supply configuration when the container runs.
- Add secret scanning as a pre-commit hook and in the pipeline, and add `.env` to `.gitignore`.

**5. Make rotation routine.** Put it on a schedule, and add "rotate shared secrets" to the checklist for when someone leaves.

**6. Review the access logs** of the database and the payment account for use that cannot be explained.

The order matters. Cleaning the repository first would feel productive and would leave four-year-old credentials working. Revoking is what removes the risk.
