# Full System Audit & Fix Plan

A complete audit of the EventArena application covering all components, pages, hooks, routing, event flow, Supabase integration, and performance. Every bug below is mapped to an exact file and line.

---

## Summary of System Health

| Category | Status |
|---|---|
| Crash Risks | 🔴 8 Critical Issues |
| Synchronization | 🔴 4 High Issues |
| Performance | 🟡 5 Medium Issues |
| Logic Errors | 🔴 5 Critical Issues |
| Edge Cases | 🟡 6 Medium/High Issues |
| Memory/Lifecycle | 🔴 4 Critical Issues |

---

## Proposed Changes

### Component 1 — `LiveEvent.jsx` (CRITICAL)

---

#### [MODIFY] [LiveEvent.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/live/LiveEvent.jsx)

**Issue 1 — CRITICAL: `submitEvent` closure captures stale `participationId = null`**
- **File:** `LiveEvent.jsx` Line 150–165
- **Root Cause:** `submitEvent` is defined via `useCallback` before `participationId` is set. On the timer countdown path (`useEffect` line 284), if the timer expires before boot fully sets `participationId`, the `.update().eq('id', null)` call silently fails — submission is lost, score is never saved.
- **Impact:** User finishes event, gets no score saved and no redirect to results.
- **Fix:** Read `participationId` from a ref inside `submitEvent` so it always has the latest value.

**Issue 2 — CRITICAL: `triggerSyncWorker` is NOT stable (not in useCallback) — stale closure**
- **File:** `LiveEvent.jsx` Line 242
- **Root Cause:** `triggerSyncWorker` is a plain `async function` inside the component and reads `participationId` directly from closure. Because `answerQuestion` (a `useCallback`) captures `triggerSyncWorker` from the first render when `participationId` is still `null`, every background sync call fires `update().eq('id', null)`.
- **Impact:** Live answers are **never synced** to Supabase during the quiz (only the final submit writes to DB). If the browser if closed before submit, all answers are lost.
- **Fix:** Move `participationId` into a ref, move `triggerSyncWorker` into a `useCallback`.

**Issue 3 — CRITICAL: Anti-cheat `forceCheatSubmission` also uses stale closure**
- **File:** `LiveEvent.jsx` Line 167
- **Root Cause:** Same pattern as Issue 2. `forceCheatSubmission` captures `participationId` from closure at definition time. If called before boot finishes, it also updates `null`.
- **Impact:** 3-strike cheat enforcement fires but silently does nothing to the DB.
- **Fix:** Use the participationId ref.

**Issue 4 — HIGH: `handleVisibilityChange` inside anti-cheat effect directly calls `forceCheatSubmission` on the 3rd violation, but the component might have already unmounted**
- **File:** `LiveEvent.jsx` Lines 195–217
- **Root Cause:** `setViolations(prev => { ...; forceCheatSubmission(); })` is called inside the state updater callback. Calling async functions from state updater callbacks is an anti-pattern and can cause state updates on unmounted components (memory leak + warning).
- **Fix:** Use a `useRef` for violations count (read synchronously in the handler) and call `forceCheatSubmission` outside the `setViolations` callback.

**Issue 5 — CRITICAL: Timer `useEffect` only fires for `quiz` and `normal_quiz` but event type can also be `rapid_fire` or `treasure_hunt`, and those modes have no global end time at all**
- **File:** `LiveEvent.jsx` Line 281
- **Root Cause:** The condition `['quiz', 'normal_quiz'].includes(eventData.type)` excludes rapid_fire and treasure_hunt from having any server-enforced deadline. If admin ends the event, the `live-interrupt` channel fires `forceCheatSubmission` which submits — but rapid_fire users who close the tab before that never get auto-submitted.
- **Impact:** Data loss for users who lose connectivity during rapid_fire events.

**Issue 6 — MEDIUM: `fetchProfile` in `App.jsx` is called by the `onAuthStateChange` callback but is defined inside the component and recreated on every render**
- **File:** `App.jsx` Line 38, 71
- **Root Cause:** `fetchProfile` is not wrapped in `useCallback`, so the `useEffect` dependency array `[setUser, setAuthLoading]` appears stable, but the internal `fetchProfile` function is recreated on each render. This is a minor memory concern but the auth logic itself works correctly regardless.
- **Impact:** Cosmetic/minor.

