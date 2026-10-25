# Complete a Single-Leg League Around a Manually Set Matchday 1

**Situation:** a live organization already has matchday 1 set by hand and wants a single-leg league (every team plays every other team once). Today the system can't finish the schedule for them.

## 1. What I found

| Question | Answer |
|---|---|
| Is single-leg already the default? | Yes. `generateRoundRobinFixtures` builds n−1 rounds with every pair meeting once. There is no double-leg mode. No change needed for "one leg". |
| Can the org generate the rest after entering matchday 1? | **No.** Both generate routes refuse once any fixture exists: `app/api/competitions/[id]/generate-fixtures` returns 409 ("already generated for this season"), and the older `app/api/fixtures/generate` returns 409 ("Fixtures already exist"). The legacy route's check isn't even scoped to a competition. |
| Does the generator's own "keep existing matches, fill the gaps" mode work? | **Not reliably.** The library function accepts `existingFixtures` and locks scheduled matches, but the routes never reach it. I tested it directly: 425 cases (4 to 20 teams, 25 random matchday-1 pairings each), matchday 1 passed in as locked scheduled matches. **375 of 425 failed**, always the same way: the right number of rounds and no duplicate pairs, but **some pairings never scheduled**. It passes at 4 teams and fails almost always from 7 teams up. I did not root-cause the code beyond that. |
| Can it be fixed? | Yes, with a small deterministic method (section 2). Same 425 cases: **0 failures**, matchday 1 untouched, every pair exactly once. |

I can't see the organization's data. Before touching anything, look at what is actually in their competition: how many fixtures exist, which rounds, and whether any pair appears twice. If they saw teams meeting twice, it likely came from manual entries layered on generated ones, not from the algorithm.

## 2. The method: relabel the circle method

Any matchday 1 in which each team plays once is a perfect matching of the teams. Every perfect matching can be treated as round 1 of the standard circle method just by choosing which team sits in which slot. So:

1. Validate that matchday 1 uses each team at most once, and covers every team (for an odd league, exactly one team has the bye).
2. Place the matchday-1 pairs into the circle: pair i goes in slot i and slot (total − 1 − i). For an odd league, the bye team sits opposite the empty slot.
3. Run the normal rotation to produce rounds 2 to n−1. Round 1 equals the organization's matchday 1 by construction, and a valid completion always exists.
4. Keep matchday 1's home/away exactly as entered. Orient the later matches greedily, then run a balancing pass that flips orientations while it reduces total home/away imbalance.

Measured over the 425 cases: **0 invalid schedules; worst home/away gap 2** (the greedy rule alone left a gap of 5 at 20 teams).

### Reference implementation (tested)

```ts
type Pair = [number, number]; // [homeId, awayId]

export function completeSingleRoundRobin(teamIds: number[], matchday1: Pair[]) {
  const n = teamIds.length, odd = n % 2 === 1, total = odd ? n + 1 : n, half = total / 2;

  const used = new Set<number>();
  for (const [a, b] of matchday1) {
    if (a === b || used.has(a) || used.has(b)) throw new Error("Matchday 1 uses a team twice");
    used.add(a); used.add(b);
  }
  const unscheduled = teamIds.filter((t) => !used.has(t));
  if (odd ? unscheduled.length !== 1 : unscheduled.length !== 0) {
    throw new Error(`Matchday 1 must cover every team${odd ? " except one bye" : ""}`);
  }

  const circle: (number | null)[] = new Array(total).fill(null);
  matchday1.forEach(([a, b], i) => { circle[i] = a; circle[total - 1 - i] = b; });
  if (odd) { circle[matchday1.length] = unscheduled[0]; circle[total - 1 - matchday1.length] = null; }

  const home = new Map<number, number>(), away = new Map<number, number>();
  const get = (m: Map<number, number>, t: number) => m.get(t) ?? 0;
  const rounds: { round: number; byeId: number | null; pairs: Pair[] }[] = [];

  for (let r = 0; r < total - 1; r++) {
    const pairs: Pair[] = []; let bye: number | null = null;
    for (let i = 0; i < half; i++) {
      const l = circle[i], rt = circle[total - 1 - i];
      if (l === null || rt === null) { bye = l ?? rt; continue; }
      let h = l, a = rt;
      if (r === 0) {
        const m = matchday1.find(([x, y]) => (x === l && y === rt) || (x === rt && y === l))!;
        h = m[0]; a = m[1];                       // keep matchday 1 exactly as entered
      } else if (get(home, h) - get(away, h) > get(home, a) - get(away, a)) {
        [h, a] = [a, h];
      }
      home.set(h, get(home, h) + 1); away.set(a, get(away, a) + 1);
      pairs.push([h, a]);
    }
    rounds.push({ round: r + 1, byeId: bye, pairs });
    const last = circle.pop()!; circle.splice(1, 0, last); // rotate, slot 0 fixed
  }

  // Balancing pass: flip later matches while it reduces total imbalance.
  const imb = (t: number) => get(home, t) - get(away, t);
  for (let guard = 0, changed = true; changed && guard < 200; guard++) {
    changed = false;
    for (const rd of rounds.slice(1)) for (const p of rd.pairs) {
      const [h, a] = p;
      if (Math.abs(imb(h) - 2) + Math.abs(imb(a) + 2) < Math.abs(imb(h)) + Math.abs(imb(a))) {
        home.set(h, get(home, h) - 1); away.set(h, get(away, h) + 1);
        away.set(a, get(away, a) - 1); home.set(a, get(home, a) + 1);
        p[0] = a; p[1] = h; changed = true;
      }
    }
  }
  return rounds;
}
```

