# RUNBOOK.md — Deploying and checking the site

The site is static: no database, no secrets, no environment variables, no server functions. Every page is
prerendered at build time. Adapted from inference-tradeoffs-explained's RUNBOOK.

## 1. Deploy from a clean export

The Vercel project (`compute-in-transit-results`) is not on Vercel's Git integration. Deploy with the logged-in
Vercel CLI from a clean export of `HEAD`, so nothing untracked is uploaded:

```bash
rm -rf /tmp/citr-deploy && mkdir /tmp/citr-deploy
git archive HEAD | tar -x -C /tmp/citr-deploy
cp -r .vercel /tmp/citr-deploy/ 2>/dev/null || true   # after the first `vercel link`
(cd /tmp/citr-deploy && vercel deploy --yes)          # preview
(cd /tmp/citr-deploy && vercel deploy --prod --yes)   # production
```

Framework: Next.js 14 (App Router), Node 20, `pnpm install --frozen-lockfile`, build command `pnpm build`, output
`.next`. No environment variables.

## 2. Smoke-check

```bash
pnpm smoke https://compute-in-transit-results.vercel.app
VERCEL_BYPASS=… pnpm smoke https://<preview-url>     # a protected preview
```

It fetches every page and `/run_sweep.ipynb`, fails on any non-200 (redirects included), on a page without its
title, and on any response that names the module's developer. Then open `/transit` in a browser and press **Play**:
the caption must update as the bandwidth sweeps; with reduce-motion set in the OS, nothing should play until you
press Play.

## 3. Read the logs

```bash
vercel logs --environment production --since 15m --no-branch --expand
```

A static site should log almost nothing.

## Updating the data

The experiment and the simulation are vendored at one commit each (`VENDORED.json`). To move to newer ones, change
the commits in `scripts/vendor.py` and `scripts/transit_reference.py`, check the simulation out at its commit, then:

```bash
pnpm data                  # copies the files, exports the run logs, records SHA-256s
pnpm transit               # the port's constants and parity fixtures, from the simulation's package
pnpm test                  # parity, every reproducible results.md cell, the run logs, the hashes, naming
```

The pages quote results.md cells by table and row, and the run-log views by results.json group: a lookup that no
longer resolves fails the build.

## Why e2e runs under `--no-experimental-require-module`

Plain Node 20.19+ / 22.12+ can `require()` an ES module; Vercel's function loader can't. This site has no server
functions, but CI runs the e2e server under the flag anyway (as the companion sites do), so the class of bug can't
arrive unnoticed if one is added.