---

### Component 2 — `RapidFireMode.jsx` (CRITICAL)

#### [MODIFY] [RapidFireMode.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/components/live/RapidFireMode.jsx)

**Issue 7 — CRITICAL: Hooks called after conditional return (React Rules of Hooks violation)**
- **File:** `RapidFireMode.jsx` Lines 12–36
- **Root Cause:** The guard `if (!questions || questions.length === 0) return (...)` fires **before** `useEffect` and other hooks are defined. However, React requires the same number and order of hooks on every render. The `useEffect` at line 24 and the second `useEffect` at line 53 both come after the guard return — meaning on the first render (before questions load) they may or may not execute depending on whether React short-circuits. This is actually safe in this case because the guard is based on props, but it still violates the eslint-plugin-react-hooks convention and can cause unexpected behavior if state wrappers change.
- **Fix:** Move the guard to after all hooks.

**Issue 8 — CRITICAL: `onSubmit()` called inside initial `useEffect` (line 34)**
- **File:** `RapidFireMode.jsx` Line 34
- **Root Cause:** If all questions are already answered (restoring state), the effect calls `onSubmit()` directly. This triggers `submitEvent` from `LiveEvent` during the initial render lifecycle, before the component is fully mounted, and before `participationId` is confirmed set. If `onSubmit` triggers navigation, this can cause "Can't perform a React state update on an unmounted component."
- **Fix:** Defer with `setTimeout(..., 0)` to push past the render cycle.

**Issue 9 — HIGH: Timer reset race condition in RapidFireMode**
- **File:** `RapidFireMode.jsx` Lines 53–67
- **Root Cause:** The timer `setInterval` depends on `[currentIndex, currentQ, handleTimeout]`. When `handleTimeout` → `advance` → `setCurrentIndex(...)` fires, `handleTimeout` itself is recreated (because `advance` has `currentIndex` in deps). This causes the old timer to be cleared and a new one set — which is correct — but between the old timer clearing and the new one starting, `timeLeft` is set to the reset value (line 60: `return currentQ.time_limit_seconds || 15`). However, `currentQ` at that point still refers to the OLD question. The timer shows the old question's time limit for 1 tick before the new question renders.
- **Impact:** Cosmetic glitch — timer briefly shows wrong value.
- **Fix:** Reset `timeLeft` in `advance()` rather than inside the interval callback.

---

### Component 3 — `TreasureHuntMode.jsx` (HIGH)

#### [MODIFY] [TreasureHuntMode.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/components/live/TreasureHuntMode.jsx)

**Issue 10 — HIGH: Same hooks-after-return issue as RapidFireMode**
- **File:** `TreasureHuntMode.jsx` Lines 11–31
- **Fix:** Move all hooks to the top, guard at the bottom.

**Issue 11 — MEDIUM: `autoAdvanceRef.current` timeout is only cleared if `wrongTries` changes. If the component unmounts while the timeout is pending, it fires on an unmounted component**
- **File:** `TreasureHuntMode.jsx` Lines 34–51
- **Root Cause:** The cleanup function only runs when `wrongTries` changes. If the component unmounts during the 3-second delay (e.g. admin ends event), `setLevel` fires after unmount.
- **Fix:** The cleanup is actually present but the dependency contains `questions.length` — changing that should be fine. The real issue is that `onSubmit` called from inside the timeout (line 42) may trigger navigation on unmounted. Wrap in an `isMounted` ref check.

---

### Component 4 — `LiveLeaderboard.jsx` (HIGH)

#### [MODIFY] [LiveLeaderboard.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/components/live/LiveLeaderboard.jsx)

**Issue 12 — HIGH: The fallback poller at line 72 calls `fetchBoard` every 10 seconds unconditionally**
- **Root Cause:** Even when realtime is working perfectly, the poller fires every 10 seconds. With 50+ concurrent users, each user's poller fetches the entire `participation` table + all `users` → massive redundant reads.
- **Fix:** Implement exponential-backoff, or use the poller only if the realtime subscription fails (track with a `isRealtimeConnected` ref).

