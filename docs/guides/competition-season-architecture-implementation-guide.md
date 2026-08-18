# Competition & Season Architecture --- Implementation Guide

## 1. Purpose

This guide defines the recommended competition architecture for the
multi-tenant football management system.

The key principle is:

> **A competition is the parent context for all football data, while a
> season represents a specific edition/year of that competition.**

For example, instead of creating:

-   VUNA League 2025
-   VUNA League 2026
-   VUNA League 2027

the system should have one competition:

**VUNA League**

with multiple seasons:

-   2025
-   2026
-   2027

This follows the way professional football competitions are commonly
organized and provides a cleaner user experience, better historical data
management, and easier reporting.

------------------------------------------------------------------------

# 2. Core Concepts

The system should distinguish between these entities:

``` text
Organization
    │
    └── Competition
          │
          ├── Season 2025
          │     ├── Teams
          │     ├── Players
          │     ├── Fixtures
          │     ├── Matches
          │     ├── Match Events
          │     ├── Standings
          │     └── Statistics
          │
          ├── Season 2026
          │     ├── Teams
          │     ├── Players
          │     ├── Fixtures
          │     ├── Matches
          │     ├── Match Events
          │     ├── Standings
          │     └── Statistics
          │
          └── Season 2027
                └── ...
```

The important distinction is:

-   **Competition** = the continuing tournament/league identity.
-   **Season** = one particular edition of that competition.
-   **Team** = a football team that participates in a season.
-   **Match** = a game played within a specific season.
-   **Match Event** = an event that happened in a specific match.

------------------------------------------------------------------------

# 3. Example: University Intra-University League

Suppose Veritas University runs an annual football competition.

Instead of creating:

``` text
VUNA League 2025
VUNA League 2026
VUNA League 2027
```

create:

``` text
Competition
----------------
Name: VUNA League
Type: League
Organization: Veritas University

Seasons
----------------
2025
2026
2027
```

The user experience becomes:

``` text
VUNA League

2026 Season
----------------
Standings
Fixtures
Results
Teams
Players
Statistics

2025 Season
----------------
Standings
Fixtures
Results
Teams
Players
Statistics
```

A user can switch between seasons without treating each season as a
completely different competition.

------------------------------------------------------------------------

# 4. Why Competition and Season Must Be Separate

A competition represents a long-term football property.

A season represents a particular instance of that competition.

For example:

``` text
Premier League
    ├── 2024/25
    ├── 2025/26
    └── 2026/27
```

The competition retains its identity while each season has independent
football data.

This architecture gives the platform:

-   Historical continuity
-   Better navigation
-   Cleaner URLs/routes
-   Easier statistics
-   Easier season switching
-   Better competition branding
-   Easier reporting
-   Better data integrity
-   Easier future expansion

------------------------------------------------------------------------

# 5. Data Isolation Rule

Every competition-specific piece of data must belong to a **season**,
not merely to the competition.

For example:

``` text
VUNA League
    │
    ├── 2025 Season
    │     ├── Teams
    │     ├── Fixtures
    │     ├── Matches
    │     └── Statistics
    │
    └── 2026 Season
          ├── Teams
          ├── Fixtures
          ├── Matches
          └── Statistics
```

A match from 2025 must never appear in the 2026 season.

A 2026 fixture must never affect the 2025 standings.

A 2025 goal must never be counted in a 2026 player's season statistics.

------------------------------------------------------------------------

# 6. Recommended Database Structure

## Organizations

``` text
organizations
--------------
id
name
logo
slug
createdAt
updatedAt
```

Every organization is a tenant.

------------------------------------------------------------------------

## Competitions

``` text
competitions
-------------
id
organizationId
name
slug
description
type
logo
status
createdAt
updatedAt
```

Example:

``` text
id: comp_001
organizationId: org_veritas
name: VUNA League
type: league
```

### Important constraint

A competition should belong to exactly one organization.

``` text
competition.organizationId
```

must always be present.

------------------------------------------------------------------------

# 7. Seasons

Create a dedicated `seasons` table/collection.

``` text
seasons
-------
id
competitionId
name
shortName
startDate
endDate
status
isCurrent
createdAt
updatedAt
```

Example:

``` text
id: season_2026
competitionId: comp_vuna
name: 2026 Season
shortName: 2026
startDate: 2026-01-01
endDate: 2026-12-31
status: active
isCurrent: true
```

Another:

``` text
id: season_2025
competitionId: comp_vuna
name: 2025 Season
shortName: 2025
status: completed
isCurrent: false
```

