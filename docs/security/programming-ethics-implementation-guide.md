# Programming Ethics — Implementation Guide for LeagueForge

This maps the six pillars from the earlier discussion onto what's actually true in this codebase right now — what's already solid, what's a real gap, and what to do about each. Checked directly against current `main` rather than assumed.

## What's already genuinely good (worth preserving and documenting, not redoing)

- **Multi-tenant data isolation** — RLS policies keep one organization's data from another. This is the foundation everything else in this guide builds on.
- **The AI match-report feature requires human confirmation** before anything is saved — a real, deliberate transparency/honesty decision, not the fastest path that was available.
- **The public live-scores endpoint exposes a deliberately minimal dataset** (team names, score, status — no player names, no internal IDs) through a dedicated restricted view, not the full underlying data.
- **Security issues get found and fixed, not just found.** The pattern across this project's review history — issue identified, fixed, re-verified in a later pass — is itself an ethical practice (accountability over one-time box-checking).

## Real gaps, checked directly

| Pillar | Finding | Concrete action |
|---|---|---|
| Privacy & data protection | No data-deletion or privacy-request mechanism exists anywhere in the codebase — searched for it directly, found none. Given a meaningful share of this app's data belongs to minors, this is the most important gap in this whole list. | Add an org-admin-facing "delete this player's data" action that removes/anonymizes personal records while preserving anonymized historical match events (same pattern already used for `auth_audit_logs.user_id` — `ON DELETE SET NULL` — extend that pattern here). |
| Transparency | The player-ratings engine (`lib/logic/ratings.ts`) produces a number coaches and players see, but nothing in the UI explains how it's calculated. Checked directly — no methodology text anywhere in `components/players/` or `components/player/`. A rating that affects how a player is perceived shouldn't be a black box. | Add a short "how this is calculated" explanation next to the rating display — doesn't need to expose the exact formula, but should name the real factors (goals, assists, discipline, position-specific weighting) so it's not opaque. |
| Accessibility (a fairness/harm-avoidance dimension, not just a UX one) | 49 of 118 component files have any `aria-*`/`alt` attribute — meaningful but partial, inconsistent coverage rather than a systematic standard. | Add accessibility to the shared UI primitives work already planned (`components/ui/` — Button, Card, Input) so keyboard navigation and screen-reader labels are correct once, centrally, rather than audited screen-by-screen. |
| Respecting others' IP | No `LICENSE` file in the repo, and the flyer-generator work earlier in this project deliberately avoided real crests/sponsor logos for exactly this reason — worth making that a written standard, not something that has to be re-decided each time a new feature touches uploaded/branded assets. | Add a `LICENSE` file (pick one appropriate to the project's actual distribution plans), and a short `CONTRIBUTING.md` note: user-uploaded crests/logos are the organization's own assets and responsibility; don't have any feature (flyers, exports, generated content) reproduce third-party branding that wasn't uploaded by the org itself. |
| Documentation honesty/accountability | `docs/security/` currently holds six separate, overlapping security documents with no clear "this one is current" marker — already flagged in the system review. Scattered, contradictory-risk documentation is itself an accountability problem: if nobody can tell which record is authoritative, the record isn't actually serving its purpose. | Consolidate into one living document (already recommended in the system review — same fix applies here). |

## Suggested priority order

1. **Data deletion/anonymization for players** — highest stakes, given who the data is about.
2. **Consolidate the security docs** — cheap, and it's an accountability gap that undermines everything else on this list if the record of past issues itself can't be trusted.
3. **Rating-methodology transparency** — small UI addition, meaningful trust improvement.
4. **Accessibility, folded into the shared UI primitives work** — do it once, centrally, rather than as a separate pass.
5. **LICENSE + IP-handling note** — low effort, closes an open question.

---

## Ready-to-paste prompt

```
Implement the following ethics-related improvements to LeagueForge. Treat
each item as independently shippable — don't bundle them into one large
change, and don't touch unrelated code while implementing any one of them.

1. PLAYER DATA DELETION/ANONYMIZATION
   Add an org-admin action to delete or anonymize a player's personal data
   (name, contact info, photo) while preserving their historical match
   events in anonymized form — mirror the existing pattern where
   auth_audit_logs.user_id is ON DELETE SET NULL rather than cascading a
   full delete. This needs a migration (nullable/anonymizable columns on
   the relevant player-identity fields), an API route gated the same way
   every other sensitive org-scoped write in this codebase is gated
   (requireOrgAdmin, resolved from the player's team's organization), and
   a confirmation-required UI action so this isn't a single accidental
   click. Write an audit record for this action specifically, since
   deleting someone's data is exactly the kind of action that needs a
   clear "who did this and when" trail.

2. CONSOLIDATE docs/security/
   Merge SECURITY.md, SECURITY_REVIEW.md, SECURITY_REVIEW_2026.md,
   Application_Security_Audit_Report.md, and SECURITY_AUDIT_REPORT.md into
   a single current document. Preserve genuinely distinct findings from
   each; where they overlap or conflict, keep the most recent/most
   specific version. Delete the redundant files rather than leaving them
   to be mistaken for current.

3. RATING METHODOLOGY TRANSPARENCY
   Add a short, plain-language explanation near wherever a player rating
   is displayed in components/players/ and components/player/ — name the
   real factors the rating in lib/logic/ratings.ts actually weighs (goals,
   assists, discipline, position-specific weighting), without necessarily
   exposing the exact formula. The goal is "a coach or player can
   understand roughly why this number is what it is," not full algorithm
   disclosure.

4. LICENSE + IP-HANDLING NOTE
   Add a LICENSE file appropriate to how this project is actually
   distributed. Add a short CONTRIBUTING.md (or extend an existing one)
   stating that any feature touching branding, crests, or exported/
   generated graphics must use only assets the organization itself
   uploaded — never third-party logos, competition badges, or sponsor
   marks that weren't provided by that organization.

Do not change authorization logic, RLS policies, or the season/competition
data model while implementing any of the above — these are additive
changes layered on top of the existing, already-reviewed architecture.
```
