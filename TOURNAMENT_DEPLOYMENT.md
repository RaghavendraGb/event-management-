# Real-Time Knockout Tournament System - Deployment Guide

## 🎯 Overview

The Rapid Fire event type has been redesigned with a new **tournament mode** that enables 1v1 bracket-style competitions with automatic pairing, round progression, and elimination.

**Two Modes Available:**
- **Traditional**: Sequential rapid fire (existing behavior)
- **Knockout Tournament**: 1v1 bracket with elimination rounds

---

## 📋 Deployment Steps

### Step 1: Apply Database Schema Patch

In Supabase Dashboard → SQL Editor, paste and execute the contents of:
```
database/tournament_knockout_patch.sql
```

**What it creates:**
- Tournament session management tables
- Match and player state tracking
- Round progression system
- Winner determination functions
- RLS policies for security
- Auto-update triggers

**Key Tables:**
- `tournament_sessions` - Global tournament state
- `tournament_rounds` - Per-round metadata
- `tournament_matches` - Individual 1v1 matchups
- `tournament_player_state` - Per-player progression
- `tournament_answers` - Answer submissions
- New columns: `events.rapid_fire_style`, `events.tournament_enabled`

### Step 2: Deploy Edge Function

In terminal at project root:
```bash
supabase functions deploy tournament-knockout-engine
```

**Endpoint:** `supabase/functions/tournament-knockout-engine/index.ts`

**Actions Supported:**
- `init_tournament` - Bootstrap tournament from registered participants
- `bootstrap` - Get current tournament state (player, match, question, leaderboard)
- `heartbeat` - Periodic sync (same as bootstrap)
- `submit_answer` - Submit answer, determine winner if both answered
- `start_next_round` - Pair remaining winners for next round

### Step 3: Verify Frontend Integration

The following components are automatically integrated:

**New Components:**
- `src/components/live/TournamentKnockout.jsx` - Main orchestrator
- `src/components/live/TournamentPlaying.jsx` - 1v1 match UI
- `src/components/live/TournamentWaiting.jsx` - Waiting for next round
- `src/components/live/TournamentResults.jsx` - Final winner display

**Modified Files:**
- `src/pages/live/LiveEvent.jsx` - Adds tournament routing
- `src/pages/admin/AdminEvents.jsx` - Adds rapid_fire_style selector

**Automatic Routing:**
When `type='rapid_fire'` and `rapid_fire_style='knockout_tournament'`, LiveEvent renders TournamentKnockout.

---

## 🎮 Admin Usage

### Creating a Tournament Event

1. **Go to Admin → Events**
2. **Add New Event** → Set:
   - Title: "Tournament Championship"
   - Type: **Rapid Fire**
   - Rapid Fire Style: **Knockout Tournament (1v1 Bracket)** ← **NEW**
   - Add 10-20 questions from the question bank
3. **Save Event**
4. **Assign Questions** - Guided question selection
5. **Go Live** - Tournament starts

### Admin Controls During Tournament

**In Admin Dashboard:**
- Monitor tournament progress
- View live leaderboard
- See match results in real-time
- (Optional) End tournament if needed

**Tournament automatically:**
- ✅ Initializes bracket on tournament start
- ✅ Pairs players fairly (random shuffle)
- ✅ Assigns same question to both players in match
- ✅ Determines winner (correct > speed > first-to-answer)
- ✅ Advances winners to next round
- ✅ Handles odd participant counts (bye system)
- ✅ Ends when 1 winner remains

---

## 🎯 Tournament Flow

```
1. Admin creates Rapid Fire event with "Knockout Tournament" style
2. Participants register for event
3. Event goes live → Tournament initializes
4. Round 1: Players paired, matches run simultaneously
5. Both players answer same question
6. Winner determined by: correctness > speed > first-submit
7. Loser eliminated, winner advances
8. Round 2: Winners paired again
9. Process repeats until 1 player remains
10. Final winner announced with stats
```

---

## 📊 Player Experience

### Waiting to Play
- "⏳ Waiting for Next Round" screen
- Live leaderboard showing top players
- Your current stats displayed
- Remaining match count shown

### During Match (1v1)
- Question displayed large (centered)
- Countdown timer (30s default)
- 4 answer options in 2×2 grid
- Opponent name shown
- Live leaderboard sidebar
- Your rank, wins, score displayed
- Time-based updates every 1s

