# Shipping Note QA

Use this guide to verify the Phase 4 shipping note CRUD foundation with real role boundaries.

Public self-sign-up remains disabled by default. There is no public sign-up page.

## 1. Prepare role test accounts locally

The repository already includes `npm run admin:create-first` for the first admin.

To create a local `sale` or `accountant` user for QA:

1. Add these variables to `.env.local`:

```env
DEV_USER_EMAIL=""
DEV_USER_NAME=""
DEV_USER_PASSWORD=""
DEV_USER_ROLE="sale"
```

2. Set `DEV_USER_ROLE` to either `sale` or `accountant`.
3. Run:

```bash
npm run dev:user:create
```

Notes:
- `dev:user:create` runs only outside production.
- The script refuses to create `admin` users.
- The script lowercases the email before creation.
- The script refuses to overwrite a user if the existing role does not match the requested safe role.
- `.env.local` must never be committed.

Repeat with a different local email to create both test roles if needed.

## 2. Admin QA flow

Sign in as the local admin and verify:

1. `/shipping-notes` is accessible.
2. `/shipping-notes/new` is accessible.
3. A draft shipping note can be created.
4. The created draft can be updated while status is `draft`.
5. The draft can be submitted.
6. The submitted note becomes read-only in the current phase.

## 3. Sale QA flow

Sign in as a `sale` user and verify:

1. `/shipping-notes` is accessible.
2. `/shipping-notes/new` is accessible.
3. A draft shipping note can be created.
4. The sale user can update only their own draft notes.
5. The sale user can submit only their own draft notes.
6. Accessing another user's note ID returns a protected result rather than exposing data.
7. Buying charges, profit, tax settings, and audit log data do not appear in list/detail UI.

## 4. Accountant QA flow

Sign in as an `accountant` user and verify:

1. `/shipping-notes` is accessible.
2. Existing non-deleted notes can be listed and viewed.
3. `/shipping-notes/new` is not allowed.
4. Draft create, update, and submit actions are denied.
5. The current UI still does not expose buying charges, profit, tax settings, or audit logs in shipping note pages.

## 5. Audit verification

After manual create, update, and submit tests, verify that audit rows exist for:

- `shipping_note.create_draft`
- `shipping_note.update_draft`
- `shipping_note.submit`

Check that each row records:

- actor user ID
- entity type
- entity ID
- before/after snapshots where applicable

Do not print secrets during verification.

## 6. Selling charge line QA (Phase 5B)

### Sale

Sign in as a `sale` user and verify:

1. On a draft shipping note the sale user owns, the "Selling Charges" section is visible.
2. The "Add Selling Charge" form is visible on own draft notes.
3. A selling charge can be created with valid data (charge name, quantity, unit, unit price, currency).
4. The created charge appears in the selling charges table with server-computed amounts.
5. A selling charge can be soft-deleted via the delete button.
6. After submitting the note, the add form and delete buttons disappear.
7. No buying charges, profit, tax, override, or audit data appears anywhere.
8. Accessing another user's note returns 404, not charge data.

### Accountant

Sign in as an `accountant` user and verify:

1. Selling charges are visible on accessible shipping notes.
2. The "Add Selling Charge" form is not shown.
3. Delete buttons are not shown.
4. Attempting to call charge mutation actions server-side is denied.

### Admin

Sign in as the local admin and verify:

1. Selling charges are visible on all non-deleted shipping notes.
2. The "Add Selling Charge" form is visible on any draft note.
3. A selling charge can be created and soft-deleted on any draft note.
4. After submitting a note, charge mutation controls disappear.

### Audit

After charge line tests, verify that audit rows exist for:

- `shipping_note_charge.create`
- `shipping_note_charge.update`
- `shipping_note_charge.delete`

Each row should record actor user ID, entity type `shipping_note_charge`, entity ID, and before/after snapshots.

## 7. Selling summary QA (Phase 6B.2)

After creating or editing selling charges, verify:
1. The read-only selling summary updates automatically to reflect the new charge count, total VND, and original totals.
2. The summary remains visible and read-only on submitted notes.
3. Accountant and admin roles can view the summary.
4. Sale roles can view the summary only on their own accessible notes.
