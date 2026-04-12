-- =========================================================
-- Event mode compatibility patch (safe to run multiple times)
-- Ensures DB supports all event modes used by Admin GUI.
-- =========================================================

-- Extend event_type enum with missing values used by frontend.
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'youandme';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'coding_challenge';

-- Ensure events table has mode columns used by admin create/update flows.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS quiz_mode TEXT NOT NULL DEFAULT 'normal'
  CHECK (quiz_mode IN ('normal', 'competitive'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rapid_fire_style TEXT NOT NULL DEFAULT 'traditional'
  CHECK (rapid_fire_style IN ('traditional', 'knockout_tournament'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS youandme_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS results_announced BOOLEAN NOT NULL DEFAULT false;

-- Helpful index for result-gate checks.
CREATE INDEX IF NOT EXISTS idx_events_result_gate
  ON public.events (status, results_announced);