### After Match
- Result shown: "You advanced!" or "Eliminated"
- Score calculation: `max(0, 1000 - (timeTaken_ms × 0.25))`
- Back to waiting state for next round

### After Tournament
- Final ranking displayed
- 🥇 Champion announced
- Your final stats and rank
- Leaderboard with all participants
- Download stats / share results

---

## 🔧 Technical Details

### Pairing Algorithm
1. Shuffle all remaining players (random)
2. Group into pairs: [Player1-Player2, Player3-Player4, ...]
3. If odd count: last player gets bye (auto-advances)
4. Creates match records with `player1_id` and `player2_id`

### Winner Determination
**Priority Order:**
1. **Both correct?** → Faster player wins
2. **One correct?** → Correct answer wins
3. **Both wrong?** → First to submit wins
4. **Both timed out?** → No winner (theoretically)

### Scoring
```
score = max(0, 1000 - (timeTaken_seconds × scoringFactor))
Default scoringFactor = 25 (configurable)

Example:
- Answered in 2s: 1000 - 50 = 950 points
- Answered in 10s: 1000 - 250 = 750 points
- Answered in 40s+: 0 points
```

### Round Completion
- Next round starts ONLY when ALL matches in current round complete
- Prevents players from advancing before seeing all results
- Ensures fair, synchronized progression

### Special Cases

**1 Player:**
- Auto-winner (no match created)

**2 Players:**
- Single final match
- Winner declared

**3 Players:**
- Round 1: 1 gets bye, 2 play match
- Round 2: Bye player + match winner play final

**Odd Count:**
- Last player in shuffle gets bye
- Others paired and play

---

## 🛡️ Anti-Cheat & Security

### Built-In Protections
- Server-authoritative answer validation
- Answer submitted timestamp verified
- Timer managed server-side
- RLS policies enforce user data isolation
- No answer leakage to client before submission

### Future Enhancements (Optional)
- Tab-switch violation tracking
- Copy/paste prevention
- Rate limiting on answer submissions
- IP-based anomaly detection

---

## 📱 Responsive Design

**Desktop:**
- Full-width layout with opponent info on left, leaderboard on right
- 2×2 answer grid

**Mobile:**
- Stacked layout
- Single-column answer buttons
- Compact leaderboard
- Large timer for easy reading

---

## 🧪 Testing Checklist

- [ ] Tournament initializes with 4+ participants
- [ ] Both players in match see same question
- [ ] Timer counts down correctly
- [ ] Answer submission recorded and locked
- [ ] Winner determined correctly (correctness > speed)
- [ ] Players advanced to waiting state
- [ ] Next round pairs new winners correctly
- [ ] Bye system works for odd player counts
- [ ] Final winner announced correctly
- [ ] Leaderboard shows correct rankings
- [ ] RLS prevents cross-participant data access
- [ ] Admin can view all tournament stats

---

## 🚀 Performance Optimizations

- Tournament state synced every 1s (heartbeat)
- Match answers locked immediately after submission
- Winner determination is atomic (no race conditions)
- RLS queries optimized with indexes
- Leaderboard limited to top 5 by default

---

## 📞 Troubleshooting

**"Tournament not found"**
- Check event exists and is live
- Verify player is registered

**"No active match found"**
- Player may be waiting for next round
- Check player status in DB

**"Match already completed"**
- Player may have already submitted
- Reload page to sync state

**"Unauthorized"**
- Only event admin can init/manage tournament
- Check user role in auth

**Winner not advancing**
- Check both players submitted answers
- Verify answer is correct against question_bank.correct_answer

---

## 📦 Files Created/Modified

**New Files:**
```
database/tournament_knockout_patch.sql          (540 lines)
supabase/functions/tournament-knockout-engine/index.ts (620 lines)
src/components/live/TournamentKnockout.jsx      (120 lines)
src/components/live/TournamentPlaying.jsx       (180 lines)
src/components/live/TournamentWaiting.jsx       (160 lines)
src/components/live/TournamentResults.jsx       (200 lines)
```

**Modified Files:**
```
src/pages/live/LiveEvent.jsx                    (+TournamentKnockout import & routing)
src/pages/admin/AdminEvents.jsx                 (+rapid_fire_style field & selector)
```

---

## ✅ Implementation Complete

✨ Real-Time Knockout Tournament System is ready for deployment!

**Next Steps:**
1. Execute SQL patch
2. Deploy edge function
3. Create tournament event in admin
4. Go live and watch the bracket unfold

Enjoy tournament mode! 🏆