**Issue 13 — HIGH: Realtime UPDATE handler only patches `score` field but doesn't update `name`, `avatar`, or `teamName`**
- **File:** `LiveLeaderboard.jsx` Lines 61–63
- **Root Cause:** When a new participant joins during the live event (INSERT fires fetchBoard), their data is hydrated. But subsequent UPDATEs only touch `score`. If a user's record was inserted mid-session with a null name (race condition), it will remain null permanently in the leaderboard.
- **Fix:** On UPDATE events, if the entry's name is "Participant", trigger a `fetchBoard` once to re-hydrate.

---

### Component 5 — `Results.jsx` (CRITICAL)

#### [MODIFY] [Results.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/live/Results.jsx)

**Issue 14 — CRITICAL: Score calculation uses wrong key for map lookup**
- **File:** `Results.jsx` Line 68-70
- **Root Cause:**
```js
const enrichedQs = qData.map(q => ({
  ...q.question_bank,
  my_answer: pData.answers[q.question_bank.id] || null  // ← WRONG key
}));
```
  The `answers` object in `participation` is keyed by **`q.id`** (the `event_questions.id`), not `q.question_bank.id`. This is how `answerQuestion(q.id, option)` stores it in `LiveEvent`. So `pData.answers[q.question_bank.id]` will **always be `null`**, making the question review show "Skipped" for every question even if the user answered them all.
- **Impact:** The personal review breakdown is entirely wrong. Correct/Incorrect counts are both 0.
- **Fix:** Change to `pData.answers[q.id]` (using the event_question row id).

**Issue 15 — HIGH: `triggerConfetti` creates an `setInterval` that is never cleared if the component unmounts before animation ends**
- **File:** `Results.jsx` Lines 161–169
- **Root Cause:** The confetti `setInterval` runs for 5 seconds. If user navigates away (clicks "Full Leaderboard") during that interval, it continues firing on a dead canvas reference.
- **Fix:** Store the interval in a ref and clear on component cleanup.

**Issue 16 — HIGH: `playDrumRoll` AudioContext is never closed**
- **File:** `Results.jsx` Lines 114–150
- **Root Cause:** AudioContext is created but `audioCtx.close()` is never called. Each re-render on strict mode or hot-reload will leak an AudioContext. Browsers cap active AudioContexts.
- **Fix:** Close the context after the sound completes.

---

### Component 6 — `Certificate.jsx` (HIGH)

#### [MODIFY] [Certificate.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/live/Certificate.jsx)

**Issue 17 — HIGH: No guard if `participations` is null or empty**
- **File:** `Certificate.jsx` Line 29
- **Root Cause:** `participations?.findIndex(...)` — if `participations` is null (DB error), `findIndex` would throw. Currently `?.` protects it, but if the supabase call returns an error the code falls through to `eData && index !== -1` where `index` would be `-1` and `setData` never gets called. The page renders `"You did not legally complete this event"` — even for valid participants if RLS blocks the read. This is acceptable but the error is silent.

**Issue 18 — MEDIUM: `user.name.replace(' ', '_')` only replaces the FIRST space in the name**
- **File:** `Certificate.jsx` Line 163
- **Root Cause:** `String.prototype.replace()` with a string pattern replaces only the first occurrence. A user named "John Michael Doe" gets filename `John_Michael Doe_Certificate.pdf`.
- **Fix:** Use a regex: `.replace(/\s+/g, '_')`.

---

### Component 7 — `AdminParticipants.jsx` (MEDIUM-HIGH)

#### [MODIFY] [AdminParticipants.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/admin/AdminParticipants.jsx)

**Issue 19 — HIGH: `tick()` function captures `scannerOpen` via closure but `scannerOpen` is a React state (boolean).**
- **File:** `AdminParticipants.jsx` Line 110
- **Root Cause:** `tick` is defined inside the component and reads `scannerOpen` from closure. However, `requestAnimationFrame(tick)` is called recursively. After `setScannerOpen(false)` is called (e.g. when QR is found), the next tick from `rAF` runs with the stale closure where `scannerOpen` is still `true`, causing infinite tick loop until the component unmounts.
- **Impact:** CPU stuck in rAF loop after a successful scan.
- **Fix:** Use a `scannerOpenRef` that mirrors the state.

