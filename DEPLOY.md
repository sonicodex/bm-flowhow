# DEPLOY

Everything that exists only when the app is deployed. Nothing here runs
locally, and none of it happens on an agent's initiative: the owner deploys
(SPEC §11). Keep this list current. When a phase adds something that only
matters at deployment, it goes here, in the same commit.

Commands run from `app/`.

## 1. The remote D1

- The remote D1 is `flowhow-test` (`2fd74d7a-ff48-4db5-af49-9ec71d87fc18`),
  created 2026-11-19. Its `database_id` is in the `DB` binding of
  `wrangler.jsonc`. If it is ever recreated, run
  `npx wrangler d1 create <name>`, put the new id there, then
  `npm run types`.
- Keep `"preview_database_id": "DB"` beside it. Wrangler keys the local
  database by that id, and `DB` is where local state lived before there was
  a `database_id`. Without it, every local command (`db:migrate`, `dev`,
  `d1 execute --local`) opens a new, empty database. The tests are not
  affected: they get a fresh database of their own.
- Apply the migrations: `npx wrangler d1 migrations apply DB --remote`.
  It asks nothing when it runs without a terminal, as in CI.
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
  - Measured 2026-11-19 on `flowhow-test.software-jpmb.workers.dev`, with
    four failed logins (an unknown user runs the same PBKDF2):
    21 to 34 ms of CPU, about 1 s of wall time (the deliberate wait). The
    outcome was `ok` every time; none was cut.
  - 2026-11-20, the owner chose fewer iterations over Workers Paid. New
    hashes use **10,000** (`ITERATIONS` in `app/src/password.ts`). Measured
    on the deployed Worker, 25 failed logins per count, median CPU:
    1 iteration 2 ms, 5,000 4 ms, 8,000 4 ms, 10,000 4–5 ms (two runs),
    12,000 7 ms, 15,000 7 ms, 100,000 23 ms. About one request in four
    runs a few ms over the median whatever the count (a fresh isolate).
    Stored hashes keep their own count up to 100,000 (`MAX_ITERATIONS`)
    and only get cheaper when the password changes:
    `npm run user:create -- --usuario <u> --restablecer --remote`, or a
    reset from the Users screen.
  - **If the account moves to Workers Paid, revert this:** set
    `ITERATIONS` back to 100,000 (the most Workers accepts), update
    `test/password.test.ts`, deploy, and reset passwords as they come up.
    DECISIONS 2026-11-20 (PBKDF2 iterations) says why it was lowered.
- **`POST /users/import` CPU time** (phase 7.2), with a file of about 50
  accounts. Each temporary password is hashed at 100 iterations, which
  makes about 4 ms for 50 in Node on a development Mac. If it is cut
  (error 1102), split the file. Do not raise the count for temporary
  passwords; DECISIONS 2026-11-20 (phase 7.2) says why it is low.
- **`POST /login` with a temporary password** should cost about what any
  login costs: the check tops a 100-iteration hash up to 10,000.
- The tour requests and, in phase 6, the progress report, as DECISIONS
  2026-11-12 (deployment check) asks.
- The editor's writes on the largest real flow (Apertura de OT, 36
  steps): `POST /flows/:id/draft` (the save, which reviews the whole
  grid), `/draft/review` (the import's review) and `/publish`. Each one
  validates the flow and loads every other flow's latest release, to
  check links.

## 6. Automatic deployment — the target, not built yet

Every push to `main` deploys. There is no `main` branch yet; work lives on
`devel`. When it exists, the deployment moves to a GitHub Action running
`wrangler deploy` with a Cloudflare API token in the repository's secrets,
and the migrations run in the same job, before the deploy. Until then the
owner deploys by hand, and nothing in the steps above may depend on a human
being there: every one of them has to be reproducible from CI, the first
Board user excepted, which is created once.

## 7. After every deployment

- The session cookie is `Secure`: the app must be served over HTTPS
  (`workers.dev` and Cloudflare custom domains are).
- Smoke check: the root URL shows the login, a wrong password shows the
  generic message, the Board user gets in and out.
