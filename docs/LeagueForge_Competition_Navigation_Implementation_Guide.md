# LeagueForge Competition Navigation & UI Refactor — Implementation Guide

## 1. Objective

Refactor the competition-level UI in the LeagueForge/VFL application so that the competition page has a clear, professional navigation structure and no longer relies on floating action buttons or a secondary "Standings / More" navigation pattern.

### Current UI problems

The competition page currently contains:

- A competition header.
- A nested navigation containing:
  - `Standings`
  - `More`
- A floating `Enter Results` action.
- A floating `Add Fixture` action.
- Additional navigation items hidden inside the `More` menu.
- A mobile bottom navigation/action area.

This makes important competition functions less discoverable and makes the interface feel unnecessarily layered.

### Target UI

The competition navigation should expose these five destinations directly:

1. **Standings**
2. **Fixtures**
3. **Live**
4. **Final Match Results**
5. **Settings**

The `Enter Results` and `Add Fixture` floating controls should be removed from the competition layout.

> Important: removing the floating controls does **not** mean removing result-entry or fixture-creation functionality. Those capabilities should remain available from their appropriate pages.

---

# 2. Target Competition Structure

The competition area should follow this structure:

```text
Competition
├── Standings
├── Fixtures
├── Live
├── Final Match Results
└── Settings
```

Recommended routes:

```text
/org/[slug]/competitions/[cId]/standings
/org/[slug]/competitions/[cId]/fixtures
/org/[slug]/competitions/[cId]/live
/org/[slug]/competitions/[cId]/results
/org/[slug]/competitions/[cId]/settings
```

The existing `/results` route should continue to be used for completed/final match results, but its navigation label should be changed to:

```text
Final Match Results
```

---

# 3. Primary File to Modify

The main competition layout is:

```text
app/org/[slug]/competitions/[cId]/layout.tsx
```

This layout should become responsible for:

- Competition header.
- Competition identity.
- Competition-level navigation.
- Active navigation state.
- Responsive navigation.

It should **not** be responsible for:

- Creating fixtures through a floating button.
- Entering results through a floating button.
- Rendering a secondary "More" navigation.
- Rendering a mobile bottom action/navigation bar.

---

# 4. Navigation Configuration

Replace the existing competition navigation configuration with a simple five-item configuration.

Use the appropriate icons already available in the project.

Example:

```tsx
const tabs = [
  {
    href: "standings",
    label: "Standings",
    icon: Trophy,
  },
  {
    href: "fixtures",
    label: "Fixtures",
    icon: Calendar,
  },
  {
    href: "live",
    label: "Live",
    icon: Activity,
  },
  {
    href: "results",
    label: "Final Match Results",
    icon: ListOrdered,
  },
  {
    href: "settings",
    label: "Settings",
    icon: Settings,
  },
];
```

If the project uses a different icon library, use equivalent icons from the library already installed.

Avoid adding a new icon dependency just for this refactor.

---

# 5. Navigation Rendering

Render all five navigation items directly.

Example:

```tsx
<nav className="flex items-center gap-1 overflow-x-auto">
  {tabs.map((tab) => {
    const Icon = tab.icon;

    return (
      <Link
        key={tab.href}
        href={`/org/${slug}/competitions/${cId}/${tab.href}`}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive(tab.href)
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{tab.label}</span>

        {tab.href === "live" && hasLiveMatches && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </Link>
    );
  })}
</nav>
```

Adapt the styling to the existing design system.

---

# 6. Active Navigation State

The active navigation item should be determined from the current pathname.

For example:

```tsx
const pathname = usePathname();

const isActive = (href: string) => {
  return pathname.includes(
    `/competitions/${cId}/${href}`
  );
};
```

A more robust approach is preferable if the existing application already has a route-matching utility.

### Expected behavior

If the user is on:

```text
/competitions/123/standings
```

then:

```text
Standings
```

