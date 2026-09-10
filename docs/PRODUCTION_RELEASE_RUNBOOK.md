# Production Release Runbook

This runbook is the operational release checklist for Uniwave Go Freight. It intentionally contains no credentials.

## Pre-Go-Live Gates

1. Obtain customer-supplied production Cloudflare R2 and Google Drive service-account configuration.
2. Run Phase 11J live artifact verification: R2 upload, exact-key read-back, historical artifact download, Drive upload, exact-ID verification, retry/reconcile, idempotency, and cleanup.
3. Rotate the production database credential that was historically exposed through a tracked example file.
4. Configure deployment secrets in the selected production secret store: database, auth, public auth URL, R2, Drive, and runtime guard variables as appropriate.
5. Push or open a PR for the release commit and require the GitHub-hosted `Quality Gates` workflow to pass on that commit.
6. Deploy the release candidate to the selected Node.js 24 production runtime.
7. Verify HTTPS, host/origin handling, forwarded protocol behavior, HSTS, and Secure/HttpOnly/SameSite session cookie behavior on the real public origin.
8. Verify production database connectivity through safe application smoke checks.
9. Perform a safe authenticated smoke test using a controlled account.
10. Perform a safe Shipping Note smoke test using test-owned data and cleanup.
11. Verify R2 and Google Drive post-deployment behavior using exact test-owned resources.
12. Establish a fresh backup/recovery checkpoint and record evidence before approving go-live. Phase 11K.1 proved the logical backup and disposable restore-drill procedure, but the final go-live operator should still create a current checkpoint immediately before release.
13. Approve go-live only after every blocking gate is `PASS` or explicitly waived by the owner with documented risk.

## Required Runtime

- Node.js 24.x.
- `package.json` engines: `>=24 <25`.
- `.nvmrc`: `24`.
- npm `engine-strict=true`.

## Release Status Language

- `ENGINEERING COMPLETE — RELEASE CANDIDATE` means repository engineering validation is complete enough for lead review.
- `READY FOR PRODUCTION` must not be used while live artifact verification, credential rotation, hosted CI, HTTPS/cookie/proxy verification, or backup/restore evidence remains pending.
