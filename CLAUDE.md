@AGENTS.md

# Gemini API convention

Read `GEMINI_API_KEY` from `process.env` only — never hardcode it, never log it, never pass
it to client-side code. All Gemini calls go through a single server-side module
(`src/lib/gemini.ts`), not scattered `fetch` calls elsewhere in the codebase. This key is a
shared hackathon credential — if it starts returning 401/403/429, it was likely rate-limited
or revoked; don't fall back to hardcoding a replacement, flag it instead.

