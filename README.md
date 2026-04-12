# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Production Performance Patch

For better performance with many concurrent users, run the SQL patch:

1. Open Supabase SQL Editor.
2. Run `database/performance_indexes.sql`.

This adds read indexes used by live leaderboard, participation queries, admin screens, and chat timeline fetches.

## Realtime Treasure Hunt Rollout

To enable the new synchronized treasure hunt mode end-to-end:

1. Apply schema patch in Supabase SQL Editor:
	- database/treasure_hunt_realtime_patch.sql
2. Deploy edge function:
	- supabase functions deploy treasure-engine
3. Ensure environment variables are present for edge functions:
	- SUPABASE_URL
	- SUPABASE_ANON_KEY
	- SUPABASE_SERVICE_ROLE_KEY

### Stage Pool Setup

For each treasure_hunt event, insert stage variants into public.treasure_hunt_stage_questions:

- event_id: target event
- stage: sequential stage number (1..N)
- question_id: from question_bank
- question_text (optional override)
- answer_text (optional override)
- hint_text (optional)
- media_url (optional)

If no stage rows are present, the engine falls back to event_questions using order_num as stage.

## Realtime Competitive Quiz Rollout

To enable quiz modes with Normal and Competitive behavior:

1. Apply schema patch in Supabase SQL Editor:
	- database/competitive_quiz_realtime_patch.sql
2. Deploy edge function:
	- supabase functions deploy competitive-quiz-engine
3. Event configuration:
	- Set events.type = quiz
	- Set events.quiz_mode = normal or competitive

Behavior summary:

- quiz_mode=normal: existing NormalQuizMode flow remains unchanged
- quiz_mode=competitive: synchronized question clock, auto progression, anti-cheat handling, speed-based scoring, live leaderboard