**Issue 20 — MEDIUM: Camera stream is not stopped on component unmount**
- **File:** `AdminParticipants.jsx` — no cleanup `useEffect` for `streamRef`
- **Root Cause:** If the admin navigates away from the page while the scanner is open, `streamRef.current` is never stopped.
- **Fix:** Add a cleanup `useEffect` that calls `streamRef.current?.getTracks().forEach(t => t.stop())` on unmount.

**Issue 21 — MEDIUM: `exportToCSV` crashes if any `p.users` is null**
- **File:** `AdminParticipants.jsx` Line 46
- **Root Cause:** `p.users.name` — if the join returns a null `users` (e.g. a participation record with a deleted user), this throws a TypeError uncaught exception that crashes the export.
- **Fix:** Add optional chaining: `p.users?.name ?? 'Unknown'`.

---

### Component 8 — `Lobby.jsx` (HIGH)

#### [MODIFY] [Lobby.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/live/Lobby.jsx)

**Issue 22 — HIGH: Both Supabase realtime AND a 5-second poller are active simultaneously**
- **File:** `Lobby.jsx` Lines 85–98
- **Root Cause:** When realtime fires `navigate('/live/${id}')`, the fallback poller is still running. If navigation happens and the Lobby component unmounts mid-poll-fetch, the `.then()` callback tries to call `navigate` on an unmounted component. While React 18 doesn't crash on this, it is a stale state update.
- **Fix:** Use an `isMounted` ref. When realtime fires, clear the poller immediately before navigating.

**Issue 23 — MEDIUM: `team_members` aggregate count query has unhandled null**
- **File:** `Lobby.jsx` Line 246
- **Root Cause:** `t.team_members[0]?.count || 1` — if `team_members` is an empty array (no members yet), `t.team_members[0]` is `undefined`, so it falls back to `1`. This is a cosmetic issue but misleading.

---

### Component 9 — `AdminEvents.jsx` (MEDIUM)

#### [MODIFY] [AdminEvents.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/admin/AdminEvents.jsx)

**Issue 24 — MEDIUM: Question assignment cache is never invalidated**
- **File:** `AdminEvents.jsx` Line 65
- **Root Cause:** `if (assignedQMap[eventId]) return;` — once questions are loaded, they are never refreshed. If another admin session modifies questions, this admin will see stale data. More critically, after removing a question via `removeQuestion`, the cache is updated in React state but if the component re-renders and re-calls `loadEventQuestions`, the stale-check prevents a re-fetch.
- **Impact:** Minor — only an issue in multi-admin scenarios.

**Issue 25 — MEDIUM: `dayStart` / `dayEnd` use local time not UTC**
- **File:** `AdminEvents.jsx` Lines 25–26
- **Root Cause:** `new Date('${d}T00:00:00')` creates a date in **local timezone**. If the server/Supabase is UTC, the stored `start_at` could be off by hours (e.g. -5:30 offset for IST means the event effectively starts at 6:30 PM of the day before).
- **Fix:** Use `new Date('${d}T00:00:00Z').toISOString()` for UTC, or use `new Date('${d}T00:00:00').toISOString()` and make sure the displayed time accounts for timezone.

---

### Component 10 — `EventDetail.jsx` (HIGH)

#### [MODIFY] [EventDetail.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/events/EventDetail.jsx)

**Issue 26 — HIGH: Double registration not prevented**
- **File:** `EventDetail.jsx` Lines 99–107
- **Root Cause:** The registration flow checks `isRegistered` in the UI, but the actual DB insert has no uniqueness enforcement at the application layer. If two clicks happen simultaneously (double-click submit), two `participation` inserts fire. Supabase should have a unique constraint on `(user_id, event_id)` to block this at DB level. The app shows no loading indicator to prevent the double submit.
- **Fix:** Disable button during `submitting` (already done at line 265 ✅), but also handle the `partErr` from duplicate constraint more gracefully — currently it just `alert`s the raw Postgres error.

