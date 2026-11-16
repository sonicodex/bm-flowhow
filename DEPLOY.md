# DEPLOY

Everything that exists only when the app is deployed. Nothing here runs
locally, and none of it happens on an agent's initiative: the owner deploys
(SPEC §11). Keep this list current. When a phase adds something that only
matters at deployment, it goes here, in the same commit.

Commands run from `app/`.

## 1. The remote D1

- `wrangler.jsonc` has no `database_id`: the deployment-check database was
  deleted (DECISIONS 2026-11-12). Create one with
  `npx wrangler d1 create <name>` and put its `database_id` in the `DB`
  binding, then `npm run types`.
- Apply the migrations: `npx wrangler d1 migrations apply DB --remote`.
  From then on, a migration applied remotely is never edited. Changes go in
  a new file.
- Migration `0005` deletes the placeholder user of phases 2 and 3. Remotely
  it finds nothing, unless a database from that time is reused.

## 2. Secrets

- The Worker reads no secret today.
- `DEV_PASSWORD` (`app/.dev.vars`) is only for the local development
  accounts. Never upload it with `wrangler secret put`: the deployed app
  must not have accounts with a shared, known password.
- A future secret goes in `app/.dev.vars` locally, in
  `npx wrangler secret put <NAME>` remotely, and gets a line here.

## 3. The first Board user

There is no open sign-up (SPEC §4). After the migrations:

```
npm run user:create -- --usuario <usuario> --nombre "<nombre completo>" --remote
```

It asks for the password twice, hashes it on your machine and sends only the
hash. The account gets all three permissions, `can_manage_users` included,
so it can create everyone else from the app. If the Board is ever locked
out, run it again with `--restablecer` instead of `--nombre`.

The database keeps at least one active account with `can_manage_users`
(trigger in migration 0006): from then on nobody, through the app or SQL,
can remove the last one. A lost password is recoverable with
`--restablecer`; a lost permission would need SQL, so the trigger forbids it.

`npm run db:load` (reference flows and the empleado / lider / junta
accounts) is local only and cannot reach the remote D1. Never load them
remotely by any other means.

## 4. Rate limiting on the login

The login waits one second after each failed attempt and never locks an
account out (DECISIONS, phase 4 plan). The rest is a Cloudflare rule:

- Dashboard → the zone → Security → WAF → Rate limiting rules.
- Match `http.request.method eq "POST" and http.request.uri.path eq "/login"`,
  counted per IP. Block when it goes over. On the Free plan the period and the
  block are 10 seconds; something like 5 requests per 10 seconds lets a person
  who mistypes through and stops a script.
- **WAF rules apply only to a zone (a domain on Cloudflare), not to a
  `*.workers.dev` address.** If the app is served from `workers.dev`, this
  rule cannot be created. Then the options are a custom domain, or the
  Workers rate limiting binding, which is a code change to propose first.
- Check the plan's current limits in the dashboard when creating the rule.

## 5. Measure after deploying

With `npx wrangler tail` while using the app:

- **`POST /login` CPU time.** PBKDF2 at 100,000 iterations takes about 12 ms
  on a development Mac, and the Workers Free plan allows 10 ms of CPU per
  request. If logins fail with "exceeded CPU" (error 1102), the options are
  Workers Paid, or fewer iterations. The iteration count is stored in each
  hash, so it can change without breaking stored passwords. That decision is
  the owner's: do not lower it silently.
- The tour requests and, in phase 6, the progress report, as DECISIONS
  2026-11-12 (deployment check) asks.

## 6. After every deployment

- The session cookie is `Secure`: the app must be served over HTTPS
  (`workers.dev` and Cloudflare custom domains are).
- Smoke check: the root URL shows the login, a wrong password shows the
  generic message, the Board user gets in and out.
