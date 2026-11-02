# ParkSRM — Product Requirements (MVP)

## Scope
SRMIST Kattankulathur campus pilot. Android, iOS and web clients share one backend.

## Identity
- Institutional email must end exactly in `@srmist.edu.in`.
- Email ownership verified by Supabase Auth.
- Roles: student, faculty, researcher.
- Student fields: batch, registration ID, department.
- Faculty fields: designation, department / school.
- Research fields: research centre, scholar / employee identifier where appropriate.
- Register vehicle number and vehicle class.

## Timetable
- Accept user-exported CSV in MVP; no Academia password collection.
- Validate weekdays and HH:MM time ranges.
- Support manual correction and review after import.
- Store day order / academic calendar mapping separately in a later release.
- A parking window begins at the first class start and ends at the last class end, merging intervening gaps up to a configurable 180-minute threshold. A day without classes does not automatically produce a parking window. This is an estimate based on declared sessions, not attendance evidence.

## Parking
- Discover active zones and vehicle-compatible spaces.
- A booking is distinct from check-in and checkout.
- 25 credits held at booking.
- 10-minute grace period after reservation end.
- Timely checkout releases hold; late checkout forfeits hold.
- All credit changes are append-only ledger entries and server-side atomic transactions.

## Production dependencies
- SRM approval for institutional identity, campus maps, parking capacity, penalty policy and Academia exports.
- Privacy and data retention review.
- Physical verification method (attendant QR, gate scanner, or sensors).
- Dispute and appeal process for penalties.
