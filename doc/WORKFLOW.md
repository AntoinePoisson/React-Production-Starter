# Workflow

Git workflow, CI/CD, versioning and deployment. Read this before your first push.

---

## Overview

```
DEVELOPER
  1. git checkout -b ft-my-feature develop
  2. git commit -m "feat(scope): description"
       └── pre-commit hooks (parallel)
       └── commitlint validates the message
  3. git push
       └── pre-push hooks, on main/master/prod only

                              ▼

CI/CD (.github/workflows/ci.yml)

  ┌────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌───────┐
  │  Lint  │ │ TypeCheck │ │ Security │ │ Secrets │ │ Unit Test │ │ Build │
  └────┬───┘ └─────┬─────┘ └────┬─────┘ └────┬────┘ └─────┬─────┘ └───┬───┘
       └───────────┴────────────┴────────────┴────────────┴───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │  E2E Desktop (3×4)  ·  E2E Mobile (2) │
                    └────────────────┬────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
    develop                        main                         prod
   ALWAYS deploy              ALWAYS deploy               IF ALL TESTS PASS
        │                            │                            │
        ▼                            ▼                            ▼
    [Sandbox]                   [Preprod]                  [Production]
   no versioning                    │                            │
                                    ▼                            ▼
                            [Release vX.Y.Z-pre]        [Release vX.Y.Z]
                             only if deploy OK           only if deploy OK
```

### Quick reference

|                      | develop | main         | prod           |
| -------------------- | ------- | ------------ | -------------- |
| **Role**             | Sandbox | Preprod      | Production     |
| **Lint mode**        | Strict  | Strict       | Strict         |
| **FIXME check**      | No      | Yes          | Yes            |
| **Pre-push tests**   | No      | Yes          | Yes            |
| **Deploy condition** | Always  | Always       | All tests pass |
| **Version format**   | None    | `vX.Y.Z-pre` | `vX.Y.Z`       |

> **Lint mode.** Strict (`--max-warnings 0`) on `dev`, `devel`, `develop`, `main`, `master` and
> `prod`, permissive elsewhere. A feature branch is where a scratch `console.log` may live, it
> just has to be gone before the code reaches `develop`.

---

## Branch strategy

| Branch    | Role                                              |
| --------- | ------------------------------------------------- |
| `develop` | Development environment for experimental features |
| `main`    | Staging, for validation before production         |
| `prod`    | Live production                                   |

| Pattern           | Usage        | Merge target                      |
| ----------------- | ------------ | --------------------------------- |
| `ft-*` / `feat-*` | New features | `develop`                         |
| `fix-*`           | Bug fixes    | `develop`, or `main` for a hotfix |
| `refactor-*`      | Refactoring  | `develop`                         |

```
1. Branch ft-my-feature from develop
2. Develop, with conventional commits
3. Merge into develop (PR optional)
4. Merge develop → main (PR recommended)   → -pre release
5. Merge main → prod (PR required)         → stable release
```

---

## Git hooks

