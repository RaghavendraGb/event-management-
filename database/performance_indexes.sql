-- ============================================================
-- EventBased Performance Index Patch (PostgreSQL / Supabase)
-- Purpose: improve high-concurrency reads for live leaderboard,
-- admin dashboards, chat, and participant profile pages.
--
-- Safe to run multiple times.
-- ============================================================

-- Events
CREATE INDEX IF NOT EXISTS idx_events_status_start_at
  ON public.events (status, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON public.events (created_at DESC);

-- Participation (most critical)
CREATE INDEX IF NOT EXISTS idx_participation_event_score
  ON public.participation (event_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_participation_user_registered
  ON public.participation (user_id, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_participation_event_user
  ON public.participation (event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_participation_status_event
  ON public.participation (status, event_id);

-- Event question fetches
CREATE INDEX IF NOT EXISTS idx_event_questions_event_order
  ON public.event_questions (event_id, order_num ASC);

CREATE INDEX IF NOT EXISTS idx_event_questions_question_id
  ON public.event_questions (question_id);

-- Question bank browsing
CREATE INDEX IF NOT EXISTS idx_question_bank_created_at
  ON public.question_bank (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty_created_at
  ON public.question_bank (difficulty, created_at DESC);

-- Live chat timeline
CREATE INDEX IF NOT EXISTS idx_ece_chat_created_at
  ON public.ece_chat (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ece_chat_sender_created_at
  ON public.ece_chat (sender_id, created_at DESC);

-- Certificates and users
CREATE INDEX IF NOT EXISTS idx_certificates_user_event
  ON public.certificates (user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON public.users (email);

-- Teams
CREATE INDEX IF NOT EXISTS idx_teams_event_invite
  ON public.teams (event_id, invite_code);

-- Refresh planner stats after index creation
ANALYZE public.events;
ANALYZE public.participation;
ANALYZE public.event_questions;
ANALYZE public.question_bank;
ANALYZE public.ece_chat;
ANALYZE public.certificates;
ANALYZE public.users;
ANALYZE public.teams;
