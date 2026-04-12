# 🎮 "You & Me" 1v1 Competitive Game Mode - Deployment Guide

## Overview
The **"You & Me"** mode is a real-time 1v1 competitive game combining **strategy** (question selection) with **quiz knowledge**. Players take turns selecting questions for their opponent, answering under time pressure, and progressing through tie-break rounds if scores are equal.

---

## 📋 DEPLOYMENT CHECKLIST

### Phase 1: Database Setup
- [ ] Execute `database/youandme_patch.sql` in Supabase SQL Editor
- [ ] Verify all tables created: `youandme_sessions`, `youandme_rounds`, `youandme_selections`, `youandme_answers`, `youandme_player_state`
- [ ] Confirm helper functions: `youandme_init_match`, `youandme_get_available_questions`, `youandme_select_question`, `youandme_submit_answer`, `youandme_evaluate_scores`
- [ ] Test RLS policies are active on all tables

### Phase 2: Edge Function Deployment
- [ ] Deploy `supabase/functions/youandme-engine/index.ts`
  ```bash
  supabase functions deploy youandme-engine
  ```
- [ ] Verify deployment at Supabase Dashboard → Functions
- [ ] Test function with: `curl https://<PROJECT_ID>.supabase.co/functions/v1/youandme-engine`

### Phase 3: Frontend Integration
- [ ] Verify all React components exist:
  - `src/components/live/YouAndMeMatch.jsx` (orchestrator)
  - `src/components/live/YouAndMeSelection.jsx` (Q selection UI)
  - `src/components/live/YouAndMeAnswering.jsx` (Answer UI)
  - `src/components/live/YouAndMeWaiting.jsx` (Wait screen)
  - `src/components/live/YouAndMeTieBreak.jsx` (Tie-break UI)
  - `src/components/live/YouAndMeResults.jsx` (Results screen)
- [ ] Verify routing in `LiveEvent.jsx` includes `youandme` type check
- [ ] Verify admin controls in `AdminEvents.jsx` include `youandme_enabled` field

### Phase 4: Testing
- [ ] Create test "You & Me" event in admin panel
- [ ] Select "You & Me Duel" as deployment type
- [ ] Add 5-10 questions to the event
- [ ] Invite 2 test participants
- [ ] Test game flow:
  - [ ] Selection phase (30s countdown, auto-select)
  - [ ] Answering phase (30s countdown, scoring)
  - [ ] Score evaluation (determine if tie)
  - [ ] Tie-break round 1 (3 questions, 20s each)
  - [ ] Tie-break round 2 (1 question, 15s) if still tied
  - [ ] Sudden death (if needed)
  - [ ] Results display
- [ ] Verify opponent info displays correctly
- [ ] Verify leaderboard updates in real-time
- [ ] Test disconnect/reconnect scenarios

---

## 🎮 GAME FLOW

### Match Initialization
```
Players paired → Session created → Question pool loaded → 
State initialized → Start Selection Round 1
```

### Phase 1: Question Selection + Answering (All Questions)
```
SELECTION ROUND (Player A)
├─ Displays: Available questions (grid)
├─ Time:      30 seconds
├─ Action:    Select 1 question OR auto-select if timeout
└─ Lock:      Question becomes unavailable

ANSWERING ROUND (Player B)
├─ Displays:  Selected question + 4 options
├─ Time:      30 seconds
├─ Actions:   Click option OR timeout = wrong
├─ Scoring:   Correct = 1000 - (timeTaken_sec × 25)
└─ Next:      Reverse roles, repeat

Loop until all questions answered
```

### Phase 2: Score Evaluation
```
Total Correct Answers Comparison:
├─ scoreA > scoreB → Player A wins   ✓ FINISHED
├─ scoreB > scoreA → Player B wins   ✓ FINISHED
└─ scoreA == scoreB → Proceed to Tie-Break ◄──┐
                                                │
                      ROUND 1 (3 quest., 20s) ──┴──► 
                      ROUND 2 (1 quest., 15s) if still tied
                      SUDDEN DEATH if needed
```

### Tie-Break: Round 1 (Best of 3 Questions)
```
Both players see same 3 questions
Time: 20 seconds per question
Winner: First to get 2+ correct

Continue to Round 2 if still tied after 3 Qs
```

### Tie-Break: Round 2 (Sudden Death Question)
```
Both players see same 1 question
Time: 15 seconds
Winner: 
  ├─ Both correct       → Continue to sudden death
  ├─ A correct, B wrong → A wins
  ├─ B correct, A wrong → B wins
  └─ Both wrong         → New question, repeat
```

### Results Display
```
Champion Screen (if you won):
├─ 🏆 Trophy animation
├─ Final score comparison
├─ Rank badges (🥇🥈🥉)
└─ Share / Download certificate

If you lost:
├─ Your final rank & stats
├─ Opponent info
├─ Full leaderboard
└─ Play again option
```

---

## ⚙️ DATABASE SCHEMA OVERVIEW

### youandme_sessions
- Global match state per event
- Tracks phase progression, total score, winner
- Status: pending → answering → evaluation → tie_break → ended

### youandme_selections
- Records who selected which question for whom
- Question locking mechanism (prevents reuse)

### youandme_answers
- Tracks each answer with phase, correctness, time
- Used for scoring calculations

### youandme_player_state
- Per-player status, stats, heartbeat tracking
- Final rank calculation