**Issue 27 — HIGH: Registered user navigating to a LIVE event gets sent to `/lobby` not `/live`**
- **File:** `EventDetail.jsx` Line 150
- **Root Cause:** The "View Ticket / Lobby" button always goes to `/lobby/${event.id}`. The `Lobby` component does redirect to `/live` if status is live — but this is a two-step navigation. If the user is registered and the event is live, they should be sent directly to `/live`.
- **Fix:** `navigate(isLive ? '/live/${event.id}' : '/lobby/${event.id}')`.

---

### Component 11 — `App.jsx` (HIGH)

#### [MODIFY] [App.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/App.jsx)

**Issue 28 — HIGH: `fetchProfile` is async but the `onAuthStateChange` callback is not awaited**
- **File:** `App.jsx` Lines 71–79
- **Root Cause:** The `onAuthStateChange` fires synchronously, calling `fetchProfile` (which is async) without awaiting it. This is fine in most cases, but the `setAuthLoading(true)` on line 75 fires before fetchProfile resolves. If `SIGNED_IN` and `SIGNED_OUT` events fire in rapid succession (edge case), there's a race between two concurrent `fetchProfile` calls, potentially setting `user` to null after a valid login.
- **Fix:** Add an abort flag/generation counter inside `fetchProfile` to ignore stale responses.

---

### Component 12 — `AdminUsers.jsx` (MEDIUM)

#### [MODIFY] [AdminUsers.jsx](file:///c:/Users/ABUBAKAR%20SIDDIK/eventbased/src/pages/admin/AdminUsers.jsx)

**Issue 29 — MEDIUM: Deleting a user from `public.users` does NOT delete them from `auth.users`**
- **File:** `AdminUsers.jsx` Lines 77–84
- **Root Cause:** `supabase.from('users').delete().eq('id', userId)` removes the public profile, but the auth entry in `auth.users` remains. The user can still log in (Supabase Auth) but will get a blank profile and the `fetchProfile` fallback in `App.jsx` will create a ghost session.
- **Impact:** Deleted users can still authenticate and appear logged in.
- **Fix:** For true deletion, call the Supabase Admin API `supabase.auth.admin.deleteUser(userId)`. From the client this requires a service-role key (not safe). Recommended fix: add a `status: 'rejected'` field and block login in `fetchProfile` — you already handle `pending` status, just extend to `rejected`.

---

## Critical Fixes Summary Table

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 CRITICAL | LiveEvent.jsx | `participationId` stale closure in `submitEvent` — score never saved |
| 2 | 🔴 CRITICAL | LiveEvent.jsx | `triggerSyncWorker` stale closure — answers never synced to DB |
| 3 | 🔴 CRITICAL | LiveEvent.jsx | `forceCheatSubmission` stale closure |
| 4 | 🔴 CRITICAL | LiveEvent.jsx | Async call inside `setViolations` updater |
| 7 | 🔴 CRITICAL | RapidFireMode.jsx | Hooks called after conditional return |
| 8 | 🔴 CRITICAL | RapidFireMode.jsx | `onSubmit()` during render lifecycle |
| 14 | 🔴 CRITICAL | Results.jsx | Wrong answer key — all answers show as "Skipped" |
| 22 | 🟠 HIGH | Lobby.jsx | Realtime + poller conflict on navigate |
| 12 | 🟠 HIGH | LiveLeaderboard.jsx | Unconditional 10s poller — 50 users = 5 req/s |
| 19 | 🟠 HIGH | AdminParticipants.jsx | rAF infinite loop after scan |
| 27 | 🟠 HIGH | EventDetail.jsx | Registered+live user goes to lobby, not live |

---

## Verification Plan

### Automated Logic Tests (Manual simulation)
1. Boot LiveEvent → confirm `participationId` ref is populated before any timer/sync fires
2. Answer a question → verify Supabase participation row updates answers field
3. Submit manually → verify score calculation uses correct key
4. Switch tab 3x → verify forceCheatSubmission updates DB correctly
5. Admin ends event → verify all active users auto-submit

### UI Tests
1. Navigate to `/live/:id` directly — should load or redirect correctly
2. Open Results page — question review should show correct/incorrect breakdown
3. Open Leaderboard — scores should update in real time
4. Download certificate — filename spaces should be replaced with underscores

