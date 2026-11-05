# Supabase backend operations

ParkSRM's transactional backend is implemented as Postgres RPC functions in supabase/migrations rather than browser-side writes or unaudited Edge Function handlers.

| RPC | Purpose |
|---|---|
| replace_user_timetable(p_sessions) | Atomically replaces the signed-in user's timetable after validating every row |
| get_zone_availability(p_starts_at, p_ends_at, p_vehicle_type) | Returns capacity and available physical slots for a requested campus-time window |
| create_parking_reservation(...) | Checks timetable eligibility, locks the wallet and a free slot, writes reservation + 25-point hold + ledger + audit atomically |
| check_in_parking_reservation(p_reservation_id) | Records arrival within the permitted time window |
| checkout_parking_reservation(p_reservation_id) | Releases the hold on time or forfeits it after grace, idempotently |
| cancel_parking_reservation(p_reservation_id) | Cancels a future, not-yet-checked-in reservation and releases the hold |
| expire_overdue_parking_reservations() | Service-role scheduled expiry for no-shows and late checked-in sessions |

## Invariants

- Wallet mutations are performed under a row-level FOR UPDATE lock.
- A reservation selects and locks one compatible physical slot; a Postgres exclusion constraint prevents overlapping intervals on that slot.
- The wallet, reservation, credit ledger and audit write happen in one database transaction.
- Each create request has a per-user idempotency key. Checkout/cancel/expiry ledger writes have deterministic keys.
- Browser/mobile clients have no direct write policy for wallet balances, credit ledger, penalties or reservation status.
- All authenticated RPCs derive the member ID from auth.uid(); clients do not submit an arbitrary user ID.

## Operational setup

Apply migrations 0001–0004 in order, then run supabase/seed.sql for a non-production sample slot inventory. Enable Email OTP and configure the Magic Link / OTP template to use {{ .Token }}. Add the public Supabase project URL and publishable/anon key to local env and GitHub Actions secrets.

Enable pg_cron and schedule public.expire_overdue_parking_reservations() every minute only after testing its outcomes. The service-role key must remain server-side and must never be added to VITE_* variables.

## Production gaps

The current implementation is a backend-ready prototype. It still needs institutional identity verification/role administration, official zone inventory, QR or gate-backed physical check-in/out, a reviewed penalty/credit policy, dispute workflow, notifications, security testing and privacy/retention controls.
