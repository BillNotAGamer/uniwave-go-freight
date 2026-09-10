# Backup and Recovery Runbook

This runbook defines recovery expectations for Uniwave Go Freight. Database backups are sensitive and must never be committed to the repository.

## Backup Procedure

1. Confirm the exact production database target without printing credentials.
2. Confirm provider-level recovery capability, such as Neon point-in-time restore or branch restore, in the provider console or API.
3. Create a provider restore point, branch, snapshot, or equivalent recovery checkpoint where available.
4. Create a logical PostgreSQL backup with `pg_dump -Fc --no-owner --no-privileges` from a secure operator machine.
5. Store the backup in an encrypted, access-controlled location outside the repository.
6. Record only non-sensitive evidence: timestamp, size, checksum/hash, format, target descriptor, and structural validation result.
7. Validate the backup structure with `pg_restore --list` or equivalent without printing row contents.

Phase 11K.1 proved this procedure with PostgreSQL client `18.3` against a PostgreSQL `18.6` production server. The temporary custom-format dump was stored under the operator temp directory, structurally validated, restored into a disposable local PostgreSQL cluster, and then removed.

## Restore Drill

1. Never restore over production.
2. Prefer a provider-isolated temporary branch or database.
3. Restore the backup into the disposable target.
4. Verify schema objects, Drizzle journal entries through `0005`, indexes, constraints, and basic row-count consistency.
5. Run safe smoke checks against the disposable target only.
6. Remove only the disposable target when authorized.

Phase 11K.1 used an isolated local PostgreSQL cluster initialized under the operator temp directory on localhost port `55432`; it was stopped and deleted after verification.

## Migration Recovery Policy

- Do not manually edit Drizzle migration journal rows to simulate rollback.
- If a future migration fails before data mutation, stop deployment and fix forward only after review.
- If a migration failure leaves partial schema or data state, stop and assess recovery from provider restore/branch or logical backup.
- Destructive or data-transforming migrations require a verified backup/restore path before execution.
- Additive migrations may be fixed forward only when the live journal/schema reconciliation is unambiguous and lead review approves the plan.

## Credential Recovery

- Rotate any credential that was historically committed or exposed.
- Update the deployment secret store before invalidating the old value.
- Validate connectivity with the new credential.
- Invalidate the old credential and confirm it no longer works.
- Do not print old or new credential values in tickets, reports, logs, or commits.
