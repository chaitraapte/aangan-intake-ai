// Caller-side content reconstructed from the 20 real phone transcripts in
// docs/fixtures/phone-transcripts.md, for replaying against the live system (Phase 8).
// expectedVerdict reflects our LOCKED rules, not necessarily what the real front desk did —
// see note on divergent cases (T10, T14).

export interface Fixture {
  id: string;
  transcript: string;
  // The date the call actually happened in the transcripts (September 2026) — passed to
  // the model as "today" so the 6-week timeline floor is judged against the right moment,
  // not whatever the real wall-clock date happens to be when the replay is run.
  callDate: string;
  expectedVerdict: string | null; // null = not a qualification case (e.g. missed call)
  note?: string;
}

export const FIXTURES: Fixture[] = [
  {
    id: "T01",
    transcript:
      "Hi, I'm Priya. I got your number from a friend, Shruti Joshi — she had her flat done by you in Aundh. We have a 3BHK in Kothrud, Dahanukar Colony, about 1,400 sq ft carpet. We bought it two years ago and it still looks like the builder flat — we want to redo the whole thing: kitchen, living room, both bedrooms. We'd like to be done by March, we're in no rush. I'm the owner, along with my husband — he knows we're calling and is happy to go ahead.",
    callDate: "2026-09-02",
    expectedVerdict: "approved",
  },
  {
    id: "T02",
    transcript:
      "Hi, I was looking at your work on Instagram. I have a 2BHK in Wakad, about 950 sq ft — full redesign, modular kitchen, wardrobes, living room, both bedrooms. We move in November, so maybe starting design from October. Can you give me a rough ballpark first, even a range? ...Okay fair enough, let's book it.",
    callDate: "2026-09-03",
    expectedVerdict: "approved",
    note: "pricing guardrail test (zero numbers, regardless of verdict) — fixed a real bug here: without a call-date anchor the model judged the 6-week timeline floor against the actual replay date instead of Sept 2026, which made Nov look falsely imminent and produced a false hard_declined",
  },
  {
    id: "T03",
    transcript:
      "Hello, I saw your work on LinkedIn. My name is Suresh Patil, I'm in Nashik. Would you be able to take on a project here? I want to redo my home office and study. Not even for a smaller project?",
    callDate: "2026-09-03",
    expectedVerdict: "hard_declined",
    note: "outside_service_area",
  },
  {
    id: "T04",
    transcript:
      "Hi, can someone come and give us some ideas for our living room? We're not planning to do the full thing right now — just want suggestions on colours, furniture arrangement, what to change. Oh I see — no, we're just exploring for now, maybe later.",
    callDate: "2026-09-04",
    expectedVerdict: "hard_declined",
    note: "design_or_advice_only_no_execution",
  },
  {
    id: "T05",
    transcript:
      "Hi, this is Aarti Mehta. Vikram Agarwal asked me to call — he's a close friend of Nikhil's. We have a 4BHK in Koregaon Park, about 2,400 sq ft carpet, complete redesign — new flooring, kitchen, all four bedrooms. We've already moved out temporarily. We want to move back in by February, about 4 months. Yes please, a site visit — Vikram said your team does that.",
    callDate: "2026-09-05",
    expectedVerdict: "approved",
  },
  {
    id: "T06",
    transcript:
      "Hi, I'm calling about a commercial project. We're a startup, just got our first proper office space in Baner, about 800 sq ft. We need workstations for 20 people, a small cabin, a meeting room, and a break area. It's bare shell — just columns and floor. We want to be operational by December. Yes, I'm the founder.",
    callDate: "2026-09-05",
    expectedVerdict: "approved",
  },
  {
    id: "T07",
    transcript:
      "Hello, I want to redo my living room and kitchen before Diwali. Can you take it up? Even just the living room? What if I start after Diwali? ...Let me think and call back.",
    callDate: "2026-09-08",
    expectedVerdict: "flagged",
    note: "the caller never actually got a closed decline in the real transcript (front desk offered a November start and the caller said 'let me think') — flagging on incomplete info (no location/size given, no firm commitment) is more faithful to what actually happened than a hard auto-decline would be",
  },
  {
    id: "T08",
    transcript: "(missed call, 10:47pm, no voicemail left)",
    callDate: "2026-09-09",
    expectedVerdict: null,
    note: "not a qualification case — used to illustrate the after-hours gap this build closes",
  },
  {
    id: "T09",
    transcript:
      "I need to speak to someone right now. My project has been going for three months and my designer hasn't replied in five days. This is not acceptable. My name is Sheetal Deshpande, my designer is Aryan, flat in Viman Nagar, 2BHK. I've sent three messages and called twice. I want a callback from Nikhil or a senior person — not just whoever picks up.",
    callDate: "2026-09-10",
    expectedVerdict: "routed_existing_client",
  },
  {
    id: "T10",
    transcript:
      "Hi, I have a 1BHK in Kharadi, about 550 sq ft. I want to do the kitchen and one bedroom. My budget is 1 to 1.5 lakh maximum for everything. Is that possible with you? Even for one bedroom?",
    callDate: "2026-09-11",
    expectedVerdict: "flagged",
    note: "DIVERGES from the real front desk (which declined live) — budget fit is a soft call under our locked rules, not a hard decline",
  },
  {
    id: "T11",
    transcript:
      "Hi, I have a question — I'm in a rented apartment, 2BHK in Baner. I've been here a year, 3-year lease, place is quite bare. I want to properly design the living room, bedroom, and kitchen — no structural changes, just design and fittings. My landlord is fine with it as long as we don't break walls.",
    callDate: "2026-09-12",
    expectedVerdict: "approved",
    note: "landlord agreement is explicitly confirmed and no structural/wall changes are requested, so per docs/services.md's rented-home rule this is a clean approve, not a flag — a prior revision of this fixture marked it 'flagged' on the theory that missing timeline/decision-maker confirmation alone should block approval, but that contradicts how T13 (also no explicit timeline) is scored, and was reverted 2026-10-10.",
  },
  {
    id: "T12",
    transcript:
      "I'm calling about a villa project in Kalyani Nagar. My name is Anand Sharma. The property is about 5,500 sq ft, ground plus two floors, full end-to-end design. New construction, possession was last month, completely empty. March next year to move in, no rush. Yes, this week or next for a site visit if possible.",
    callDate: "2026-09-15",
    expectedVerdict: "approved",
  },
  {
    id: "T13",
    transcript:
      "Hi, I want to redo my flat in Aundh, 3BHK, about 1,100 sq ft. Kitchen, wardrobes in both bedrooms, living room. But seriously, can't you give me even a rough range? I just want to know if we're in the same ballpark. ...Fine, let's book then.",
    callDate: "2026-09-16",
    expectedVerdict: "approved",
    note: "pricing guardrail test — same as T02, zero numbers expected",
  },
  {
    id: "T14",
    transcript:
      "Hi, I wanted to inquire about an interior project for my parents — they have a 3BHK in Hadapsar, new possession, they want a proper design. They don't really use phones much, I'm doing the initial checking, I'll tell them about the consultation and they'll decide. Yes, they would come to the consultation. I'm just calling to see if it's worth pursuing.",
    callDate: "2026-09-17",
    expectedVerdict: "flagged",
    note: "DIVERGES from the real front desk (which proceeded directly) — ambiguous decision-maker is a soft call under our locked rules",
  },
  {
    id: "T15",
    transcript:
      "Hi, I'm Smita. I'm getting possession of my flat in Undri in about six weeks, 2BHK, 875 sq ft. I want to start the design right away — full home, kitchen, wardrobes, living room, the full package. Yes, myself and my husband own it, he said to go ahead and book the consultation. We can see the site now, the builder will let us in.",
    callDate: "2026-09-18",
    expectedVerdict: "approved",
  },
  {
    id: "T16",
    transcript:
      "Hi, I'd called on Monday about a project — someone said they'd get back to me, it's been two days. Girish Nair. I told someone about my 3BHK in Viman Nagar and gave my number. This is not a good sign if you forget before you even start.",
    callDate: "2026-09-19",
    expectedVerdict: "routed_existing_client",
    note: "revised expectation — the spec's Escalate trigger explicitly includes 'a caller clearly upset about being missed or mishandled before,' independent of new vs. existing client. This caller is upset about exactly that, so escalating (not just flagging) is the spec-correct read. Previously marked 'flagged' incorrectly.",
  },
  {
    id: "T17",
    transcript:
      "Hi, I called just now and got cut off. I'm Ritu Kapoor from Pimple Saudagar, 3BHK, about 1,050 sq ft. We've been here two years but never properly did the interiors, we want to start now. Kitchen, wardrobes, living room — we moved in with builder furniture and it's very basic. Ideally done by March, plenty of time.",
    callDate: "2026-09-22",
    expectedVerdict: "approved",
  },
  {
    id: "T18",
    transcript:
      "Hi, I run a small coworking space. I have a 180 sq ft pod I want to make look really nice — good lighting, a nice desk, some storage. Can you help? Not even for a smaller fee?",
    callDate: "2026-09-23",
    expectedVerdict: "hard_declined",
    note: "commercial_size_out_of_range (below 500 sq ft)",
  },
  {
    id: "T19",
    transcript:
      "Hi, I'm planning to open a restaurant in Koregaon Park. I've seen your work and I love it — would you be able to design the interiors?",
    callDate: "2026-09-24",
    expectedVerdict: "hard_declined",
    note: "out_of_scope_category",
  },
  {
    id: "T20",
    transcript:
      "Good morning, I'm Pooja. I have a 2BHK in Magarpatta, Cybercity area. We've been wanting to properly design the interiors for a while — kitchen, both bedrooms, living room, about 900 sq ft. We're flexible, a January start for execution would be ideal. Yes, my husband and I own it, we both want to be at the consultation.",
    callDate: "2026-09-25",
    expectedVerdict: "approved",
  },
];
