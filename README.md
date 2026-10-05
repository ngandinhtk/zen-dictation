# Zen Dictation

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
## Account and payment backend

The account API runs separately from the Vite frontend during development.

Run \`npm run server\` in one terminal and \`npm run dev\` in another. The frontend proxies \`/api\` requests to \`http://localhost:3002\`.

The backend currently provides account registration, login, logout, the current-user endpoint, and authenticated practice-session endpoints. User data is stored in Supabase PostgreSQL. Set the Supabase connection string in \`DATABASE_URL\`; the required tables are created automatically on first start. If an older \`server/data.json\` exists, it is migrated automatically on first start.

New accounts are Free by default. Premium entitlement is granted only after a valid license key is activated. The Premium payment screen now uses ZaloPay; the server creates orders and verifies ZaloPay callbacks before issuing a license.

For local license testing, set `PREMIUM_LICENSE_KEYS` to a private test key in your untracked `.env` file, then run `npm run server:local`. Users can enter that key from the Premium page without creating an account. In production, license keys should be created by the payment webhook rather than configured manually.

Keep `PREMIUM_LICENSE_KEYS` and `PREMIUM_DATA_KEY` on the API host, rather than in the frontend hosting environment. Generate a private random value for `PREMIUM_DATA_KEY`; leave secret values blank in `.env.example` and never commit them to documentation.

### ZaloPay configuration

ZaloPay secrets must stay on the backend. Configure these environment variables before using the checkout:

```text
ZALOPAY_APP_ID=your_app_id
ZALOPAY_KEY1=your_key1
ZALOPAY_KEY2=your_key2
ZALOPAY_CALLBACK_URL=https://your-public-api.example.com/api/payments/zalopay/callback
PUBLIC_APP_URL=https://your-app.example.com
PREMIUM_PRICE_VND=125000
```

Use ZaloPay Sandbox first. The callback URL must be reachable from ZaloPay; a localhost URL will not receive callbacks. After the user returns from ZaloPay, the backend stores the generated license against the payment order, ready for the payment-result screen or an email delivery step.

### Password reset

The account form includes **Forgot password?**. Configure `BREVO_API_KEY`, `EMAIL_FROM` (an address on a verified Brevo sender domain, for example `Zen Dictation <no-reply@example.com>`), and `PUBLIC_APP_URL` (the frontend URL) on the backend to enable reset emails. Create an API key in Brevo and verify your sender domain before sending to users. Keep the API key backend-only. Restart the backend after deploying; it creates the protected `password_reset_tokens` table automatically. For local development, set `CLIENT_ORIGIN=http://localhost:5173`, `PUBLIC_APP_URL=http://localhost:5173/`, and `VITE_API_URL=http://localhost:3002/` in `.env`, then run `npm run server:local` and `npm run dev` in separate terminals.

Reset links expire after 30 minutes and can only be used once. Tokens are stored as SHA-256 hashes. A successful reset invalidates all reset links and existing login sessions for that account. The request response does not disclose whether an email is registered.

Run `node --test server/password-reset.test.mjs` to check reset validation, expiry, replay protection, rollback, and session revocation.

### Sentence bank

Sentence metadata is normalized in `src/data/sentenceBank.ts`. The practice flow continues to consume text arrays, while `SENTENCE_BANK` and `VOCABULARY_SENTENCE_BANK` provide items with `id`, `text`, `difficulty`, `topic`, `source`, and optional `license` fields.

New external sentences must have commercial usage rights, record the license in the metadata, and pass manual checks for grammar, length, and difficulty before being added to the active bank. Existing sentences are marked as `custom`.

e6b9fa7ad2b1f0ad02daee7f96a9cf5e