should be highlighted.

If the user is on:

```text
/competitions/123/fixtures
```

then:

```text
Fixtures
```

should be highlighted.

The same applies to:

- Live
- Final Match Results
- Settings

---

# 7. Live Navigation Indicator

The `Live` tab can display a small live indicator when matches are currently active.

Example:

```tsx
{hasLiveMatches && (
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
    <span className="relative inline-flex h-2 w-2 rounded-full" />
  </span>
)}
```

This should be subtle.

Do not turn the entire navigation into a bright or overly animated interface.

The purpose is simply to communicate:

> There is currently live match activity.

---

# 8. Remove the "More" Navigation

The current nested navigation containing:

```text
Standings
More ▼
```

should be completely removed.

Do not keep the five destinations hidden inside a dropdown.

The final navigation should expose:

```text
Standings | Fixtures | Live | Final Match Results | Settings
```

directly.

This reduces interaction depth and makes the competition information architecture easier to understand.

---

# 9. Remove Floating "Enter Results" Button

Remove the floating:

```text
Enter Results
```

control from the competition layout.

This means removing:

- Its JSX.
- Its icon import if unused afterward.
- Its click handler if one exists only for the button.
- Any related state.
- Any tooltip/popover specifically used by the action.
- Any responsive/mobile version of the same action.

### Important

Do **not** delete the underlying result-entry functionality.

Instead, place result-entry actions inside the appropriate:

```text
Live
```

or:

```text
Final Match Results
```

workflow.

For example:

```text
Fixtures
   ↓
Open match
   ↓
Enter/update match result
   ↓
Match becomes Final
   ↓
Final Match Results
```

---

# 10. Remove Floating "Add Fixture" Button

Remove the floating:

```text
Add Fixture
```

control from the competition layout.

Again, do not delete fixture creation.

The `Add Fixture` functionality should live inside the:

```text
Fixtures
```

page.

Recommended Fixtures page structure:

```text
Fixtures

[ Add Fixture ] [ Generate Fixtures ]

Upcoming
--------------------------------
Match 1
Match 2
Match 3

Completed
--------------------------------
Match 4
Match 5
```

This makes the action contextually relevant.

A user viewing fixtures naturally expects fixture-management actions to be there.

---

# 11. Remove Mobile Bottom Action Navigation

If the competition layout currently contains a fixed mobile bottom navigation/action bar containing actions such as:

```text
Enter Results
Add Fixture
```

remove it.

Do not replace it with another floating action bar.

Instead, use the same five competition navigation destinations in a responsive manner.

For narrow screens, the navigation can:

- Horizontally scroll.
- Collapse into a compact menu if absolutely necessary.
- Use icon + label combinations that remain readable.

Preferred approach:

```tsx
<div className="overflow-x-auto">
  <nav className="flex min-w-max gap-1">
    ...
  </nav>
</div>
```

This avoids hiding important competition sections behind a `More` menu.

---

# 12. Remove Obsolete Imports

After removing the old navigation and floating actions, inspect the imports in:

```text
app/org/[slug]/competitions/[cId]/layout.tsx
```

Remove icons/components that are no longer used.

Potential examples include:

```tsx
BarChart3
LayoutGrid
Shield
Users
Plus
ChevronDown
MoreHorizontal
Menu
X
CheckCircle
Zap
```

Only remove an import if it is no longer used elsewhere in the file.

Do not blindly remove all of them.

---

# 13. Remove Obsolete State

Look for state related to the old navigation.

Potential examples:

```tsx
const [moreTabsOpen, setMoreTabsOpen] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
```

Also look for:

```tsx
moreTabsRef
```

or similar refs.

Remove these only if they are exclusively related to the removed navigation.

---

# 14. Remove Obsolete Effects

The old `More` dropdown may have an effect that closes the menu when the user clicks outside.

For example:

```tsx
useEffect(() => {
  ...
}, [moreTabsOpen]);
```

