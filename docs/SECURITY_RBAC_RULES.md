# Security and RBAC Rules

## Security Principle

Authorization must be enforced on the server for every protected read and mutation.

UI hiding is not security.

## Roles

### sale
Allowed:
- Create shipping notes.
- Edit own draft shipping notes.
- Submit own shipping notes.
- View permitted shipping note fields.

Denied by default:
- Buying rates.
- Net profit.
- Tax configuration.
- Accounting reports.
- Audit logs.
- User management.

### accountant
Allowed:
- View shipping note list.
- View accounting/financial fields.
- Review charges.
- Configure or override tax/VAT fields where allowed.
- Lock/review accounting periods where implemented.

Denied by default:
- Create shipping notes.
- Manage users.
- Destructive admin actions.

### admin
Allowed:
- Full access.
- User/role management.
- Admin settings.
- Override and destructive actions, preferably audited and soft-deleted.

## Protected Data

Never expose these to unauthorized roles:
- Buying charges
- Vendor cost
- Net profit
- Tax rules
- Tax overrides
- Audit logs
- Deleted records
- User administration data
- Google Drive credentials or tokens

## Mutation Requirements

Important mutations must:
- Check user session.
- Check role/permission server-side.
- Validate input.
- Write audit log.
- Return minimal necessary data.

## Audit Requirements

Audit should track:
- actor user ID
- action
- entity type
- entity ID
- before value when reasonable
- after value when reasonable
- timestamp
- reason/note for sensitive changes

## Session and Secrets

- Never commit `.env`.
- Provide `.env.example` only.
- Never log secrets.
- Never expose tokens in client components.
