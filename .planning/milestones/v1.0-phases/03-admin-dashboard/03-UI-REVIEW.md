---
phase: 3
slug: admin-dashboard
status: reviewed
audited: 2026-06-12
baseline: 03-UI-SPEC.md
screenshots: not captured (no dev server)
scores:
  copywriting: 3
  visuals: 3
  color: 4
  typography: 3
  spacing: 4
  experience_design: 3
  overall: 20
---

# Phase 3 — UI Review: Admin Dashboard

**Audited:** 2026-06-12
**Baseline:** 03-UI-SPEC.md (approved design contract)
**Screenshots:** Not captured — no dev server detected at localhost:3000 or localhost:5173. Audit is code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 4 deviations from the copy contract; all are minor wording variants |
| 2. Visuals | 3/4 | Metrics empty state lacks a heading; transcript section heading undersized relative to spec |
| 3. Color | 4/4 | Accent correctly scoped; semantic badge colours honoured throughout |
| 4. Typography | 3/4 | text-base and text-lg appear as undeclared fifth/sixth sizes; font-normal body weight absent |
| 5. Spacing | 4/4 | All values on the 4px scale; arbitrary values are only spec-permitted touch-target exceptions |
| 6. Experience Design | 3/4 | No loading.tsx / error.tsx / Suspense in any dashboard route; skeleton loaders not implemented |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Missing skeleton loaders and error boundaries** — Users see a blank or crashed page during slow data fetches and on server errors. Add `loading.tsx` (with `animate-pulse` shimmer cards matching MetricCard / CallHistoryTable / DriverList dimensions) and `error.tsx` (copy from spec: "Something went wrong" / "We couldn't load this page. Please try refreshing.") to `src/app/dashboard/`, `src/app/dashboard/calls/`, and `src/app/dashboard/drivers/`. Wrap PeriodTabs in a `<Suspense>` boundary (it uses `useSearchParams` and needs an explicit fallback per Next.js 15+ rules).

2. **Undeclared type-scale sizes (text-base, text-lg)** — The spec declares exactly 4 sizes: text-sm, text-xl, text-2xl, text-3xl. text-base (16px) appears in 6 places (input fields, mobile top-bar wordmark, empty-state headings) and text-lg appears in DeleteConfirmDialog's title. These introduce two undeclared sizes, breaching the 4-size contract. Fixes: (a) change input `text-base` to `text-sm` — inputs at 14px are legible and match spec; (b) change DeleteConfirmDialog `text-lg` title to `text-xl` to match the "modal title = text-xl" rule from the spec; (c) change the mobile top-bar wordmark from `text-base` to `text-sm font-semibold` (nav-link weight) or `text-xl` if it is meant as the brand display.

3. **Metrics empty state missing the "No data yet" heading** — The spec defines a two-part empty state: heading "No data yet" + body paragraph. The implementation renders only the body paragraph with no heading, making the empty state visually identical to a generic note. Add `<p className="text-base font-semibold text-zinc-900 mb-2">No data yet</p>` above the existing paragraph in `src/app/dashboard/page.tsx` (lines 31–34), mirroring the pattern used in CallHistoryTable and DriverList.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Contract honoured:**
- Login: heading "Derby Aggs — Staff login", label "Password", CTA "Sign in", error role="alert" — all exact.
- Call History: search placeholder "Search tracking reference…", empty state (no calls) "No calls recorded yet. Voice agent data will appear here after Phase 4.", filters-active empty state "No calls match your filters. Try adjusting the date range or outcome." — all exact.
- Drivers: heading "Drivers", "Add driver", "Edit", "Deactivate"/"Activate", "Delete", empty heading "No drivers yet", empty body exact, modal titles "Add driver"/"Edit driver", field labels "Full name"/"Phone number", hint text, "Save driver", "Discard changes", "Delete [name]?", delete body exact, "Delete driver", "Keep driver", all toast messages — all exact.
- Call detail back link: "← Back to call history" — exact (spec: "Back to call history"; implementation includes the arrow prefix which is a welcome addition).
- RecordingPlayer unavailable: "Recording not yet available. Recordings are stored for 30 days after a call." — exact.
- TranscriptView empty: "Transcript not available for this call." — exact.
- DriverCallSubLog empty: "No outbound calls were made for this call." — exact.