---

## 🔌 API ACTIONS (youandme-engine)

### `initMatch`
**Create a new You & Me session**
```json
{
  "action": "initMatch",
  "eventId": "uuid",
  "player1Id": "uuid",
  "player2Id": "uuid"
}
```
Returns: `sessionId`, `questionCount`

### `bootstrap`
**Fetch current game state** (used for sync/heartbeat)
```json
{
  "action": "bootstrap",
  "sessionId": "uuid",
  "playerId": "uuid"
}
```
Returns: Session state, player state, current question, available questions, leaderboard

### `selectQuestion`
**Player selects a question for opponent**
```json
{
  "action": "selectQuestion",
  "sessionId": "uuid",
  "questionId": "uuid",
  "playerId": "uuid"
}
```
Returns: Confirmation

### `submitAnswer`
**Player submits answer to question**
```json
{
  "action": "submitAnswer",
  "sessionId": "uuid",
  "phase": "selection_1|answering_1|selection_2|answering_2|tie_break_round1|...",
  "questionId": "uuid",
  "playerId": "uuid",
  "answer": "option text",
  "isCorrect": true|false,
  "timeMs": 5000
}
```
Returns: Correctness, phase completion status

### `heartbeat`
**Sync game state (called every 1 second)**
Returns same as `bootstrap`

### `evaluateScores`
**Manual trigger to evaluate scores and determine winner**
```json
{
  "action": "evaluateScores",
  "sessionId": "uuid"
}
```
Returns: Scores, winner, tie status

### `getTieBreakQuestions`
**Get questions for tie-break phase**
```json
{
  "action": "getTieBreakQuestions",
  "sessionId": "uuid",
  "round": 1|2|3  // sudden death = 3
}
```
Returns: Questions for tie-break

---

## 📊 SCORING FORMULA

**Standard Round:**
```
Score = MAX(0, 1000 - (timeTaken_seconds × 25))
```

**Winner Logic (Atomic - no ties within a match):**
1. **Correctness First**: Correct answer > wrong answer
2. **Speed Second**: If both correct → faster time wins
3. **First-to-Submit**: If both wrong → first submission wins

---

## 🌐 UI COMPONENTS

### YouAndMeMatch (Orchestrator)
- Manages game state machine
- Routes between Selection → Answering → Waiting → TieBreak → Results
- Handles 1s heartbeat sync

### YouAndMeSelection
- Grid of available questions
- 30s countdown timer (red≤5s, amber≤10s, blue>10s)
- Auto-select random if timeout
- Disabled questions (already selected)

### YouAndMeAnswering
- Large question display
- 4 options in 2×2 grid
- 30s countdown timer
- Opponent info sidebar
- Live leaderboard (top 3)
- Feedback: ✓ Correct / ✗ Incorrect

### YouAndMeWaiting
- "Waiting for Next Round" message
- Your progress stats
- Full leaderboard
- Tournament metrics

### YouAndMeTieBreak
- Similar to answering but with adjusted times
- Tie-break round indicator
- Versus box showing score comparison

### YouAndMeResults
- Champion announcement (if won) OR rank display
- Final leaderboard with medals (🥇🥈🥉)
- Share button, certificate download
- Option to play another match

---

## 🛡️ ANTI-CHEAT MECHANISMS

1. **Server-Authoritative Scoring**: All scoring calculated on backend
2. **Atomic Operations**: Winner determination uses `FOR UPDATE` locks
3. **Time Tracking**: Server clock (not client) for all timing
4. **Question Locking**: Once selected, question immediately unavailable
5. **Submission Locking**: Once answered, player cannot change response
6. **RLS Isolation**: Players only see their own data + leaderboard public data
7. **Heartbeat Validation**: Inactive players marked as disconnected

---

## 🔍  TROUBLESHOOTING

### Issue: Players not seeing opponent's selection
**Solution:** Check heartbeat interval (should be 1s), verify RLS policies on `youandme_selections`

### Issue: Questions appearing multiple times
**Solution:** Verify `youandme_get_available_questions` function filters selections correctly

### Issue: Scores not calculating
**Solution:** Check answers table has `is_correct` populated; verify scoring formula in components

### Issue: Tie-break not triggering
**Solution:** Check `youandme_evaluate_scores` function; verify tie detection logic (score equality)

### Issue: Disconnect/reconnect causes reset
**Solution:** Check session persistence, verify `bootstrapGame` properly recovers state

---

## 📈 PERFORMANCE CONSIDERATIONS

- **Heartbeat**: 1s sync interval (adjust if network heavy)
- **Question Pool**: Test with 50+ questions for scaling
- **Concurrent Matches**: Each match is isolated; scales horizontally
- **Database**: Indexes on `session_id`, `player_id` for fast queries

---

## 🚀 DEPLOYMENT COMMAND REFERENCE

```bash
# 1. Deploy edge function
supabase functions deploy youandme-engine

# 2. Build app (if needed)
npm run build

# 3. Run local tests
npm run test

# 4. Deploy to production
npm run deploy
```

---

## 📞 SUPPORT

- Questions about game flow? → See "GAME FLOW" section
- Database issues? → Check schema in `database/youandme_patch.sql`
- UI issues? → Check React component state management in `src/components/live/YouAndMe*.jsx`
- API issues? → Check edge function logs in Supabase dashboard

---

**You & Me is now ready for competitive play!** 🎮🏆
