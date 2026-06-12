# Phase 2: Tracking Portal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 02-tracking-portal
**Areas discussed:** Brand & visual style, Landing & lookup form, Result layout & errors
**Area not selected (Claude's discretion):** Milestone timeline presentation

---

## Area selection

| Option | Selected |
|--------|----------|
| Brand & visual style | ✓ |
| Milestone timeline | (deferred to Claude's discretion) |
| Landing & lookup form | ✓ |
| Result layout & errors | ✓ |

---

## Brand & Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| One accent colour | Neutral base + single Derby Aggs accent colour | ✓ |
| Full brand kit | User-provided colours + logo throughout | |
| Pure neutral | No branding at all | |

**User's choice:** One accent colour.
**Notes:** Accent defaulted to professional blue (`#2563eb` / Tailwind blue-600) as a swappable theme token pending a real Derby Aggs brand hex. No logo asset yet — text wordmark until provided.

---

## Landing & Lookup Form

| Option | Description | Selected |
|--------|-------------|----------|
| Bare focused form | Two fields + Track button + small title | ✓ |
| Form + brief help | Form plus where-to-find-it guidance | |
| Branded landing | Derby Aggs intro above the form | |

**User's choice:** Bare focused form.
**Notes:** Utility-first; POST/server action so no tracking data in the URL (PORT-01). Minimal inline field hints acceptable.

---

## Result Layout & Errors

### Multiple-match disambiguation

| Option | Description | Selected |
|--------|-------------|----------|
| List with safe detail | Destination town + status per candidate | ✓ |
| Minimal list | Consignment numbers + status only | |
| Auto-pick latest | Skip chooser, show most recent | |

**User's choice:** List with safe detail.
**Notes:** Postcode already verified by the backend gate, so showing town/status discloses nothing new.

### Error fallback / human contact

| Option | Description | Selected |
|--------|-------------|----------|
| Show contact + retry | Distinct per-error message + "Call us" + retry | ✓ |
| Retry only | Per-error message + retry, no contact | |

**User's choice:** Show contact + retry.
**Notes:** Contact number is a config placeholder until the Phase 4 voice line provides the real UK number. Customer never left at a dead end.

---

## Claude's Discretion

- Milestone timeline presentation (not selected): compact horizontal 5-step stepper above the fold, vertical event history below.
- Loading/skeleton states, typography scale, component breakdown, validation micro-copy.
- Exact signed-link token mechanism for share/print (must meet: no postcode exposed, short-lived).

## Deferred Ideas

- Full Derby Aggs brand kit (logo + palette) — when assets provided.
- Real contact phone number — arrives in Phase 4.
- Proactive notifications (SMS/email) — v2, out of scope.
