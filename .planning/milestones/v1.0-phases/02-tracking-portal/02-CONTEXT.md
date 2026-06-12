# Phase 2: Tracking Portal - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The customer-facing, mobile-first web portal where a customer enters a tracking number + delivery postcode and sees their delivery status, ETA, milestone progress, event history, and vehicle/route info — with every error state handled distinctly. All delivery data comes from the Phase 1 tracking service (`lookupConsignment`); this phase is the presentation and interaction layer on top of that working engine.

**In scope:** PORT-01..08 (lookup form, status/timeline/ETA display, time window, event history, distinct error states incl. multiple-match chooser, mobile-first responsive, vehicle/route details, share/print via signed link).

**Out of scope:** the voice agent (Phase 4), the admin dashboard (Phase 3), live Pall-Ex credentials (still MSW mock), proactive notifications (v2).

</domain>

<decisions>
## Implementation Decisions

### Brand & Visual Style
- **D-01:** Clean, neutral base (whites/greys, professional courier-tracking aesthetic) with a **single accent colour** used for primary buttons, the active milestone step, and key highlights. Not a full brand kit.
- **D-02:** Accent colour defaults to a professional blue (**Tailwind `blue-600` / `#2563eb`**) as a placeholder. This is trivially swappable for a real Derby Aggs brand hex up to build time — implement the accent as a single theme token (CSS variable / Tailwind theme colour), not hardcoded throughout.
- **D-03:** No logo asset committed yet — use a simple text title/wordmark ("Derby Aggs — Track your delivery" or similar) until a logo file is provided. Leave a clear, single place to drop a logo in later.

### Landing & Lookup Form
- **D-04:** First screen is a **bare, focused form** — tracking number field, postcode field, and a clear "Track delivery" primary button, with a small title/wordmark. No marketing/landing chrome. This is a utility; get the customer to their answer fastest.
- **D-05:** Submission is **POST / server action** — tracking data never appears in the URL (PORT-01). Result is rendered server-side from the Phase 1 `lookupConsignment` call.
- **D-06:** Light inline field guidance is acceptable (e.g. a small hint that the postcode is the *delivery* postcode), but keep it minimal — not a separate help section.

### Result Layout & Errors
- **D-07:** Above the fold on a 375px viewport: current **status + plain-language description + ETA**, then the **milestone timeline**. Event/scan history and vehicle/route details sit below the fold (PORT-02, PORT-06).
- **D-08:** Delivery **time window** ("between 09:00 and 11:00") shown prominently when the consignment is out for delivery (PORT-03).
- **D-09:** Full **event/scan history in reverse-chronological order** below the timeline (PORT-04). Vehicle/route details (reg number, route status) shown when the API provides them (PORT-07).
- **D-10:** **Multiple matches → list with safe distinguishing detail.** Show a short chooser listing each candidate with non-sensitive details (destination town + current status) so the customer can confidently pick. Postcode is already verified by the backend gate, so this discloses nothing the customer didn't already supply.
- **D-11:** **Each error state is distinct and helpful** (not found, postcode mismatch, multiple matches, API unavailable) — specific message per case (PORT-05). On "not found" and "system unavailable", show a **"Call us" contact link/number + a retry option** so the customer is never at a dead end. The contact phone number is a **config placeholder** until the Phase 4 voice line provides the real UK number — wire it as a single config value, not hardcoded.
- **D-12:** **Share/print via a short-lived signed link** that does NOT expose the postcode or any sensitive lookup input (PORT-08). The signed token encodes the consignment identity + an expiry; opening it re-fetches and renders the status read-only. A print-friendly stylesheet for the status page.

### Claude's Discretion
- **Milestone timeline presentation** (not selected for discussion): use a **compact horizontal 5-step stepper** (Booked → At hub → On its way → Out for delivery → Delivered) above the fold, with the active/completed steps in the accent colour; the detailed event history renders as a **vertical list** below. Standard courier-tracking pattern, fits 375px.
- Loading/skeleton states, exact spacing/typography scale, component breakdown, form validation micro-copy — Claude's discretion within the decisions above.
- Exact signed-link token mechanism (HMAC vs signed JWT vs Supabase-stored token) — research/planning decision; must meet "no postcode exposed + short-lived" (D-12).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PORT-01..08 (the locked requirement set for this phase) and the success criteria.
- `.planning/ROADMAP.md` §"Phase 2: Tracking Portal" — goal + 5 success criteria.

### Research (project)
- `.planning/research/ARCHITECTURE.md` — data model and how the portal layer sits over the Nexus client + tracking service.
- `.planning/research/PITFALLS.md` — known traps (status mapping, postcode normalisation, PII handling, instrumentation).
- `.planning/research/STACK.md` — Next.js App Router conventions, Supabase, supporting libraries.

### Phase 1 outputs this phase builds on
- `.planning/phases/01-foundation/01-04-SUMMARY.md` — the tracking service surface (`lookupConsignment` and the `TrackingResult` shape) the portal renders.
- `.planning/phases/01-foundation/01-02-SUMMARY.md` — the Nexus client + MSW mock the portal runs against (still mock mode).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/tracking/service.ts`** — `lookupConsignment` is the single data source for the portal. It already does search, postcode gate, status→milestone mapping, and outcome logging. The portal calls this; it does not re-implement any lookup logic.
- **`src/types/tracking.ts`** — `MilestoneStage`, `MILESTONE_ORDER` (booked→at_hub→in_transit→out_for_delivery→delivered), and the `TrackingResult` discriminated union (success vs `not_found | postcode_mismatch | multiple_matches | api_error`). The UI renders directly off these types — error states map 1:1 to D-11.
- **`src/lib/tracking/status-map.ts`** — already yields `plainStatus`, `description`, and `stage` for display.
- **`src/types/consignment.ts`** — raw Nexus fields (delivery address town, time window, route details) for the result page.

### Established Patterns
- Next.js 16 App Router, `src/` dir, TypeScript, **Tailwind CSS** already configured (`src/app/globals.css`, `layout.tsx`).
- `src/app/page.tsx` is still the create-next-app scaffold — replace it with the lookup form (D-04). This was flagged in the Phase 1 code review (IN-01).
- Server-side data access is the norm (the Supabase/Nexus clients are server-only) — favour Server Components + a server action / route handler for the POST lookup (D-05).

### Integration Points
- New: a lookup route/server action that calls `lookupConsignment`; the result page; a signed-link route for share/print (D-12); a single theme token for the accent colour (D-02) and a single config value for the contact number (D-11).
- **21st.dev Magic MCP** is installed (user's preferred UI component builder) and can be used to scaffold the form, timeline, and result components — note its API key is still a placeholder, so confirm availability before relying on it.

</code_context>

<specifics>
## Specific Ideas

- The portal should feel like a focused utility, not a marketing site — minimum distance between "I have a tracking number" and "here's where my delivery is".
- Accent colour as a single swappable token so a Derby Aggs brand colour can drop in later without a restyle.
- Customers are never left at a dead end — errors always offer a next action (retry and/or call us).

</specifics>

<deferred>
## Deferred Ideas

- Full Derby Aggs brand kit (logo file, full palette) — fold in when assets are provided; D-02/D-03 leave clean seams for it.
- Real customer-facing contact phone number — arrives with the Phase 4 Twilio UK line; D-11 wires a placeholder now.
- Proactive notifications (SMS/email) — explicitly v2, out of scope.

None of the above changes Phase 2 scope.

</deferred>

---

*Phase: 02-tracking-portal*
*Context gathered: 2026-06-12*