Put it in `lib/logic/round-robin.ts` next to `buildRoundPairings`, and reuse the existing seeded-PRNG and `pairKey` helpers where convenient.

## 3. Product changes

**Library.** Add `completeSingleRoundRobin` (above). Change the `existingFixtures` path of `generateRoundRobinFixtures` so that when the locked fixtures are exactly one full round-1, it uses this method. Keep existing behavior untouched for any other input.

**Route.** In `app/api/competitions/[id]/generate-fixtures/route.ts`, replace the blanket 409 with a `mode` field:
- `mode: "create"` (default): current behavior, still 409 if fixtures exist.
- `mode: "complete"`: keep every existing fixture; load them; call the completion; insert **only** the pairs not already present.
- `mode: "complete"` plus `dryRun: true`: return the proposed rounds without writing anything.

**Rules for `complete` mode:**
- `requireOrgAdmin` on the competition's organization, same as the existing route; rate-limited.
- Never update or delete an existing fixture. Fixtures with results are untouched.
- Insert in one transaction. Take `competition_id` and `season_id` from the existing fixtures, not from the request.
- Reject with a clear message when matchday 1 is incomplete, uses a team twice, or contains a pair that meets twice. Name the offending fixtures.
- Dates and times: leave the generated rounds unscheduled unless the admin supplied a start date and interval; never invent dates.
- Write an audit record (competition, rounds added, count).

**UI** (`app/org/[slug]/competitions/[cId]/fixtures/page.tsx`): when fixtures exist but the league is incomplete, replace the disabled "Generate" state with "Complete schedule (single leg)". Clicking it runs the dry run and shows a preview by round, with matchday 1 marked "kept as entered". A confirm button writes it.

**Later, optional:** a `legs` setting (1 or 2) on the competition. Two legs would mirror the single round-robin with home and away swapped. The organization doesn't need it now.

## 4. Edge cases

- **More than one round already set.** The relabel guarantee covers only a locked round 1. If they also entered matchday 2, a valid completion may not exist; return "can't complete automatically" with the conflicting rounds named, or add a backtracking solver for small leagues. Start with the clear error.
- **Odd number of teams.** One team has a bye each round; the method handles it, and matchday 1 must have exactly one team unscheduled.
- **Matchday 1 partly entered** (even league, some teams missing): reject and list the unscheduled teams. Don't guess.
- **Matchday 1 already played:** nothing changes for it; its results stand.
- **Teams added after fixtures exist:** out of scope; reject with a message.

## 5. Tests (Vitest, `lib/logic/round-robin.test.ts`)

- Property test: for n = 4 to 20, 25 random matchday-1 matchings each, assert the output has n−1 rounds (n for odd), every pair exactly once, no team twice in a round, matchday 1 identical to the input, and home/away gap ≤ 2. This is the test I ran; it must be in CI.
- Odd leagues keep exactly one bye per round, and the bye team is never scheduled that round.
- Rejections: team used twice, incomplete matchday 1, duplicate pair.
- Route tests: dry run writes nothing; `complete` leaves existing fixtures byte-identical; a second `complete` call inserts nothing; wrong-org admin gets 403.

## 6. Rolling it out for the live organization

1. **Read-only first.** Look at their competition's current fixtures: counts, rounds, duplicate pairs, anything with results. Don't run any generate action yet.
2. **Back up** their competition's fixtures (an export or snapshot) before writing.
3. Ship the route and library change behind the existing org-admin check.
4. Run the **dry run** and send the organization the proposed rounds for approval.
5. On their approval, run **complete** and confirm: every pair appears once, matchday 1 is unchanged, and the audit record exists.

**If they can't wait for the code change:** compute the remaining rounds with the reference function from their team list and matchday-1 pairs, and give them the list to enter through the existing fixture creator. It's manual, but it carries no risk to their data. Don't insert rows directly into their database unless they've approved the exact schedule and you've taken the backup.

## 7. Guardrails

- Don't change `requireOrgAdmin`, `ownsTeam` or any RLS policy.
- No schema change is needed for this.
- Never delete or edit existing fixtures in `complete` mode.
- Keep the old "create" behavior and its 409 exactly as is.

## Ready-to-paste prompt

```
Implement complete-schedule-around-matchday-1-guide.md. First add completeSingleRoundRobin to
lib/logic/round-robin.ts exactly as specified, plus the property test (n=4..20, 25 random
matchday-1 matchings each) and make it pass in CI. Then add mode:"complete" and dryRun to
app/api/competitions/[id]/generate-fixtures/route.ts, keeping the default behavior and its 409
unchanged, with the UI preview and confirm step. Never update or delete existing fixtures. Post a
short plan and wait for approval before each of the three steps (library, route, UI).
```
