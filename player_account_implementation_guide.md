# ⚽ Player Account Feature — Step-by-Step Implementation Guide

# Football Management Web Application
## Player Account System Implementation Guide

Version: 1.0
Project: Football Management Web Application
Module: Player Account System

---

# 📌 Overview

This guide explains how to implement a new Player Account Role into the Football Management Web Application.

The system currently supports:
1. Super Admin
2. Team Account

This implementation introduces:
3. Player Account

The Player Account allows football players to:
- Access personal dashboards
- View fixtures and lineups
- Track performance statistics
- Receive notifications
- Manage profile information

---

# 🎯 Goals of the Player Account System

The Player module should provide:
- Secure player authentication
- Personalized dashboard
- Player performance tracking
- Team lineup visibility
- Training schedules
- Notifications system
- Career profile management

---

# 🧱 PHASE 1 — Database Design

## Step 1: Update User Roles

Add a new role type:

```ts
role: "super_admin" | "team" | "player"
```

---

## Step 2: Update Users Table

```sql
ALTER TABLE users
ADD COLUMN role VARCHAR(20) DEFAULT 'player';
```

---

## Step 3: Create Player Profiles Table

```sql
CREATE TABLE player_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    full_name VARCHAR(255),
    jersey_number INTEGER,
    position VARCHAR(50),
    nationality VARCHAR(100),
    profile_photo TEXT,
    bio TEXT,
    height VARCHAR(20),
    weight VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Step 4: Create Player Statistics Table

```sql
CREATE TABLE player_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES player_profiles(id),
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    average_rating DECIMAL(3,1) DEFAULT 0,
    minutes_played INTEGER DEFAULT 0
);
```

---

## Step 5: Create Notifications Table

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Step 6: Create Training Schedule Table

```sql
CREATE TABLE training_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id),
    training_date TIMESTAMP,
    activity TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 🧱 PHASE 2 — Backend Implementation

## Step 7: Create Player Authentication Routes

```js
POST /auth/player/register
POST /auth/player/login
GET  /player/profile
```

---

## Step 8: Implement JWT Authentication

```bash
npm install jsonwebtoken bcryptjs
```

---

## Step 9: Create Player Middleware

```js
const playerMiddleware = (req, res, next) => {
    if (req.user.role !== "player") {
        return res.status(403).json({
            message: "Access denied"
        });
    }

    next();
};
```

---

## Step 10: Create Player Controller

Features:
- Get player profile
- Update profile
- Fetch player stats
- Fetch fixtures
- Fetch notifications

---

## Step 11: Create Player API Endpoints

```js
GET    /player/dashboard
GET    /player/stats
GET    /player/fixtures
GET    /player/team
GET    /player/lineups
GET    /player/notifications
PUT    /player/profile
```

---

# 🧱 PHASE 3 — Frontend Implementation

## Step 12: Create Player Dashboard Layout

Sidebar Navigation:
- Dashboard
- My Stats
- Fixtures
- Team
- Training
- Notifications
- Profile
- Settings

---

## Step 13: Create Dashboard Widgets

### Performance Cards
- Goals
- Assists
- Average Rating
- Appearances

### Match Widgets
- Upcoming Match
- Last Match Result
- Team Position

### Notifications Widget
- Team announcements
- Match reminders
- Injury alerts

---

## Step 14: Create Player Statistics Page

Sections:
- Goals scored
- Assists
- Minutes played
- Yellow/red cards
- Match ratings

---

## Step 15: Create Fixtures Page

Features:
- Upcoming matches
- Completed matches
- Match venues
- Kickoff times

---

## Step 16: Create Team Lineup Viewer

Features:
- Formation display
- Starting XI
- Substitutes
- Tactical layout

---

## Step 17: Create Notification Center

Features:
- Mark as read
- Real-time updates
- Team messages
- Match reminders

---

# 🧱 PHASE 4 — Real-Time Features

## Step 18: Install Socket.IO

```bash
npm install socket.io
```

---

## Step 19: Implement Real-Time Notifications

Examples:
- Match starting soon
- Added to lineup
- Injury updates
- Goal milestone achieved

---

## Step 20: Implement Live Match Updates

Players should see:
- Live scores
- Match events
- Substitutions
- Cards

---

# 🧱 PHASE 5 — Security & Permissions

## Step 21: Restrict Player Permissions

Players CANNOT:
- Edit fixtures
- Edit teams
- Update match results
- Manage league table

Players CAN:
- Edit their profile
- View team information
- View statistics

---

## Step 22: Secure API Routes

```js
router.use(authMiddleware);
router.use(playerMiddleware);
```

---

# 🧱 PHASE 6 — Optional Advanced Features

## Step 23: Add Career Profile System

Features:
- Public player page
- Career statistics
- Achievements
- Highlights

Example URL:

```bash
/player/cristiano-ronaldo
```

---

## Step 24: Add Training Module

Features:
- Training schedules
- Attendance tracking
- Fitness records

---

## Step 25: Add AI Analytics (Future)

Examples:
- AI match ratings
- Heatmaps
- Performance analysis
- Strength/weakness analysis

---

# 📊 Recommended Player Dashboard Structure

```bash
Player Dashboard
│
├── Overview
├── Statistics
├── Fixtures
├── Team
├── Training
├── Notifications
├── Profile
└── Settings
```

---

# 🔐 Recommended Permissions Matrix

| Feature | Super Admin | Team Account | Player |
|---|---|---|---|
| Manage League | ✅ | ❌ | ❌ |
| Manage Teams | ✅ | ✅ | ❌ |
| Manage Players | ✅ | ✅ | ❌ |
| View Fixtures | ✅ | ✅ | ✅ |
| View Statistics | ✅ | ✅ | ✅ |
| Edit Own Profile | ❌ | ❌ | ✅ |
| View Team Lineup | ✅ | ✅ | ✅ |
| Receive Notifications | ✅ | ✅ | ✅ |

---

# 🚀 Recommended Development Order

## Phase 1
- Database updates
- Authentication
- Player role creation

## Phase 2
- Player dashboard
- Player stats
- Fixtures page

## Phase 3
- Notifications
- Training module
- Real-time updates

## Phase 4
- AI analytics
- Media uploads
- Public player profile

---

# 🎨 UI Recommendations

Follow the existing UI design:
- Orange accents (#E8631A)
- Dark sidebar (#1A2A6C)
- Card-based dashboard
- Responsive mobile-first layout

Player pages should feel similar to:
- FIFA Ultimate Team
- Sofascore
- EA Sports FC dashboards

---

# ✅ Final Notes

This Player Account feature transforms the platform into a complete football ecosystem.

Benefits:
- Better player engagement
- More realistic football operations
- Scalable architecture
- Improved user retention
- Professional football management experience

The Player Account system should remain:
- Secure
- Lightweight
- Performance-focused
- Mobile responsive

---

# 📌 End of Implementation Guide