------------------------------------------------------------------------

# 8. Season Uniqueness

A competition should not contain duplicate seasons.

Recommended database constraint:

``` text
UNIQUE(competitionId, name)
```

Therefore:

``` text
VUNA League + 2026
```

can exist only once.

But:

``` text
VUNA League + 2025
VUNA League + 2026
```

can both exist.

------------------------------------------------------------------------

# 9. Teams and Seasons

This is one of the most important design decisions.

Do not automatically assume that a team participating in one season is
identical to its participation in another season.

For example:

``` text
Celtic FC
```

could participate in:

``` text
VUNA League 2025
VUNA League 2026
```

but the following may change:

-   Players
-   Coach
-   Captain
-   Squad
-   Team logo
-   Team colors
-   Registration details
-   Statistics

Therefore, use a season participation relationship.

Recommended structure:

``` text
teams
-----
id
organizationId
name
logo
createdAt
updatedAt
```

and:

``` text
season_teams
------------
id
seasonId
teamId
displayName
logo
registeredAt
status
```

This allows the same team identity to participate in multiple seasons
while maintaining season-specific information.

------------------------------------------------------------------------

# 10. Why Season-Team Is Better Than Putting seasonId Directly on Team

Consider:

``` text
Celtic FC
```

In 2025:

``` text
Coach: John
Captain: David
Players: A, B, C
Logo: Logo A
```

In 2026:

``` text
Coach: Michael
Captain: Peter
Players: D, E, F
Logo: Logo B
```

If `team` itself contains these values, updating the 2026 team can
accidentally overwrite the historical 2025 information.

Instead:

``` text
Team
Celtic FC
    │
    ├── VUNA 2025 Participation
    │     ├── Coach
    │     ├── Captain
    │     ├── Squad
    │     └── Logo
    │
    └── VUNA 2026 Participation
          ├── Coach
          ├── Captain
          ├── Squad
          └── Logo
```

This preserves historical accuracy.

------------------------------------------------------------------------

# 11. Players and Seasons

Players should also be associated with the season in which their
statistics are recorded.

A player can have a persistent identity:

``` text
players
-------
id
organizationId
firstName
lastName
dateOfBirth
photo
```

Then connect the player to a team/season through a registration entity:

``` text
season_team_players
-------------------
id
seasonTeamId
playerId
jerseyNumber
position
registeredAt
status
```

This allows:

``` text
Player A
    │
    ├── VUNA 2025
    │     └── Celtic FC
    │
    └── VUNA 2026
          └── Chelsea FC
```

The player can transfer between teams without destroying historical
records.

------------------------------------------------------------------------

# 12. Fixtures

Fixtures must belong to a season.

``` text
fixtures
--------
id
seasonId
homeTeamId
awayTeamId
round
matchDate
venue
status
```

Never create a fixture using only:

``` text
competitionId
```

because the same competition can contain multiple seasons.

Correct:

``` text
fixture
   ↓
season
   ↓
competition
   ↓
organization
```

------------------------------------------------------------------------

# 13. Matches

A match should belong to the season through its fixture or directly
through `seasonId`.

Recommended:

``` text
matches
-------
id
seasonId
fixtureId
homeTeamId
awayTeamId
homeScore
awayScore
status
kickoffTime
venue
```

The `seasonId` should be treated as an important integrity field even if
it can technically be derived from the fixture.

------------------------------------------------------------------------

# 14. Match Events

All match events must belong to a match.

``` text
match_events
------------
id
matchId
teamId
playerId
assistPlayerId
eventType
minute
extraTime
metadata
createdAt
createdBy
```

Examples:

``` text
Goal
Yellow Card
Red Card
Substitution
Penalty Goal
Penalty Miss
Own Goal
VAR
```

Because:

``` text
Match
  ↓
Season
  ↓
Competition
  ↓
Organization
```

the event automatically belongs to the correct competition and season.

------------------------------------------------------------------------

# 15. Statistics

Statistics must be calculated within the season context.

For example:

``` text
Player
    ↓
Season
    ↓
Statistics
```

A player's:

-   Goals
-   Assists
-   Yellow cards
-   Red cards
-   Appearances
-   Minutes
-   Clean sheets

should be scoped to a season.

For example:

``` text
Cole Palmer
----------------
VUNA League 2025
Goals: 12

VUNA League 2026
Goals: 18
```

The system should never combine the two when displaying season
statistics.

------------------------------------------------------------------------

# 16. Standings

Standings are also season-specific.