**Deviations:**

1. **Metrics empty state heading missing** — `src/app/dashboard/page.tsx:31–34`. Spec requires heading "No data yet" above the body paragraph. Implementation renders only the body. Missing the heading tier.

2. **Metrics empty state body wording** — Spec: "Metrics will appear here once the voice agent is live and receiving calls." Implementation at line 32 is: "Metrics will appear here once the voice agent is live and receiving calls." — this is actually an exact match. No deviation here (false alarm from initial scan).

3. **Back link arrow prefix** — Spec: "Back to call history". Implementation: "← Back to call history". This is an improvement over the spec (provides visual affordance). Not a regression.

4. **AdminShell logout button label** — `src/components/admin/AdminShell.tsx:64`. Label is "Log out" (two words). No logout copy was declared in the copy contract; this is an undeclared element, not a contract deviation. Minor: consider adding "Log out" to the copy contract in a future spec revision.

5. **Call History page heading** — `src/app/dashboard/calls/page.tsx:66`. "Call history" (lowercase h). Spec: "Call history" — exact match. No deviation.

6. **DriverCallSubLog heading** — `src/components/admin/DriverCallSubLog.tsx:49`. Text is "Outbound driver calls (N)". Spec: "Outbound driver calls" as heading + N in parentheses. Implementation is consistent with spec intent.

**Net: 1 genuine deviation** (missing Metrics empty heading).

---

### Pillar 2: Visuals (3/4)

**Contract honoured:**
- AdminShell sidebar: 240px (w-60 = 240px), persistent at lg, off-canvas drawer below — correct.
- Mobile top bar: hamburger (44×44px min touch target), page wordmark, logout form present — correct.
- MetricCard: border-zinc-200, rounded-xl, p-6, value text-3xl, label text-sm — matches spec.
- PeriodTabs: border-b border-zinc-200, active state text-accent border-b-2 border-accent — correct.
- CallHistoryTable: desktop table hidden on mobile, mobile cards at md breakpoint — correct.
- DriverList: desktop table, mobile cards, action hierarchy (Edit / Deactivate / Delete) — correct.
- Dialogs: centered overlay, max-w-sm, rounded-xl, shadow-lg, p-6, backdrop bg-black/40 — correct.
- Toast: fixed bottom-4 left-1/2 -translate-x-1/2, rounded-full, auto-dismiss 3s — correct.

**Deviations:**

1. **TranscriptView section heading is text-sm, not text-xl** — `src/components/admin/TranscriptView.tsx:32`. The heading "Transcript" uses `text-sm font-semibold text-zinc-700`. The spec describes section headings within the call detail view as part of the "Heading" role (text-xl). RecordingPlayer uses the same pattern (`text-sm font-semibold text-zinc-700` for "Call recording"). This creates a visual hierarchy where Transcript and Call recording labels look identical to table column headers rather than section dividers. Fix: promote both to `text-xl font-semibold text-zinc-900` or add a deliberate divider line.

2. **Metrics empty state lacks visual anchor** — No heading before the body paragraph means the empty state has no focal point. Low severity but visible on first deploy before voice agent data exists.

3. **DeleteConfirmDialog button layout** — Implementation uses `flex-col gap-3 sm:flex-row-reverse` which puts Delete above Keep on mobile. Spec shows "Keep driver" + "Delete driver" as a side-by-side pair without specifying order. The reverse order (Delete first on mobile) is a defensible safe-default pattern. Not a contract breach, but worth a manual review since "Keep" focusing by default is safer UX.

---

### Pillar 3: Color (4/4)

**Contract honoured across all elements:**

