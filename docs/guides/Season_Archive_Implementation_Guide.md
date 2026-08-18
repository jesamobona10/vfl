# Season Archive / Season Selector Implementation Guide

## Feature Overview

The **Season Archive** feature allows users to browse historical data for a competition by selecting any previous season. Every piece of competition data (fixtures, standings, statistics, awards, etc.) is tied to a specific season instead of being overwritten each year.

Example:

```text
Champions League
▼ 2024/2025

2024/2025
2023/2024
2022/2023
2021/2022
...
```

When a different season is selected, the application reloads the data belonging to that season.

---

# Architecture

```text
Competition
      │
      │ has many
      ▼
   Seasons
      │
      ├── Teams
      ├── Fixtures
      ├── Standings
      ├── Players
      ├── Player Stats
      ├── Awards
      └── Match Events
```

## Phase 1 — Database Design

### Competition
| Field | Type |
|---|---|
| id | UUID |
| name | String |
| logo | String |
| country | String |
| createdAt | Date |

### Season
| Field | Type |
|---|---|
| id | UUID |
| competitionId | FK |
| name | String |
| startDate | Date |
| endDate | Date |
| status | Upcoming / Active / Completed |
| isCurrent | Boolean |
| createdAt | Date |

### Team
Permanent team information only.

### SeasonTeam
| Field |
|---|
| id |
| seasonId |
| teamId |
| group |
| position |
| points |
| wins |
| draws |
| losses |
| goalsFor |
| goalsAgainst |
| goalDifference |

### Fixture
| Field |
|---|
| id |
| seasonId |
| round |
| homeTeam |
| awayTeam |
| venue |
| kickoff |
| status |
| homeGoals |
| awayGoals |

### MatchEvent
Goal, Yellow Card, Red Card, Substitution, Penalty, Own Goal.

### PlayerSeasonStats
Stores season-specific player statistics.

### SeasonAward
Stores awards like Top Scorer, Golden Boot, Best Goalkeeper, Player of the Tournament, etc.

---

# Phase 2 — Backend

Recommended modules:

- competitions
- seasons
- fixtures
- standings
- groups
- statistics
- awards
- players

### API Endpoints

- `GET /api/competitions/:competitionId/seasons`
- `GET /api/seasons/:seasonId`
- `GET /api/seasons/:seasonId/standings`
- `GET /api/seasons/:seasonId/fixtures`
- `GET /api/seasons/:seasonId/results`
- `GET /api/seasons/:seasonId/top-scorers`
- `GET /api/seasons/:seasonId/awards`

---

# Phase 3 — Admin Dashboard

1. Create Season
2. Register Teams
3. Generate Fixtures
4. Activate Current Season
5. Complete Season (lock editing)

---

# Phase 4 — Frontend

## Season Selector

```text
▼ 2024/2025
2023/2024
2022/2023
```

```tsx
const [selectedSeason, setSelectedSeason] = useState(currentSeason.id);

useEffect(() => {
  fetchStandings(selectedSeason);
  fetchFixtures(selectedSeason);
  fetchGroups(selectedSeason);
  fetchTopScorers(selectedSeason);
}, [selectedSeason]);
```

---

# Phase 5 — User Flow

1. Open competition.
2. Current season loads.
3. Select another season.
4. Reload standings, fixtures, results, statistics and awards.

---

# Phase 6 — Permissions

## Admin
- Create season
- Edit season
- Delete empty season
- Register teams
- Generate fixtures
- Update standings

## Coach / Player / Fan
- View only

---

# Phase 7 — Performance

- Load only the current season by default.
- Fetch archived seasons on demand.
- Add indexes on `competitionId` and `seasonId`.

---

# Phase 8 — Development Order

1. Create Competition and Season models.
2. Build Season CRUD APIs.
3. Add Season Selector UI.
4. Link football data to `seasonId`.
5. Update frontend API calls.
6. Add admin controls.
7. Lock completed seasons.
8. Test season switching.
9. Optimize database queries.

---

# Future Enhancements

- All-time statistics
- Season comparison
- Historical brackets
- Season timeline
- Record book
- PDF/CSV export
- Advanced filters