``` text
standings
---------
id
seasonId
teamId
played
won
drawn
lost
goalsFor
goalsAgainst
goalDifference
points
position
```

The system should calculate:

``` text
WHERE seasonId = currentSeasonId
```

Never calculate standings using only `competitionId`.

------------------------------------------------------------------------

# 17. Competition Dashboard UX

The competition dashboard should be centered around the competition and
season selector.

Example:

``` text
VUNA LEAGUE
────────────────────────────

Season
[ 2026 ▼ ]

Overview
Teams
Fixtures
Results
Standings
Players
Statistics
```

When the user selects:

``` text
2025
```

all content changes to the 2025 context.

When the user selects:

``` text
2026
```

all content changes to the 2026 context.

------------------------------------------------------------------------

# 18. Recommended URL / Route Structure

Use the hierarchy in your application routes.

For example:

``` text
/competitions/vuna-league
```

Competition overview.

Then:

``` text
/competitions/vuna-league/seasons/2026
```

Season overview.

Then:

``` text
/competitions/vuna-league/seasons/2026/standings
/competitions/vuna-league/seasons/2026/fixtures
/competitions/vuna-league/seasons/2026/results
/competitions/vuna-league/seasons/2026/teams
/competitions/vuna-league/seasons/2026/players
/competitions/vuna-league/seasons/2026/statistics
```

This makes the application structure very clear.

------------------------------------------------------------------------

# 19. Backend Authorization

Every request must respect the tenant and season hierarchy.

For example:

``` text
Authenticated User
        ↓
Organization
        ↓
Competition
        ↓
Season
        ↓
Requested Resource
```

A request should not be allowed simply because the user knows the
resource ID.

For example, this is unsafe:

``` http
GET /matches/match_123
```

and trusting only `match_123`.

The backend should verify:

``` text
User belongs to Organization X

        ↓

Match belongs to Season Y

        ↓

Season belongs to Competition Z

        ↓

Competition belongs to Organization X
```

Only then should the request succeed.

------------------------------------------------------------------------

# 20. Multi-Tenant Isolation

The complete hierarchy should be:

``` text
Organization
    │
    └── Competition
          │
          └── Season
                │
                ├── Season Teams
                │
                ├── Player Registrations
                │
                ├── Fixtures
                │
                ├── Matches
                │
                ├── Match Events
                │
                ├── Standings
                │
                └── Statistics
```

This provides two levels of isolation:

### Tenant isolation

Organization A cannot access Organization B's competitions.

### Season isolation

VUNA 2026 cannot access or modify VUNA 2025 data.

------------------------------------------------------------------------

# 21. Creating a New Competition

When an organization creates a competition:

``` text
Create Competition
        ↓
Organization ID automatically assigned
        ↓
Create Competition
        ↓
Create first Season
```

Recommended UX:

``` text
Create Competition

Competition Name
[ VUNA League ]

Competition Type
[ League ]

Season
[ 2026 ]

Start Date
[ ... ]

End Date
[ ... ]

[ Create Competition ]
```

The system creates:

``` text
Competition:
VUNA League

Season:
2026
```

This removes the need for the administrator to manually understand the
underlying data structure.

------------------------------------------------------------------------

# 22. Adding a New Season

From the competition page:

``` text
VUNA League

[ + Add Season ]
```

Form:

``` text
Season Name
[ 2027 ]

Start Date
[ ... ]

End Date
[ ... ]

[ Create Season ]
```

The system creates:

``` text
VUNA League
    ├── 2025
    ├── 2026
    └── 2027
```

------------------------------------------------------------------------

# 23. Season Lifecycle

Recommended statuses:

``` text
DRAFT
UPCOMING
ACTIVE
COMPLETED
ARCHIVED
```

Example:

``` text
2026 Season
Status: ACTIVE
```

After the competition ends:

``` text
2026 Season
Status: COMPLETED
```

The season becomes read-only or mostly read-only depending on the
organization's permissions.

------------------------------------------------------------------------

# 24. Current Season

Each competition should have one current season.

Example:

``` text
VUNA League
Current Season: 2026
```

Recommended field:

``` text
competitions.currentSeasonId
```

When a new season becomes active:

``` text
currentSeasonId = season_2027
```

This allows the frontend to automatically display the current season.

------------------------------------------------------------------------

# 25. Season Copy / Rollover Feature

A useful future feature is:

``` text
Create New Season From Previous Season
```

For example:

``` text
VUNA League 2026

[ Create 2027 Season ]
```

The system can copy:

-   Participating teams
-   Competition rules
-   Points system
-   Match format
-   Number of rounds
-   Default venues
-   Competition branding

But it should **not blindly copy**:

-   Match results
-   Standings
-   Match events
-   Player statistics
-   Historical scores

Those belong exclusively to the previous season.

------------------------------------------------------------------------

# 26. Recommended Data Rules

The following rules should be enforced at the database and application
levels.

### Rule 1

Every competition belongs to exactly one organization.

``` text
competition.organizationId
```

### Rule 2

Every season belongs to exactly one competition.

``` text
season.competitionId
```

### Rule 3

Every fixture belongs to exactly one season.

``` text
fixture.seasonId
```

### Rule 4

Every match belongs to exactly one season.

``` text
match.seasonId
```

### Rule 5

Every match event belongs to exactly one match.

``` text
matchEvent.matchId
```

### Rule 6

Every season team belongs to exactly one season.

``` text
seasonTeam.seasonId
```

### Rule 7

Every season player registration belongs to a season-specific team.

``` text
seasonTeamPlayer.seasonTeamId
```

### Rule 8

Standings must always be calculated within one season.

### Rule 9

Player statistics must always be scoped to a season.

### Rule 10

A user must never be able to access a resource outside their
organization.

------------------------------------------------------------------------

# 27. Example Complete Data Relationship

``` text
Organization
└── Veritas University
    │
    └── Competition
        └── VUNA League
            │
            ├── Season 2025
            │   ├── Celtic FC
            │   ├── Engineering FC
            │   ├── Medicine FC
            │   ├── Fixtures
            │   ├── Matches
            │   ├── Match Events
            │   ├── Standings
            │   └── Statistics
            │
            └── Season 2026
                ├── Celtic FC
                ├── Engineering FC
                ├── Medicine FC
                ├── Fixtures
                ├── Matches
                ├── Match Events
                ├── Standings
                └── Statistics
```

Even if the same team appears in both seasons, its season-specific data
remains isolated.

------------------------------------------------------------------------

# 28. API Design

Recommended endpoints:

``` http
GET /api/competitions
POST /api/competitions

GET /api/competitions/:competitionId
PATCH /api/competitions/:competitionId

GET /api/competitions/:competitionId/seasons
POST /api/competitions/:competitionId/seasons

GET /api/seasons/:seasonId
PATCH /api/seasons/:seasonId

GET /api/seasons/:seasonId/teams
POST /api/seasons/:seasonId/teams

GET /api/seasons/:seasonId/fixtures
POST /api/seasons/:seasonId/fixtures

GET /api/seasons/:seasonId/matches
GET /api/seasons/:seasonId/standings

GET /api/seasons/:seasonId/statistics
```

The season should become the primary context for competition operations.

------------------------------------------------------------------------

# 29. Frontend State Management

The frontend should maintain an active competition and active season.

Example:

``` ts
const competitionId = "comp_vuna";
const seasonId = "season_2026";
```

Every competition-related request should use that context.

For example:

``` ts
fetchStandings(seasonId);
fetchFixtures(seasonId);
fetchTeams(seasonId);
fetchStatistics(seasonId);
```

Avoid having separate pages independently guessing which season they
should display.

------------------------------------------------------------------------

# 30. Season Context Provider

For a React/Next.js application, consider maintaining a season context.

Conceptually:

``` tsx
<CompetitionProvider competitionId={competitionId}>
    <SeasonProvider seasonId={seasonId}>
        <CompetitionDashboard />
    </SeasonProvider>
</CompetitionProvider>
```

Then child components can access:

``` ts
const { competition } = useCompetition();
const { season } = useSeason();
```

This makes season switching consistent throughout the dashboard.

------------------------------------------------------------------------

# 31. Preventing Cross-Season Data Bugs

A common mistake is:

``` ts
Team.find({ competitionId })
```

This can return teams from every season.

Instead:

``` ts
SeasonTeam.find({ seasonId })
```

Similarly, avoid:

``` ts
Match.find({ competitionId })
```

Prefer:

``` ts
Match.find({ seasonId })
```

And avoid:

``` ts
Statistics.find({ playerId })
```

when displaying season statistics.

Prefer:

``` ts
Statistics.find({
    playerId,
    seasonId
});
```

The season should be part of every relevant query.

------------------------------------------------------------------------

# 32. Indexing

For performance, create indexes around the hierarchy.

Recommended indexes:

``` text
competitions
INDEX organizationId

seasons
INDEX competitionId
UNIQUE competitionId + name

season_teams
INDEX seasonId
UNIQUE seasonId + teamId

fixtures
INDEX seasonId
INDEX seasonId + matchDate

matches
INDEX seasonId

match_events
INDEX matchId
INDEX matchId + minute
```

For MongoDB, use compound indexes where appropriate.

Example:

``` js
db.seasons.createIndex(
  { competitionId: 1, name: 1 },
  { unique: true }
);

db.seasonTeams.createIndex(
  { seasonId: 1, teamId: 1 },
  { unique: true }
);

db.fixtures.createIndex(
  { seasonId: 1, matchDate: 1 }
);
```

------------------------------------------------------------------------

# 33. Migration Strategy

If the existing MVP currently treats each league/year as a separate
competition, migrate it gradually.

Current:

``` text
VUNA League 2025
VUNA League 2026
```

Convert to:

``` text
VUNA League
    ├── 2025
    └── 2026
```

Migration steps:

1.  Create the new `seasons` collection/table.
2.  Create a single parent competition for each recurring league.
3.  Create a season record for every historical competition/year.
4.  Connect existing teams to the appropriate season.
5.  Connect fixtures to the correct season.
6.  Connect matches to the correct season.
7.  Connect match events to their matches.
8.  Recalculate season-specific standings.
9.  Recalculate season-specific player statistics.
10. Update API queries to use `seasonId`.
11. Update frontend routes and season selectors.
12. Test historical data isolation.

Do not delete historical records during migration.

------------------------------------------------------------------------

# 34. MVP Implementation Priority

Implement this architecture in the following order.

## Phase 1 --- Core Data Model

-   [ ] Add `Competition`
-   [ ] Add `Season`
-   [ ] Add `seasonId` to competition-specific resources
-   [ ] Create `SeasonTeam`
-   [ ] Create `SeasonTeamPlayer`
-   [ ] Add appropriate indexes and constraints

## Phase 2 --- Backend

-   [ ] Competition CRUD
-   [ ] Season CRUD
-   [ ] Season activation
-   [ ] Season switching
-   [ ] Season-scoped team queries
-   [ ] Season-scoped fixture queries
-   [ ] Season-scoped match queries
-   [ ] Season-scoped statistics
-   [ ] Season-scoped standings
-   [ ] Tenant authorization checks

## Phase 3 --- Frontend

-   [ ] Competition dashboard
-   [ ] Season selector
-   [ ] Current season indicator
-   [ ] Season overview
-   [ ] Season-specific teams
-   [ ] Season-specific fixtures
-   [ ] Season-specific results
-   [ ] Season-specific standings
-   [ ] Season-specific statistics

## Phase 4 --- Historical Data

-   [ ] Previous season navigation
-   [ ] Historical standings
-   [ ] Historical player statistics
-   [ ] Historical team records
-   [ ] Season archive

## Phase 5 --- Future Enhancement

-   [ ] Create season from previous season
-   [ ] Season rollover
-   [ ] Season templates
-   [ ] Season comparison
-   [ ] Historical analytics
-   [ ] Competition records
-   [ ] All-time player statistics

------------------------------------------------------------------------

# 35. Final Recommended Architecture

The final model should be:

``` text
                    ORGANIZATION
                         │
                         │
                  ┌──────▼──────┐
                  │ Competition │
                  │ VUNA League │
                  └──────┬──────┘
                         │
             ┌───────────┼───────────┐
             │           │           │
        ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
        │ 2025    │ │ 2026    │ │ 2027    │
        │ Season  │ │ Season  │ │ Season  │
        └────┬────┘ └────┬────┘ └────┬────┘
             │           │           │
          Teams       Teams       Teams
          Players     Players     Players
          Fixtures    Fixtures    Fixtures
          Matches     Matches     Matches
          Events      Events      Events
          Standings   Standings   Standings
          Stats       Stats       Stats
```

## The key architectural principle

**Competition is the long-term identity. Season is the data boundary for
each edition of that competition.**

Therefore:

``` text
Organization
    ↓
Competition
    ↓
Season
    ↓
Season Teams
    ↓
Players / Fixtures / Matches
    ↓
Match Events
    ↓
Statistics / Standings
```

This approach gives the platform a professional football-management
structure while making the product much easier for organizations to
understand and use.

A university administrator should think:

> "I manage the VUNA League."

not:

> "I created a new competition called VUNA League 2026."

Then, every year, they simply create or activate the next season.

That distinction should become a foundational part of the system's
domain model before expanding the MVP further.