After removing the dropdown, remove that effect if it is no longer required.

Do not remove effects that perform unrelated competition data loading or synchronization.

---

# 15. Competition Header

Keep the competition header.

It should continue to communicate:

- Competition name.
- Competition logo/badge if available.
- Organization/team context.
- Competition status where applicable.
- Relevant metadata.

Example conceptual layout:

```text
┌──────────────────────────────────────────────────────────────┐
│  [Logo]  VFL Premier League                                  │
│          2026 Season                                         │
│                                                              │
│  Standings  Fixtures  Live  Final Match Results  Settings    │
└──────────────────────────────────────────────────────────────┘
```

Avoid adding unnecessary cards around each navigation item.

The navigation should feel like part of the competition header rather than five separate dashboard cards.

---

# 16. Visual Design Direction

The goal is a professional sports-management interface rather than an AI-generated dashboard aesthetic.

Use:

- Clean spacing.
- Consistent typography.
- Moderate border radius.
- Subtle borders.
- Soft shadows only where useful.
- Clear hierarchy.
- Strong active-state treatment.
- Consistent icon sizing.
- Good whitespace.
- Responsive behavior.

Avoid:

- Excessive gradients.
- Excessive glowing effects.
- Too many floating elements.
- Huge rounded cards.
- Excessive animation.
- Random accent colors.
- Multiple competing visual hierarchies.

The interface should feel similar to a professional sports administration platform.

---

# 17. Recommended Navigation Styling

A good baseline:

```tsx
className={cn(
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
  "transition-colors duration-150",
  isActive
    ? "bg-primary text-primary-foreground shadow-sm"
    : "text-muted-foreground hover:bg-muted hover:text-foreground"
)}
```

For mobile:

```tsx
<nav className="flex min-w-max gap-1">
```

inside:

```tsx
<div className="overflow-x-auto scrollbar-none">
```

This keeps all five tabs accessible without making the screen excessively tall.

---

# 18. Fixtures Page Changes

Move fixture-management actions into:

```text
/org/[slug]/competitions/[cId]/fixtures
```

The Fixtures page should contain:

### Header

```text
Fixtures
Manage upcoming and scheduled matches

[ Add Fixture ]
[ Generate Fixtures ]
```

### Fixture sections

```text
Upcoming Fixtures
Live Fixtures
Completed Fixtures
```

Depending on the application's existing behavior, Live Fixtures may instead be displayed only in the Live page.

Do not duplicate large amounts of match data unnecessarily.

---

# 19. Live Page Changes

The Live page should become the primary operational interface for matches currently being played.

Recommended structure:

```text
Live Matches

┌────────────────────────────────────┐
│ Team A              2              │
│ Team B              1              │
│                                    │
│ 67'                                 │
│                                    │
│ [ Goal ] [ Card ] [ Substitution ] │
│                                    │
│ [ Update Match ]                   │
└────────────────────────────────────┘
```

The exact controls should follow the application's existing match-event implementation.

The important principle is:

> Live-match operations belong in Live, not in a global floating action button.

---

# 20. Final Match Results Page

The existing results route should be presented as:

```text
Final Match Results
```

It should focus on completed matches.

Recommended structure:

```text
Final Match Results

Filter:
[ Season ] [ Date ] [ Team ]

----------------------------------

Team A       2 - 1       Team B
Completed

Team C       0 - 0       Team D
Completed
```

If the application already supports result editing, preserve that functionality according to the existing authorization model.

---

# 21. Settings Page

Settings should contain competition-level configuration.

Potential sections include:

```text
Competition Settings

General
- Competition name
- Logo
- Description
- Season

Competition Rules
- Points
- Goal difference
- Tie-break rules
- Match duration

Administration
- Competition permissions
- Archive/delete controls
```

Only implement settings that already exist or are part of the application's planned functionality.

Do not introduce unrelated settings during this navigation refactor.