Managed by [Lefthook](https://lefthook.dev). All pre-commit hooks run **in parallel**.

| Hook                             | Phase      | develop | main   | prod   |
| -------------------------------- | ---------- | ------- | ------ | ------ |
| `linter`                         | pre-commit | strict  | strict | strict |
| `typecheck` (staged files)       | pre-commit | run     | run    | run    |
| `i18n` (re-extract catalogues)   | pre-commit | run     | run    | run    |
| `audit`                          | pre-commit | run     | run    | run    |
| `knip`                           | pre-commit | run     | run    | run    |
| `size-limit` (if `dist/` exists) | pre-commit | run     | run    | run    |
| `secrets-check`                  | pre-commit | run     | run    | run    |
| `fixme-check`                    | pre-commit | skip    | run    | run    |
| `optimize-assets`                | pre-commit | run     | skip   | skip   |
| `tests`                          | pre-push   | skip    | run    | run    |
| `build`                          | pre-push   | skip    | run    | run    |
| `commitlint`                     | commit-msg | run     | run    | run    |

`stage_fixed: true` re-stages only the files the hooks rewrote, never `git add -A`.

**The i18n hook reports, it does not stage.** `lingui extract` reads `src/` from disk, not from
the index, so staging its output would commit catalogue entries for code that isn't in the
commit. When it fails the regenerated files are already on disk: review them, fill in the
translations, `git add`, commit again.

---

## CI/CD

**Configuration**: `.github/workflows/ci.yml`. Every action is pinned by commit SHA.

| Job                                                                     | Branches   | Timeout     |
| ----------------------------------------------------------------------- | ---------- | ----------- |
| `lint` · `typecheck` · `security-audit` · `secrets-check` · `test-unit` | all        | 5–10 min    |
| `build`                                                                 | all        | 15 min      |
| `storybook`                                                             | all        | 10 min      |
| `size-limit`                                                            | all        | 10 min      |
| `node-compat` (non-blocking)                                            | all        | 15 min      |
| `e2e-test` (3 browsers × 4 shards)                                      | dev+       | 40 min      |
| `e2e-mobile` (mobile-chrome, mobile-safari)                             | dev+       | 40 min      |
| `benchmark` + `benchmark-report`                                        | main, prod | 40 / 10 min |

"dev+" means `dev`, `devel`, `develop`, `main`, `master`, `prod`, on push or on a PR targeting one
of them.

### Deployment conditions

**Deploy runs before release**, always. That ordering is what stops a git tag from pointing at
code that was never deployed.

```yaml
deploy-sandbox:  if: always() && ref == develop   # deploys even if tests fail
deploy-preprod:  if: always() && ref == main      # deploys even if tests fail
release-preprod: if: needs.deploy-preprod.result == 'success'
deploy-prod:     if: ref == prod                  # no always(), BLOCKS on test failure
release-prod:    if: needs.deploy-prod.result == 'success'
```

Only `develop` and `main` use `always()`: sandbox and preprod are intentionally permissive for
rapid iteration. On `prod`, the absence of `always()` blocks deployment if any test fails.

### Required repository variables

`VITE_SITE_URL` (**required**, without it every deployed page ships a localhost canonical),
`VITE_PROJECT_NAME`, `VITE_MAIN_WEBSITE_NAME`.
Settings → Secrets and variables → Actions → Variables.

---

## Deployment

There is none, on purpose. The three deploy jobs carry the full gating logic and an empty step:

```yaml
- name: Deploy
  run: |
    echo "::notice::No deployment provider configured, the site is in ./dist/client"
    # ▼ Your deployment command goes here. ▼
```

Publish `dist/client/`. Some examples:

| Host         | Step                                                         |
| ------------ | ------------------------------------------------------------ |
| GitHub Pages | `actions/deploy-pages` after `actions/upload-pages-artifact` |
| Netlify      | `netlify deploy --dir=dist/client --prod`                    |
| Cloudflare   | `cloudflare/wrangler-action` with `command: deploy`          |
| S3 / CDN     | `aws s3 sync dist/client s3://bucket --delete`               |
| Your own box | `rsync -az --delete dist/client/ user@host:/srv/site/`       |

Two things the build guarantees whatever you pick:

- **`404.html` at the root**, what every static host serves for an unknown path.
- **Content-hashed filenames under `static/`**, safe to cache immutably. Everything under
  `assets/` is verbatim and must not be.

Keep the deploy step exiting non-zero on failure, that is what stops the release job.

---

## Versioning

Release-Please, with one manifest per branch:
`.release-please-manifest-preprod.json` (main) and `-prod.json` (prod).

| Commit type                    | Bump  |
| ------------------------------ | ----- |
| `feat:`                        | MINOR |
| `fix:`, `perf:`, `refactor:`   | PATCH |
| `feat!:` or `BREAKING CHANGE:` | MAJOR |

Changelog sections: ✨ Features · 🐛 Bug Fixes · ⚡ Performance · ♻️ Refactoring · ✅ Tests ·
🧪 E2E · 🏗️ Build · 👷 CI/CD · 📚 Docs · ⏪ Reverts. `chore`, `style` and `merge` are hidden.

---

## Conventional commits

```
type(scope): description
```

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `merge`, `perf`, `refactor`,
`revert`, `style`, `test`.

```bash
feat(scene): add depth-of-field post-processing
fix(camera): clamp zoom on touch devices
feat(store)!: rename the first-visit flag

BREAKING CHANGE: `isNewVisitor` is now `isFirstVisit`.
```

---

## New project checklist

### 1. Rename

```bash
node initialize.js
```

It rewrites `package.json`, the docs, `.env.example`, `manifest.json`, `humans.txt`,
`Identity.ts` and the storage namespaces; resets the version to `0.0.0` and empties the
changelog; and offers to drop the 3D demo and reinitialise git.

Then check what it could not know:

- [ ] `src/utils/config/Identity.ts`, `TWITTER_HANDLE` is empty by design, set it only if you own
      the account
- [ ] `src/app/globals.css`, the `@theme static` palette
- [ ] UI copy in the components, then `pnpm i18n` and translate `src/i18n/messages/fr.json`

### 2. Artwork

Every raster asset is generated from one vector source:

```bash
# Edit MARK and COLORS at the top of the script, then:
pnpm assets:brand
```

That regenerates the favicon, the apple touch icon, both `any` sizes, both `maskable` sizes and
the 1200x630 OG image. Check any replacement against <https://maskable.app>.

### 3. Git & GitHub

- [ ] Point `origin` at the new repository
- [ ] Create `develop`, `main`, `prod`
- [ ] Configure branch protection; set `prod` as the production branch
- [ ] Add the `VITE_SITE_URL` repository variable. **Without it every page ships a localhost canonical.**

### 4. Deployment

- [ ] Fill in the three `Deploy` steps in `.github/workflows/ci.yml`
- [ ] Add whatever credentials your host needs as repository secrets

### 5. Verification

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm knip` all pass
- [ ] `pnpm build && pnpm size` passes the budgets
- [ ] `pnpm website`, then check `/`, `/en`, `/fr` and a nonsense URL
- [ ] Commit with a non-conventional message (should fail)
- [ ] Push to `develop` (CI green, deploy job succeeds as a no-op)
- [ ] Merge `develop` → `main` (should create a `-pre` release)
- [ ] Merge `main` → `prod` (should create a stable release)
