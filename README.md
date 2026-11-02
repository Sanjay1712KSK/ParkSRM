# ParkSRM

Intelligent campus parking for SRMIST Kattankulathur. One TypeScript application targets web, Android and iOS using Vite + React + Capacitor.

## Current implementation

Deployment verification retriggered on November 2, 2026. TypeScript build fixes included.

- Responsive dashboard, parking zones and availability
- Student / faculty / researcher profile onboarding
- Strict `@srmist.edu.in` email validation in the client (production verification must also happen server-side)
- Timetable CSV import, sample timetable and manual session editing
- Schedule-aware parking windows with a configurable 10-minute grace period
- 25-credit reservation hold / release / forfeiture demo ledger
- Admin-oriented parking overview and configurable zones
- Demo mode using browser local storage
- Supabase SQL foundation with RLS, wallet ledger and reservation constraints
- GitHub Pages deployment workflow

> Demo mode is for development and demonstration only. It is not an authoritative parking or payment system. Production booking, credit movements, eligibility and expiry must be enforced in trusted backend code and database transactions.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite. Without Supabase variables the app uses demo mode.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_initial_schema.sql` in the SQL editor or with the Supabase CLI.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Enable email OTP / magic-link authentication.
5. Configure allowed redirect URLs for local development and the deployed GitHub Pages URL.
6. Review and deploy the server-side functions in `supabase/functions/` before allowing real reservations.

The initial schema intentionally does not grant users direct write access to wallet balances or reservation state. Implement booking and checkout through authenticated Edge Functions / database RPCs with row locks and idempotency keys.

## GitHub Pages

The repository must be named `ParkSRM` for the current Vite base path.

1. Create a new public GitHub repository named `ParkSRM`.
2. Push this project to its default branch (`main`).
3. In GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions.
4. Add repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when Supabase is configured.
5. The included `.github/workflows/deploy.yml` builds and deploys the web app on every push to `main`.

The deployed URL will be `https://<github-username>.github.io/ParkSRM/`.

## Android / iOS

Capacitor requires platform tooling:

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
npm run android
npm run ios
```

Android builds require Android Studio / Android SDK. iOS builds require macOS and Xcode. The native projects are generated locally and should be committed after setup. For production, configure deep links, secure auth redirects, push notifications and app-store signing.

## Timetable CSV format

Required columns: `day,start,end,course,location`

Example:

```csv
day,start,end,course,location
Monday,08:00,09:45,Neural Networks,TP-401
Monday,12:00,13:45,Compiler Design,TP-203
Tuesday,10:00,11:40,Database Systems,TP-101
```

Times use 24-hour local campus time. The importer validates ranges and rejects malformed rows. PDF parsing is not included in this initial slice; users can convert a timetable PDF to CSV or enter sessions manually. A future parser should show a review screen before accepting extracted data.

## Architecture and safety decisions

- Client email-domain checks are only UX validation. Email ownership is established by Supabase Auth; production enrollment must additionally verify institutional eligibility.
- Academia credentials are never requested or stored. Only user-exported timetable files are imported.
- Schedule-derived windows are estimates of availability, not proof of physical attendance.
- A parking reservation, physical entry and physical exit are separate events.
- Wallet ledger entries are append-only. Credits are held on reservation and released on valid checkout; late checkout forfeits the hold.
- Penalty policy and credit amounts must be approved by SRM before any real-world use.
- A production deployment requires campus authorization, privacy review, retention rules and security testing.

## Quality checks

```bash
npm run typecheck
npm run test
npm run build
```

## License

Project source is provided for educational prototyping. Add an institution-approved license before public production distribution.