---

# 22. Competition Root Route

If the competition currently has a general overview page at:

```text
/org/[slug]/competitions/[cId]
```

decide whether it should remain.

### Preferred structure

The competition root can redirect to:

```text
/standings
```

if there is no longer a meaningful overview page.

Example:

```tsx
redirect(`/org/${slug}/competitions/${cId}/standings`);
```

However, first inspect the current root page and references before deleting or replacing it.

Do not remove the root page blindly.

---

# 23. Route Verification

After implementing the navigation, verify all five routes.

### Standings

```text
/standings
```

Expected:

- Standings load.
- Active tab = Standings.

### Fixtures

```text
/fixtures
```

Expected:

- Fixtures load.
- Active tab = Fixtures.
- Add Fixture is available inside the page.

### Live

```text
/live
```

Expected:

- Live matches load.
- Active tab = Live.
- Match-event/result controls work.

### Final Match Results

```text
/results
```

Expected:

- Completed results load.
- Navigation label says Final Match Results.

### Settings

```text
/settings
```

Expected:

- Competition settings load.
- Active tab = Settings.

---

# 24. Responsive Testing

Test the navigation at:

```text
Desktop
1440px
1280px
1024px

Tablet
768px

Mobile
430px
390px
375px
```

### Desktop

Expected:

```text
Standings | Fixtures | Live | Final Match Results | Settings
```

All tabs should be visible where space allows.

### Mobile

The navigation may scroll horizontally:

```text
Standings | Fixtures | Live | Final Match Results | ...
```

The user should be able to swipe/scroll to reach Settings.

Do not hide the important tabs inside a generic `More` menu unless the design absolutely requires it.

---

# 25. Accessibility

Navigation should be accessible using keyboard and screen readers.

Use:

```tsx
<Link>
```

for navigation instead of clickable `<div>` elements.

Active links should have appropriate semantics where possible.

Example:

```tsx
aria-current={isActive(tab.href) ? "page" : undefined}
```

Buttons inside Fixtures/Live pages should have clear labels.

Do not rely solely on color to indicate the active route.

---

# 26. Loading and Error States

The navigation refactor should not break existing:

- Loading states.
- Error boundaries.
- Empty states.
- Authentication checks.
- Competition permission checks.

Verify that each route still respects the current organization and competition authorization model.

---

# 27. Regression Checklist

Before considering the refactor complete, verify:

### Navigation

- [ ] Standings tab works.
- [ ] Fixtures tab works.
- [ ] Live tab works.
- [ ] Final Match Results tab works.
- [ ] Settings tab works.
- [ ] Active state works.
- [ ] No `More` dropdown remains.
- [ ] No duplicate competition navigation remains.

### Actions

- [ ] `Enter Results` floating action removed.
- [ ] `Add Fixture` floating action removed.
- [ ] Mobile floating action bar removed.
- [ ] Add Fixture still works from Fixtures.
- [ ] Result entry still works from Live/Results workflow.

### Responsive UI

- [ ] Desktop layout works.
- [ ] Tablet layout works.
- [ ] Mobile layout works.
- [ ] Navigation can reach all five destinations on small screens.
- [ ] No horizontal page overflow.

### Code quality

- [ ] Unused imports removed.
- [ ] Unused state removed.
- [ ] Unused refs removed.
- [ ] Unused effects removed.
- [ ] No dead handlers remain.
- [ ] No TypeScript errors.
- [ ] No console errors.

---

# 28. Suggested Implementation Sequence

Implement in this order:

## Step 1 — Inspect current competition layout

Open:

```text
app/org/[slug]/competitions/[cId]/layout.tsx
```

Identify:

- Existing navigation.
- `More` menu.
- Floating actions.
- Mobile navigation.
- Related state/effects.
- Existing route names.

---

## Step 2 — Replace navigation configuration

Create the five-tab configuration:

