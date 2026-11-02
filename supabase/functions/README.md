# Required trusted backend operations

Implement these as Supabase Edge Functions or carefully audited `SECURITY DEFINER` database functions before production:

- `create-reservation`: validate JWT, profile, vehicle, timetable-derived eligibility, active zone/slot, capacity, credit balance; lock wallet row (`FOR UPDATE`); enforce 25-credit hold; enforce idempotency key; create reservation and ledger entry in one transaction.
- `check-in`: verify QR/pass, reservation ownership and active status; record physical entry.
- `checkout`: verify physical exit signal; lock reservation and wallet; if timestamp <= grace_ends_at, release held credits; otherwise forfeit held credits and create a penalty record; all changes atomic and idempotent.
- `cancel-reservation`: apply cancellation cutoff and release hold atomically.
- `expire-reservations`: scheduled job to flag overdue sessions and notify users. Do not rely on a mobile app timer.
- `admin-adjustment`: require admin role, reason, audit event and ledger entry.

Never put the Supabase service-role key in a browser or mobile app. A public anon key is safe only with correct RLS. A client-side domain check is not institutional verification.
