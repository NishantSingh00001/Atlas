# Security Review — Atlas

Code-grounded review against the standard 20-point pen-test checklist. Atlas is a static
client-side app (3D globe, trip planner, local tools) backed by one Vercel serverless function
(`api/plan.js`, a server-side Gemini proxy) and an optional, user-connected Supabase project for
cloud backup (BYO URL + anon key, stored only in `localStorage`).

| # | Check | Result |
|---|-------|--------|
| 1 | HTTP/2 Rapid Reset (CVE-2023-44487) | N/A — Vercel-managed edge/runtime, no custom HTTP/2 server |
| 2 | bcrypt 72-byte truncation | N/A — no password hashing in this app; auth passwords go straight to Supabase's own GoTrue endpoint over HTTPS |
| 3 | SAML signature bypass (CVE-2024-45409) | N/A — no SAML/SSO |
| 4 | nOAuth | N/A — no OAuth sign-in |
| 5 | GraphQL alias batching | N/A — no GraphQL |
| 6 | TOTP replay (RFC 6238 §5.2) | N/A — no TOTP/2FA |
| 7 | ReDoS | No — regexes used (`esc()`'s `/[&<>]/g`, the Supabase URL validator `/^https:\/\/[\w-]+\.supabase\.co$/`, the UUID check) are all linear, no nested quantifiers |
| 8 | JWT algorithm confusion | N/A — the app never verifies JWTs itself; Supabase's access token is only ever sent back to Supabase, which verifies it server-side |
| 9 | HTTP request smuggling | N/A — `api/plan.js` is a standard Vercel function handler, no raw socket/header parsing |
| 10 | Web cache poisoning | No — `api/plan.js` sets `cache-control: no-store` on every response (`api/plan.js:1`) |
| 11 | Spoofed X-Forwarded-For | **Finding** — see below |
| 12 | Postgres views bypassing RLS | No — `supabase/schema.sql` enables RLS on `atlas_trips` and scopes all four policies (select/insert/update/delete) to `auth.uid() = user_id`; no views are defined |
| 13 | `Math.random()` for security tokens | No — the only `Math.random`-equivalent use is a seeded deterministic PRNG for the star field (`index.html:178`, not even real `Math.random`); real IDs use `crypto.randomUUID()` (`assets/app.js:276`, `index.html:260` area via `crypto.randomUUID?.()`) |
| 14 | Timing attacks on secret comparison | N/A — no secret comparisons in app code; password/token checks happen inside Supabase/Google's own services |
| 15 | Padding oracle | N/A — no custom encryption |
| 16 | Server-side prototype pollution | No — `api/plan.js` only reads `input.prompt` as a string and never spreads/merges the parsed JSON body into another object |
| 17 | Server-side template injection | N/A — no server-side templating; the Gemini prompt is a plain string sent to an external LLM API, not evaluated as a template on the server |
| 18 | XXE | N/A — no XML parsing anywhere |
| 19 | Cross-site WebSocket hijacking | N/A — no WebSocket use |
| 20 | Unicode username normalization | N/A — Atlas has no username system of its own; Supabase auth uses email/password, normalized by Supabase itself |

## Findings outside the 20-point list

1. **Spoofable `X-Forwarded-For` lets a client bypass the AI-planner rate limit (checklist #11).**
   `api/plan.js:16` reads the client's own `x-forwarded-for` header and takes the **first**
   comma-separated value (`request.headers.get('x-forwarded-for')?.split(',')[0]`) as the bucketing
   key for the 20-requests-per-10-minutes burst guard (`api/plan.js:17-19`). The first entry in an
   `X-Forwarded-For` chain is conventionally the value the *client itself* supplied (or the first
   proxy it passed through), not the trusted value the platform's own edge appends at the end — so
   a caller can send an arbitrary, different `X-Forwarded-For` value on every request to get a
   fresh bucket each time, fully bypassing the per-network throttle and running up calls (and
   Gemini API cost) against the shared `GEMINI_API_KEY`. Impact is capped by Gemini's own account-
   level quota, and the function already caps prompt length to 12,000 chars (`api/plan.js:13`), but
   the intended per-network limit itself doesn't hold against a deliberate caller. Not fixed —
   suggested approach (pending your approval): use the last entry in the `x-forwarded-for` chain,
   or Vercel's own client-IP header, instead of the first.

Nothing else outside the list: the Gemini response is only ever parsed as JSON and every field
from it (`city`, `summary`, day `title`, stop `time`/`name`/`desc`) is passed through `esc()`
(`index.html:226`, full `&<>` escaping) before being written into `innerHTML` in `render()`
(`index.html:245-259`) — so even an adversarial or prompt-injected model response can't inject
markup; the one place a raw string reaches an attribute (the Google Maps search link, built from
`s.name`/`t.city`) uses `encodeURIComponent`, not string concatenation. The packing-list custom
item added via `prompt()` strips `<`/`>` before insertion (`assets/app.js:246`) and user-saved
custom items are never re-rendered from `innerHTML` templates on reload (only the hardcoded
`BASE_PACKING`/vibe-tip arrays are). The Supabase RLS policies correctly scope every operation to
the signed-in user, and the README already warns against ever using a service-role key client-side
(confirmed: `SERVICE_ROLE`/`service_role` does not appear anywhere in the repo). The private
`GEMINI_API_KEY` is read only from `process.env` in the server function and never appears in any
client-side file. No pinned-CDN concerns — `three.min.js` is vendored locally, zero npm
dependencies (`package.json`).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RCiZNqYmetGt5SuieaZQcC