```text
Standings
Fixtures
Live
Final Match Results
Settings
```

---

## Step 3 — Replace navigation JSX

Render the five links directly.

Remove the old:

```text
Standings + More
```

pattern.

---

## Step 4 — Remove floating actions

Delete:

```text
Enter Results
Add Fixture
```

from the competition layout.

---

## Step 5 — Remove mobile action bar

Delete the duplicate mobile controls.

---

## Step 6 — Clean up code

Remove unused:

- Imports.
- State.
- Refs.
- Effects.
- Handlers.

---

## Step 7 — Move contextual actions

Make sure:

```text
Add Fixture
```

exists on the Fixtures page.

Make sure result-entry functionality exists in the appropriate Live/Results workflow.

---

## Step 8 — Test routing

Open each route manually.

---

## Step 9 — Test responsive behavior

Use browser responsive mode and test the listed viewport sizes.

---

## Step 10 — Run project checks

Run the project's existing checks, for example:

```bash
npm run lint
```

and:

```bash
npm run build
```

If the project uses another package manager:

```bash
pnpm lint
pnpm build
```

or:

```bash
yarn lint
yarn build
```

Use whichever package manager is already configured by the repository.

---

# 29. Expected Final UX

The finished competition page should feel like this:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Competition Logo]  VFL Competition                        │
│                      2026 Season                             │
│                                                             │
│  Standings   Fixtures   ● Live   Final Match Results  Settings
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

When the user selects Fixtures:

```text
Fixtures

                                      [ Add Fixture ]

Upcoming Fixtures
--------------------------------------------------------------
Match cards...
```

When the user selects Live:

```text
Live

LIVE NOW

Match cards...
Event controls...
```

When the user selects Final Match Results:

```text
Final Match Results

Completed Matches
--------------------------------------------------------------
Match cards...
```

When the user selects Settings:

```text
Competition Settings

General
Competition Rules
Administration
```

---

# 30. Definition of Done

This implementation is complete when:

1. The competition navigation exposes exactly five primary destinations:
   - Standings
   - Fixtures
   - Live
   - Final Match Results
   - Settings

2. The old `Standings / More` navigation is removed.

3. The floating `Enter Results` action is removed.

4. The floating `Add Fixture` action is removed.

5. The mobile duplicate action bar is removed.

6. Fixture creation remains available from the Fixtures page.

7. Match result/event management remains available from the appropriate Live/Results workflow.

8. Existing routes and authorization behavior continue to work.

9. The navigation is responsive.

10. No TypeScript, lint, build, or console errors are introduced.

11. The resulting interface has a clean, professional sports-management feel rather than a cluttered dashboard appearance.

---

# 31. Final File-Level Checklist

Primary:

```text
app/org/[slug]/competitions/[cId]/layout.tsx
```

Review:

```text
app/org/[slug]/competitions/[cId]/page.tsx
app/org/[slug]/competitions/[cId]/standings/*
app/org/[slug]/competitions/[cId]/fixtures/*
app/org/[slug]/competitions/[cId]/live/*
app/org/[slug]/competitions/[cId]/results/*
app/org/[slug]/competitions/[cId]/settings/*
```

Also search the project for:

```text
Enter Results
Add Fixture
More
moreTabsOpen
mobileMenuOpen
```

This helps identify duplicate implementations outside the main competition layout.

---

# 32. Important Implementation Principle

This task is primarily a **navigation and information-architecture refactor**, not a deletion of competition-management capabilities.

The following distinction must be maintained:

```text
REMOVE FROM GLOBAL LAYOUT
        ↓
Floating Enter Results
Floating Add Fixture
More dropdown
Duplicate mobile action bar

KEEP IN CONTEXT
        ↓
Fixture creation → Fixtures
Live match management → Live
Final result management → Final Match Results
Competition configuration → Settings
Standings → Standings
```

The final result should be a simpler competition shell where every major competition function has an obvious home.
