# ParkSRM

ParkSRM is a sustainable campus-parking prototype for SRMIST Kattankulathur. The web app uses Vite, React, TypeScript and Capacitor. It supports a browser-only showcase mode and an optional authenticated Supabase backend.

> **Prototype boundary:** this is not an SRM-authorised parking service. Seeded zones and demo occupancy are illustrative. Do not enforce real penalties or use the prototype credits as money. A physical deployment requires approval, a surveyed slot inventory, privacy/security review and on-site operating procedures.

## What works in the browser demo

- Student / faculty / researcher onboarding with a sample student profile.
- Weekly timetable editor, CSV import and sample timetable.
- Timetable-linked booking windows; classes separated by up to three hours are grouped into one parking window.
- Zone selection, demo reservations, arrival/check-in, on-time checkout, simulated late checkout and cancellation.
- A 100-point demo wallet with 25-point hold, release and forfeiture ledger events.
- Operations overview, reservation audit and local demo reset.
- Sustainability page with editable assumptions for avoided distance, fuel and tailpipe CO₂.
- Responsive, route-split UI that uses system fonts and does not poll continuously or load map tiles.

Demo data is saved in the current browser's local storage. It is useful for presenting the user flow, but it is **not concurrency-safe** and is not a shared parking inventory.

## Run locally

Requirements: Node.js 20+ and npm.

    npm install
    cp .env.example .env.local
    npm run dev

Leave the Supabase variables empty to use demo mode. A sample student profile can be filled in from the setup page. The dummy email in that profile is only for the local demo and cannot receive OTP mail.

## Supabase setup

The repository includes a transactional SQL backend. Create a Supabase project under your account, then run the following files in order in the Supabase SQL Editor:

1. supabase/migrations/0001_initial_schema.sql
2. supabase/migrations/0002_transactional_booking.sql
3. supabase/migrations/0003_timetable_sync.sql
4. supabase/migrations/0004_zone_availability.sql
5. supabase/seed.sql (illustrative inventory only)

The migrations create profile, vehicle, timetable, zone, physical slot, reservation, wallet, credit-ledger and audit tables; apply RLS; and add database functions for the booking flow.

### Configure email verification

In Supabase Authentication, enable Email. The onboarding screen sends a one-time code and verifies it with verifyOtp. For a six-digit code, edit the Magic Link / OTP email template so it contains the variable {{ .Token }} and does not use {{ .ConfirmationURL }}. Supabase documents that {{ .Token }} sends a code, while {{ .ConfirmationURL }} sends a magic link:

- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-email-passwordless

The app checks the @srmist.edu.in domain for usability and Supabase Auth proves control of the email address. This alone does not establish student/faculty status; institutional eligibility must be approved and verified separately before production.

### Connect the deployed app

Set these environment variables in your local .env.local:

    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_LEGACY_ANON_KEY

Then add the same names as GitHub repository Actions secrets:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Push to main; the GitHub Actions workflow injects those build-time values and deploys to:

https://sanjay1712ksk.github.io/ParkSRM/

Only the public publishable/anon key belongs in the frontend. **Never** place a Supabase service-role key in Vite variables, GitHub Pages artifacts or client code.

### Transactional booking flow

When Supabase variables are configured:

1. A member verifies their SRM email with an email OTP and registers a vehicle.
2. The timetable editor sends the complete timetable to the replace_user_timetable RPC.
3. The availability RPC returns the number of compatible physical slots free for the selected date/time and vehicle type.
4. The create_parking_reservation RPC checks the timetable window, locks the wallet row, selects and locks a compatible physical slot, inserts the reservation, moves 25 credits from available to held, and writes the ledger/audit entries in one database transaction.
5. Idempotency keys prevent a retry from charging the same request twice. A Postgres exclusion constraint prevents overlapping reservations for the same physical slot.
6. Check-in, checkout and cancellation are database RPCs. Checkout releases the 25-point hold when within the 10-minute grace period; after the deadline, the hold is forfeited and a penalty record is created.
7. The expiry function handles abandoned reservations: un-arrived no-shows have the hold released; checked-in bookings left beyond grace are forfeited.

All reservation and credit mutations are performed in SQL SECURITY DEFINER functions with a fixed search path and execute permissions restricted to authenticated users (the expiry task is service-role only). Do not add client-side write policies for wallets, ledger entries or reservation state.

### Schedule expiry job

Enable the pg_cron extension in the Supabase dashboard, then schedule the expiry function as a database job. For example, in the SQL Editor (after verifying the extension schema in your project):

~~~sql
select cron.schedule(
  'parksrm-overdue-bookings',
  '* * * * *',
  $$select public.expire_overdue_parking_reservations();$$
);
~~~

The function processes a bounded batch and is safe to retry. Confirm the job owner/permissions and test with dummy users before enabling it on any real deployment.

### Important backend assumptions

- supabase/seed.sql creates 365 illustrative slot records, not an authoritative campus map. Replace them with a surveyed inventory before any live use.
- Time calculations are in Asia/Kolkata.
- Timetable-derived eligibility is a scheduling proxy; it does not prove class attendance.
- Check-in is currently an authenticated time-window action. A real deployment should bind check-in/out to a campus QR scanner, gate controller or validated sensor event.
- Admin role assignment, penalty appeals, notification delivery, sensor ingestion and an authorised credit policy are not implemented yet.
- The current browser cache stores profile and session state for convenience. Apply a privacy/retention policy before production use.

## Sustainable computing rationale

ParkSRM targets two different sources of impact:

**Physical mobility:** a timetable-aware reservation gives a driver a known zone before entering the campus. If this reduces repeated passes and idling while searching for a space, it can avoid fuel consumption. The impact estimator uses:

    avoided km = baseline search km − optimised search km
    fuel avoided (L) = avoided km ÷ vehicle efficiency (km/L)
    direct CO₂ avoided (kg) = fuel avoided × petrol factor (kg/L)

The default petrol factor is an approximate 2.31 kg CO₂/L reference; SEAI lists 2.311 kg CO₂/L for 100% petroleum petrol and states that it covers direct combustion CO₂, not upstream emissions. This may not match local blended petrol, so calibrate the factor and vehicle efficiency to the actual campus fleet. Source: https://www.seai.ie/data-and-insights/seai-statistics/conversion-factors. The calculator is a scenario model, not measured savings.

**Digital service:** pages are lazy-loaded, the interface uses local system fonts rather than downloading web fonts, no map tile engine or autoplay media is included, and the app does not run a polling loop. Supabase transactions are called when the user takes an action. This reduces avoidable downloads and repeated requests, but actual energy use still needs measurement.

For a faculty evaluation, see docs/FACULTY_DEMO.md.

## Mobile builds

Capacitor configuration is included. Native projects have not been generated or signed in this repository yet.

    npm run build
    npx cap add android
    npx cap sync android
    npx cap open android

Android requires Android Studio / Android SDK. iOS requires macOS and Xcode:

    npx cap add ios
    npx cap sync ios
    npx cap open ios

## Quality checks

    npm run typecheck
    npm test
    npm run build

## License

Educational prototype. Add an institution-approved license before public production distribution.
