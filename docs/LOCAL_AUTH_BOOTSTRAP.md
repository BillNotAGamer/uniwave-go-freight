# Local Auth Bootstrap

This project keeps public self-sign-up disabled by default. There is no public sign-up page.

Use the development-only bootstrap script to create the first admin locally.

## 1. Generate a strong auth secret

Use one of these commands and place the result in `.env.local` as `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

```bash
npx auth secret
```

## 2. Set local bootstrap values in `.env.local`

Add these variables locally:

```env
BOOTSTRAP_ADMIN_EMAIL="admin@uniwave-logistics.com"
BOOTSTRAP_ADMIN_NAME="Local Admin"
BOOTSTRAP_ADMIN_PASSWORD="Admin@12345"
```

The bootstrap script lowercases the email before creating the user.

## 3. Run the bootstrap script

```bash
npm run admin:create-first
```

The script:
- runs only when `NODE_ENV` is not `production`
- loads `.env.local`
- refuses to create a second admin automatically
- uses Better Auth server-side APIs to create the credential user
- promotes the created user to `role = "admin"` and ensures the user is active

## 4. Secret safety

- Never commit `.env.local`
- Never commit bootstrap passwords
- Keep `AUTH_SECRET` random and at least 32 characters of entropy
