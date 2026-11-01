# Zen Dictation

## Database connection check

Set the backend-only `DATABASE_URL` in your untracked `.env`, then run `npm run server:local`. Run `npm run db:check` to measure initial connection setup, five read-only `SELECT 1` round trips, and acquiring an existing pooled connection. The check does not start the API, create tables, or load sentence data, and does not print credentials. Run it on the API host as well to measure the network path used in production.

Copy connection strings from Supabase Dashboard → Connect. For this persistent Node backend, use a direct connection when IPv6 is available, or the session pooler for IPv4-only environments. The existing transaction pooler also works with the current unnamed queries; compare measurements before switching. Keep the API host near the database region (currently Tokyo). See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

Authenticated requests look up the session and user in one query, while still checking session expiry on every request. Schema initialization and sentence-cache loading still happen at API startup; the connection check measures them separately by excluding them.

## YouTube dictation (temporarily hidden)

The YouTube entry point is temporarily hidden while we investigate cases where YouTube returns an empty caption response (`EMPTY_CAPTIONS`). The implementation remains in the codebase and can be re-enabled after caption retrieval is reliable.

When re-enabled, run the API (`npm run server:local` with your existing `.env`) and frontend (`npm run dev`). In **Practice from YouTube**, paste a video link and choose **Load captions**. Videos need accessible English captions and must allow embedded playback.

The embedded player plays the current sentence using the original audio and stops at its end. Use **Play sentence / Replay** or **Replay (Ctrl)** to repeat it. Type your answer, choose **Check answer (Enter)** to reveal feedback, then **Next (Enter)** to continue. Captions are hidden again for the next sentence. If autoplay is blocked, press the play button. Playback speed uses the speed setting; voice selection applies to regular practice.

Caption fragments are grouped using punctuation, pauses and length limits. Automatic captions may have imperfect wording and sentence boundaries. Run timing/parser checks with `node --test server/youtubeCaptions.test.mjs`.

Caption loading retries transient network failures once and has a 60-second total backend deadline (the client waits 70 seconds). Errors distinguish a timeout, a blocked request and an empty caption response. If JSON captions are empty, the server tries the original caption format. YouTube can still return an empty response for a video with visible captions; a longer timeout does not resolve that restriction. Restart the API after updating server code. Run loading/error checks with `node --test server/youtubeTranscript.test.mjs`.

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

### Password reset

The account form includes **Forgot password?**. Configure `BREVO_API_KEY`, `EMAIL_FROM` (an address on a verified Brevo sender domain, for example `Zen Dictation <no-reply@example.com>`), and `PUBLIC_APP_URL` (the frontend URL) on the backend to enable reset emails. Create an API key in Brevo and verify your sender domain before sending to users. Keep the API key backend-only. Restart the backend after deploying; it creates the protected `password_reset_tokens` table automatically. For local development, set `CLIENT_ORIGIN=http://localhost:5173`, `PUBLIC_APP_URL=http://localhost:5173/`, and `VITE_API_URL=http://localhost:3002/` in `.env`, then run `npm run server:local` and `npm run dev` in separate terminals.

Reset links expire after 30 minutes and can only be used once. Tokens are stored as SHA-256 hashes. A successful reset invalidates all reset links and existing login sessions for that account. The request response does not disclose whether an email is registered.

Run `node --test server/password-reset.test.mjs` to check reset validation, expiry, replay protection, rollback, and session revocation.

### Sentence bank

Sentence metadata is normalized in `src/data/sentenceBank.ts`. The practice flow continues to consume text arrays, while `SENTENCE_BANK` and `VOCABULARY_SENTENCE_BANK` provide items with `id`, `text`, `difficulty`, `topic`, `source`, and optional `license` fields.

New external sentences must have commercial usage rights, record the license in the metadata, and pass manual checks for grammar, length, and difficulty before being added to the active bank. Existing sentences are marked as `custom`.

The bank API caches each pack/level response for five minutes, validates it with an ETag, and serves gzip-compressed responses when supported; the browser keeps a matching five-minute session cache and preloads the next available level or free vocabulary pack after the current pool is ready. Core practice limits formula-generated examples and supplements them with hand-written topic variety. New curated items use practical CEFR-aligned targets: Easy A1–A2 (7–12 words), Medium B1–B2 (10–20 words), and Hard C1–C2 (14–30 words). Run `npm run sentence-bank:check` to validate curated sentence lengths/duplicates and report word-count medians, repeated openings, and JSON/gzip payload sizes without connecting to the database. After updating content, run `npm run seed:sentences`; it deactivates obsolete rows in the seeder's deterministic ID namespace without deleting them. Restart the API so its in-memory cache is refreshed.

## Speech playback

Speech uses the browser's Web Speech API. Zen Dictation prefers an available English voice labeled Natural or Neural, then Google US English, while keeping manual voice selection available. A sentence-ending pause is added when the practice text has no punctuation. Voice quality and available options depend on the browser and voices installed on the device; choose a Natural or Neural voice in Settings when one is available.

e6b9fa7ad2b1f0ad02daee7f96a9cf5e
