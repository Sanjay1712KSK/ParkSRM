# ParkSRM — faculty demonstration guide

## 5-minute walkthrough

### 1. State the problem (30–45 seconds)
Drivers who do not know where parking is available may circulate around campus, queue or idle while searching. ParkSRM tests whether timetable-aware reservations and a clearer zone choice can reduce that avoidable movement. The sustainability benefit is a hypothesis to measure, not a guaranteed result.

### 2. Demonstrate the product flow (90 seconds)
- Open the deployed site and select **Fill sample student profile**.
- Use the **Find parking** page to select a zone and a timetable-linked date/window.
- Confirm the reservation. Explain that 25 demo credits are held, not deducted as money.
- Mark arrival, then complete an on-time checkout. Open the wallet to show the hold and release ledger entries.
- Demonstrate the late path only in local demo mode using **Simulate late**. Explain that the backend calculates lateness from the database clock; it does not trust a client-supplied late flag.
- Open the timetable page and import a CSV to show how eligibility changes.

### 3. Explain the transactional backend (60–75 seconds)
A booking is not a sequence of independent browser updates. The SQL function locks the member's wallet row and an available physical slot, checks schedule eligibility, creates the reservation, moves 25 points from available to held, and writes ledger/audit records inside one PostgreSQL transaction. Idempotency keys protect retries, and an exclusion constraint blocks overlapping reservations for the same slot. A concurrent request cannot spend the same credits or claim the same slot as if it were free.

### 4. Explain sustainable computing (60–75 seconds)
There are two intended levers:

**Mobility-side efficiency:** a driver gets a zone and timetable-compatible window before arrival, reducing the need for repeated search passes. If circulation distance falls, fuel use and direct tailpipe emissions can fall.

**Software-side efficiency:** routes are lazy-loaded; system fonts avoid third-party font downloads; no live map tiles, autoplay media, constant GPS/camera capture or continuous polling are used in the demo; backend work is event-driven when users book, check in or check out.

### 5. Show the impact estimator (45–60 seconds)
Open **Sustainability**. Adjust baseline distance, optimised distance, fuel efficiency and number of bookings. The displayed estimates use:

- Avoided distance = baseline search distance − optimised search distance
- Fuel avoided = avoided distance ÷ vehicle efficiency
- Direct CO₂ avoided = fuel avoided × 2.31 kg CO₂/L petrol

With the default assumptions (1.2 km baseline, 0.3 km optimised, 12 km/L, 100 bookings), the model estimates 90 km less driving, 7.5 L less petrol and about 17.3 kg less direct CO₂. These are illustrative scenario outputs, not SRM traffic measurements.

## How to defend the sustainability claims

Do not say "ParkSRM saves 17.3 kg CO₂ on campus" unless campus data verifies it. Say "under these assumptions, the model estimates 17.3 kg; the next step is a controlled before/after study."

A credible study should record:
1. Search distance / time and engine-idling time for a sample before and after introducing reservations.
2. Vehicle type and representative fuel efficiency, ideally from a survey rather than a single assumed number.
3. Number of completed reservations and the number of drivers who actually avoid an extra circulation loop.
4. Network requests, transferred bytes, JavaScript bundle size and client CPU time per completed booking.
5. Database request count, query latency and compute usage per booking.
6. For future sensors, duty cycle, sleep ratio, event payload size and radio transmission frequency.

Report both the functional result (successful booking / no duplicate slot) and sustainability result (measured distance, fuel, emissions, bytes and energy per completed booking). A smaller app does not automatically prove lower total energy use; compare measurements against a baseline.

## Assumptions and limitations to disclose

- Demo inventory is seeded and illustrative, not a surveyed SRM parking map.
- The browser-only demo uses local storage and is not concurrency-safe.
- Supabase mode requires a project, migrations, seed inventory, OTP email configuration and GitHub Actions secrets.
- The 2.31 kg CO₂/L petrol factor is a generic reference; SEAI lists 2.311 kg CO₂ per litre for 100% petroleum petrol and specifies that the factor covers direct combustion CO₂, not upstream emissions or lifecycle impact. It is not automatically representative of Indian blended petrol, so calibrate the factor for the campus fleet. Source: https://www.seai.ie/data-and-insights/seai-statistics/conversion-factors
- Real-world deployment needs SRM approval, privacy review, authoritative identity/role validation, a QR/gate/sensor check-in/out source and a formally approved credit policy.