- Accent used only on: Login CTA (`bg-accent`), active nav link (`text-accent border-accent`), Period tab active state (`text-accent border-accent`), "Add driver" / "Save driver" CTAs (`bg-accent`), Edit row actions (`text-accent`), active filter chips (`bg-accent/10 text-accent`), View links (`text-accent`), Back to call history link (`text-accent`). All are in the reserved list.
- Accent NOT used for: table row hover (zinc-50/zinc-100 used), outcome badges (semantic green/amber/zinc used), sidebar background (bg-background used). All exclusions respected.
- Outcome badges: resolved = green-100/green-600, no_data/missed = amber-100/amber-600, escalated/failed = zinc-100/zinc-600. Matches spec exactly. Consistent across CallHistoryTable, CallDetail, DriverCallSubLog.
- Status badges (DriverList): Active = green-100/green-600, Inactive = zinc-100/zinc-500. Matches spec.
- Destructive: Delete buttons text-red-600, Delete confirm CTA bg-red-600. Deactivate uses text-zinc-600. Spec-compliant separation of reversible vs irreversible actions.
- No hardcoded hex or rgb() values found anywhere in admin code.
- Error toast uses bg-red-600 text-white. Default toast uses bg-zinc-900 text-white. Matches spec.
- Metric card background: bg-background (not bg-zinc-50 as spec says for cards). Minor variance; bg-background is white in light mode which is equivalent, and CallDetail uses bg-zinc-50. Low impact.

---

### Pillar 4: Typography (3/4)

**Contract declared:** 4 sizes (text-sm, text-xl, text-2xl, text-3xl), 2 weights (font-normal 400 + font-semibold 600). Secondary roles use colour and font-mono for distinction at the same size.

**Undeclared sizes found:**

1. **text-base (16px)** — appears in 6 locations:
   - `LoginForm.tsx:25` — password input field text size
   - `AdminShell.tsx:122` — mobile top-bar wordmark ("Derby Aggs")
   - `DriverModal.tsx:132` — name input field text size
   - `DriverModal.tsx:155` — phone input field text size
   - `DriverList.tsx:78` — empty-state heading "No drivers yet"
   - `CallHistoryTable.tsx:60` — empty-state heading "No calls found"
   Input fields using text-base is a common pattern for legibility, but it adds a 5th undeclared type size. The empty-state headings should be text-sm font-semibold per the spec's body/label role equivalence.

2. **text-lg (18px)** — appears in 1 location:
   - `DeleteConfirmDialog.tsx:54` — dialog title "Delete [name]?"
   Spec declares modal titles as text-xl. This is a one-step-down deviation.

**Weight compliance:**
Only `font-semibold` is found in a grep across all admin files. `font-normal` (the declared body weight) is never explicitly applied — body text relies on the browser default weight (400), which is functionally correct but means the weight system is effectively 1 explicit weight (semibold) rather than the declared 2. This is a documentation gap rather than a visual issue.

**Monospace compliance:**
font-mono applied consistently to: date/time cells, tracking refs, phone numbers, timestamps in transcripts. Correct.

**Colour-differentiated roles (text-zinc-400, text-zinc-500) used appropriately:**
- text-zinc-500: helper text, metric labels, empty state body — correct
- text-zinc-400: pagination count, timestamp in transcripts — correct

---

### Pillar 5: Spacing (4/4)

**Scale compliance:**
All spacing values found in the grep (px-4, py-3, py-2, px-3, px-2, py-1, px-5, gap-4, gap-2, gap-1, p-6, p-4, gap-3, py-6, py-4, px-6, mx-4, py-8, py-16, py-12, px-8, p-8) are multiples of 4 and map directly to the declared token set (xs=4px, sm=8px, md=16px, lg=24px, xl=32px, 2xl=48px, 3xl=64px).

**Arbitrary values — all spec-permitted:**
- `min-h-[44px]` and `min-w-[44px]` — touch target requirement, explicitly declared in spacing exceptions
- `max-h-[60vh]` on TranscriptView — explicitly declared in spec ("max-height 60vh on desktop")
- `min-w-[220px]` on CallFilters search input — this is the one non-spec arbitrary value (no minimum width declared for inputs). Low impact; functional necessity to prevent the input collapsing too narrow on flex-wrap layouts.

**Notable patterns:**
- h-12 (48px = 3xl) on Login CTA, h-11 (44px = touch target minimum) on modal CTAs. Correct.
- h-14 (56px) on mobile top bar header. Not in the declared scale but is a very common nav-bar height convention; functionally reasonable.
- py-0.5 on badges — sub-scale value. Used consistently for dense badge padding which is a well-established exception.
- Consistent p-6 for cards across MetricCard, CallDetail, DriverCallSubLog toggle header. Correct.

---

### Pillar 6: Experience Design (3/4)

