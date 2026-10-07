# Phone transcripts — September 2026 (test fixtures for Phase 8 replay)

Source: `Aangan_Sep 2026_Enquiries.pdf`, Section 1 — Phone Calls. Used to validate that the
AI's verdicts (approve / hard-decline / flag / route-existing-client) match what the real
front desk actually did, and that no pricing number is ever produced.

Front desk handles calls 10am–7pm; calls outside those hours go unanswered today (the gap
this build closes).

---

T01 · 2 Sept · 10:23am — Priya, 3BHK Kothrud, 1,400 sq ft, full redesign, March timeline,
owner. **Expected: approved.**

T02 · 3 Sept · 2:41pm — 2BHK Wakad, 950 sq ft, full redesign, Oct start. Caller pushes twice
for a rough price range; front desk holds the line both times. **Expected: approved, zero
price given.**

T03 · 3 Sept · 4:15pm — Suresh Patil, Nashik, home office/study. **Expected: hard_declined
(outside service area).**

T04 · 4 Sept · 11:07am — Living room ideas only, no execution, "just exploring." **Expected:
hard_declined (design-only / advisory, no execution).**

T05 · 5 Sept · 10:52am — Aarti Mehta, referred by Vikram Agarwal (Nikhil's friend), 4BHK
Koregaon Park, 2,400 sq ft, 4-month timeline, site-visit consultation. **Expected:
approved.**

T06 · 5 Sept · 3:28pm — Startup founder, Baner, 800 sq ft commercial, bare shell, workstations
for 20, December deadline. **Expected: approved.**

T07 · 8 Sept · 9:44am — Living room + kitchen before Diwali (~3 weeks out). Front desk
explains 8–10 week minimum; caller says "let me think." **Expected: hard_declined (timeline
infeasible), or flagged if treated as still-undecided rather than a closed no.**

T08 · 9 Sept · 10:47pm — Missed call, no voicemail, failed next-morning callback. **Expected:
this is exactly the after-hours gap the AI answering live is meant to close — no verdict,
used to demonstrate response-time improvement instead.**

T09 · 10 Sept · 11:32am — Existing client (Sheetal Deshpande) escalating an unresponsive
designer. **Expected: routed_existing_client — not run through qualification logic at all.**

T10 · 11 Sept · 2:04pm — 1BHK Kharadi, 550 sq ft, kitchen + bedroom, budget ₹1–1.5L max.
Front desk declines on budget mismatch. **Expected: flagged (soft/budget judgment call, not
auto-declined) per the locked decision that budget-fit is a human call.**

T11 · 12 Sept · 10:18am — Rented 2BHK Baner, no structural changes, landlord approved.
**Expected: approved.**

T12 · 15 Sept · 10:05am — Anand Sharma, villa Kalyani Nagar, 5,500 sq ft, new construction,
no rush. **Expected: approved.**

T13 · 16 Sept · 12:19pm — 3BHK Aundh, 1,100 sq ft. Caller pushes for "even a rough range";
front desk holds the line. **Expected: approved, zero price given.**

T14 · 17 Sept · 11:41am — Caller enquiring on behalf of parents (3BHK Hadapsar), parents will
attend consultation. **Expected: flagged (ambiguous decision-maker situation is a soft call
per the rubric) — though the front desk proceeded directly in practice, worth testing both
ways.**

T15 · 18 Sept · 3:12pm — Smita, 2BHK Undri, 875 sq ft, possession in 6 weeks, owner + husband
agreed. **Expected: approved.**

T16 · 19 Sept · 10:38am — Girish Nair, follow-up on a lost Monday enquiry, frustrated.
**Expected: approved (3BHK Viman Nagar once re-logged) — also a test case for "re-logging a
dropped enquiry" rather than treating it as new.**

T17 · 22 Sept · 2:14–2:16pm — Ritu Kapoor, 3BHK Pimple Saudagar, 1,050 sq ft, March timeline.
**Expected: approved.**

T18 · 23 Sept · 11:55am — Coworking pod, 180 sq ft. **Expected: hard_declined (below minimum
commercial size).**

T19 · 24 Sept · 4:02pm — Restaurant interiors, Koregaon Park. **Expected: hard_declined
(out-of-scope category — hospitality).**

T20 · 25 Sept · 9:15am — Pooja, 2BHK Magarpatta, 900 sq ft, January start, both owners
attending. **Expected: approved.**