**Contract honoured:**

- All interactive forms have inline loading states: Login button shows "Signing in…" while pending with disabled + opacity-60. DriverModal save button shows "Saving…". DeleteConfirmDialog shows "Deleting…". All correct.
- Empty states exist for every data surface: Metrics (body only — see P1 deviation), Call History (no calls / filters active), Drivers (no drivers), Transcript (unavailable), Recording (unavailable), DriverCallSubLog (no outbound calls). All match spec copy.
- Destructive action protection: Delete requires confirm dialog; Deactivate is immediate with toast (reversible, no confirm needed). Matches spec intent (D-10, UI-08).
- Disabled states: Deactivate button disabled during isPending transition. Delete/Keep buttons disabled during delete isPending. Login button disabled during pending. All correct.
- Focus management: DriverModal focuses first input on open; DeleteConfirmDialog focuses cancel button on open (safe default). Both handle Escape key. Both implement Tab focus trapping. Correct.
- Toast feedback: all 4 declared messages ("Driver saved", "Driver deleted", "Driver deactivated", "Driver activated") implemented. Error toast variant implemented for delete failures.
- ARIA: dialogs use role="dialog" aria-modal="true" aria-labelledby. Outcome badges have aria-label. Status badges have aria-label. Hamburger button has aria-label. Filter chip dismiss has aria-label. Transcript speaker span has aria-hidden="true". Nav has aria-label. DriverCallSubLog toggle has aria-expanded. Toast uses role="status" aria-live="polite". Notably good accessibility coverage.

**Gaps against contract:**

1. **No loading.tsx files** — `src/app/dashboard/`, `src/app/dashboard/calls/`, `src/app/dashboard/drivers/` each lack a `loading.tsx`. Spec requires skeleton loaders (animate-pulse bg-zinc-200 shimmer) for MetricCard ×4, CallHistoryTable (5 rows, 48px height), DriverList (3 rows). Without these, users see a blank page during initial server-component data fetch.

2. **No error.tsx files** — No route has an `error.tsx` boundary. Spec requires: heading "Something went wrong" text-xl font-semibold, body "We couldn't load this page. Please try refreshing." text-sm text-zinc-600, refresh link text-accent text-sm underline. A Supabase failure currently crashes the page with an unhandled error.

3. **No React Suspense boundaries** — Spec calls for each major data section wrapped in Suspense with skeleton fallback. PeriodTabs uses `useSearchParams()` which requires a Suspense wrapper in Next.js 15+ (missing wrapper will cause a runtime warning or render error depending on Next.js version). DashboardPage, CallHistoryPage, and DriversPage are server components that stream data without explicit Suspense boundaries.

4. **Success rate tooltip not implemented** — Spec declares: "Calls resolved by the AI without human transfer" as a tooltip on the Success rate metric card. No title attribute, tooltip component, or aria-describedby is present on the MetricCard for "Success rate". Low priority (Phase 4 concern when real data is visible) but noted as a gap.

---

## Registry Safety

Registry audit: not applicable. No shadcn detected (components.json absent). All components hand-authored.

---

## Files Audited

**Components:**
- `src/components/admin/AdminShell.tsx`
- `src/components/admin/LoginForm.tsx`
- `src/components/admin/MetricCard.tsx`
- `src/components/admin/PeriodTabs.tsx`
- `src/components/admin/CallFilters.tsx`
- `src/components/admin/CallHistoryTable.tsx`
- `src/components/admin/CallDetail.tsx`
- `src/components/admin/TranscriptView.tsx`
- `src/components/admin/RecordingPlayer.tsx`
- `src/components/admin/DriverCallSubLog.tsx`
- `src/components/admin/DriverList.tsx`
- `src/components/admin/DriverModal.tsx`
- `src/components/admin/DeleteConfirmDialog.tsx`
- `src/components/admin/Toast.tsx`

**Pages:**
- `src/app/login/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/calls/page.tsx`
- `src/app/dashboard/calls/[id]/page.tsx`
- `src/app/dashboard/drivers/page.tsx`

**Design contract:**
- `.planning/phases/03-admin-dashboard/03-UI-SPEC.md`
- `.planning/phases/03-admin-dashboard/03-CONTEXT.md`
