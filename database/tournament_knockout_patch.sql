-- ==========================================
-- Tournament Knockout System Patch
-- Real-Time 1v1 Rapid Fire Tournament
-- ==========================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS tournament_answers CASCADE;
DROP TABLE IF EXISTS tournament_player_state CASCADE;
DROP TABLE IF EXISTS tournament_matches CASCADE;
DROP TABLE IF EXISTS tournament_rounds CASCADE;
DROP TABLE IF EXISTS tournament_sessions CASCADE;

-- Create custom types
CREATE TYPE tournament_status AS ENUM ('pending', 'waiting', 'live', 'paused', 'ended');
CREATE TYPE match_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
CREATE TYPE player_tournament_status AS ENUM ('registered', 'playing', 'waiting', 'advanced', 'eliminated', 'disqualified');
CREATE TYPE match_result AS ENUM ('player1_won', 'player2_won', 'draw', 'abandoned');

-- 1. TOURNAMENT SESSIONS (global tournament state per event)
CREATE TABLE tournament_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status tournament_status DEFAULT 'waiting',
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER,
  total_participants INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  runner_up_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

-- 2. TOURNAMENT ROUNDS (metadata per round)
CREATE TABLE tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  total_matches INTEGER,
  completed_matches INTEGER DEFAULT 0,
  status tournament_status DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, round_number)
);

-- 3. TOURNAMENT MATCHES (individual 1v1 matchups)
CREATE TABLE tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament_sessions(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  player1_time_ms INTEGER DEFAULT 0,
  player2_time_ms INTEGER DEFAULT 0,
  status match_status DEFAULT 'pending',
  result match_result,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner_time_ms INTEGER,
  question_id UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, round_number, match_number)
);

-- 4. TOURNAMENT PLAYER STATE (per-player progression tracking)
CREATE TABLE tournament_player_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status player_tournament_status DEFAULT 'registered',
  current_round INTEGER DEFAULT 1,
  current_match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  matches_won INTEGER DEFAULT 0,
  matches_lost INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  violations INTEGER DEFAULT 0,
  disqualified_at TIMESTAMPTZ,
  eliminated_at TIMESTAMPTZ,
  final_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- 5. TOURNAMENT ANSWERS (submission tracking per question)
CREATE TABLE tournament_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  time_taken_ms INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- ==========================================
-- 3. INDEXES for Performance
-- ==========================================

CREATE INDEX idx_tournament_sessions_event ON tournament_sessions(event_id);
CREATE INDEX idx_tournament_sessions_status ON tournament_sessions(status);
CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX idx_tournament_rounds_status ON tournament_rounds(status);
CREATE INDEX idx_tournament_matches_round ON tournament_matches(round_id);
CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX idx_tournament_matches_winner ON tournament_matches(winner_id);
CREATE INDEX idx_tournament_player_state_tournament ON tournament_player_state(tournament_id);
CREATE INDEX idx_tournament_player_state_status ON tournament_player_state(status);
CREATE INDEX idx_tournament_answers_match ON tournament_answers(match_id);
CREATE INDEX idx_tournament_answers_user ON tournament_answers(user_id);

-- ==========================================
-- 4. HELPER FUNCTIONS
-- ==========================================

-- Function: Calculate match winner (handles ties, time-based, etc.)
CREATE OR REPLACE FUNCTION tournament_determine_match_winner(
  p_match_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_match RECORD;
  v_player1_answer RECORD;
  v_player2_answer RECORD;
  v_winner_id UUID;
  v_result match_result;
  v_winner_time_ms INTEGER;
BEGIN
  -- Lock match row to prevent race conditions
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Match already completed'
    );
  END IF;

  -- Get answers from both players
  SELECT * INTO v_player1_answer FROM tournament_answers 
    WHERE match_id = p_match_id AND user_id = v_match.player1_id;
  
  SELECT * INTO v_player2_answer FROM tournament_answers 
    WHERE match_id = p_match_id AND user_id = v_match.player2_id;

  -- Case 1: Only one player answered
  IF v_player1_answer IS NOT NULL AND v_player2_answer IS NULL THEN
    v_winner_id := v_match.player1_id;
    v_result := 'player1_won';
    v_winner_time_ms := COALESCE(v_player1_answer.time_taken_ms, 0);
  ELSIF v_player2_answer IS NOT NULL AND v_player1_answer IS NULL THEN
    v_winner_id := v_match.player2_id;
    v_result := 'player2_won';
    v_winner_time_ms := COALESCE(v_player2_answer.time_taken_ms, 0);
  
  -- Case 2: Both players answered
  ELSIF v_player1_answer IS NOT NULL AND v_player2_answer IS NOT NULL THEN
    -- Both correct: faster wins
    IF v_player1_answer.is_correct AND v_player2_answer.is_correct THEN
      IF v_player1_answer.time_taken_ms < v_player2_answer.time_taken_ms THEN
        v_winner_id := v_match.player1_id;
        v_result := 'player1_won';
        v_winner_time_ms := v_player1_answer.time_taken_ms;
      ELSE
        v_winner_id := v_match.player2_id;
        v_result := 'player2_won';
        v_winner_time_ms := v_player2_answer.time_taken_ms;
      END IF;
    -- One correct: correct answer wins
    ELSIF v_player1_answer.is_correct THEN
      v_winner_id := v_match.player1_id;
      v_result := 'player1_won';
      v_winner_time_ms := v_player1_answer.time_taken_ms;
    ELSIF v_player2_answer.is_correct THEN
      v_winner_id := v_match.player2_id;
      v_result := 'player2_won';
      v_winner_time_ms := v_player2_answer.time_taken_ms;
    -- Both wrong: faster (first to answer) wins
    ELSE
      IF v_player1_answer.time_taken_ms < v_player2_answer.time_taken_ms THEN
        v_winner_id := v_match.player1_id;
        v_result := 'player1_won';
        v_winner_time_ms := v_player1_answer.time_taken_ms;
      ELSE
        v_winner_id := v_match.player2_id;
        v_result := 'player2_won';
        v_winner_time_ms := v_player2_answer.time_taken_ms;
      END IF;
    END IF;
  
  -- Case 3: Neither answered (draw - shouldn't happen in real scenario)
  ELSE
    v_result := 'draw';
    v_winner_id := NULL;
    v_winner_time_ms := NULL;
  END IF;

  -- Update match with result
  UPDATE tournament_matches 
  SET 
    status = 'completed',
    result = v_result,
    winner_id = v_winner_id,
    winner_time_ms = v_winner_time_ms,
    ended_at = NOW(),
    locked_at = NOW(),
    updated_at = NOW()
  WHERE id = p_match_id;

  -- If there's a winner, update player state
  IF v_winner_id IS NOT NULL THEN
    UPDATE tournament_player_state 
    SET 
      matches_won = matches_won + 1,
      status = 'advanced',
      updated_at = NOW()
    WHERE tournament_id = v_match.tournament_id AND user_id = v_winner_id;
    
    -- Mark loser as ready for next round or elimination
    IF v_result = 'player1_won' THEN
      UPDATE tournament_player_state 
      SET 
        matches_lost = matches_lost + 1,
        updated_at = NOW()
      WHERE tournament_id = v_match.tournament_id AND user_id = v_match.player2_id;
    ELSE
      UPDATE tournament_player_state 
      SET 
        matches_lost = matches_lost + 1,
        updated_at = NOW()
      WHERE tournament_id = v_match.tournament_id AND user_id = v_match.player1_id;
    END IF;
  END IF;

  -- Increment completed_matches counter
  UPDATE tournament_rounds 
  SET 
    completed_matches = completed_matches + 1,
    updated_at = NOW()
  WHERE id = v_match.round_id;

  RETURN jsonb_build_object(
    'success', true,
    'winner_id', v_winner_id,
    'result', v_result,
    'winner_time_ms', v_winner_time_ms
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Shuffle and pair players for a round
CREATE OR REPLACE FUNCTION tournament_pair_players_for_round(
  p_tournament_id UUID,
  p_round_number INTEGER
) RETURNS jsonb AS $$
DECLARE
  v_qualifying_players RECORD;
  v_players_array UUID[];
  v_player_count INTEGER;
  v_match_count INTEGER;
  v_bye_player_id UUID := NULL;
  v_match_number INTEGER := 1;
  v_round_id UUID;
BEGIN
  -- Get existing round or create new
  SELECT id INTO v_round_id FROM tournament_rounds 
    WHERE tournament_id = p_tournament_id AND round_number = p_round_number;
  
  IF v_round_id IS NULL THEN
    INSERT INTO tournament_rounds (tournament_id, round_number, status, total_matches)
    VALUES (p_tournament_id, p_round_number, 'pending', 0)
    RETURNING id INTO v_round_id;
  END IF;

  -- Get all players still in tournament (not eliminated/disqualified)
  SELECT ARRAY_AGG(user_id ORDER BY RANDOM())
  INTO v_players_array
  FROM tournament_player_state
  WHERE tournament_id = p_tournament_id 
    AND status NOT IN ('eliminated', 'disqualified');

  v_player_count := COALESCE(ARRAY_LENGTH(v_players_array, 1), 0);

  -- Handle special case: 1 player (auto-winner)
  IF v_player_count = 1 THEN
    UPDATE tournament_player_state 
    SET status = 'advanced', matches_won = matches_won + 1
    WHERE tournament_id = p_tournament_id AND user_id = v_players_array[1];
    
    RETURN jsonb_build_object(
      'success', true,
      'matches_created', 0,
      'bye_player_id', v_players_array[1],
      'message', 'Single player - auto-advance'
    );
  END IF;

  -- Handle odd number: assign bye to random odd player
  IF v_player_count % 2 = 1 THEN
    v_bye_player_id := v_players_array[v_player_count];
    v_player_count := v_player_count - 1;
    
    -- Advance bye player
    UPDATE tournament_player_state 
    SET status = 'advanced', matches_won = matches_won + 1
    WHERE tournament_id = p_tournament_id AND user_id = v_bye_player_id;
  END IF;

  -- Create matches for pairs
  FOR i IN 1..(v_player_count / 2)
  LOOP
    INSERT INTO tournament_matches (
      tournament_id, round_id, round_number, match_number,
      player1_id, player2_id, status
    ) VALUES (
      p_tournament_id, 
      v_round_id,
      p_round_number,
      v_match_number,
      v_players_array[(i * 2) - 1],
      v_players_array[i * 2],
      'pending'
    );
    
    v_match_number := v_match_number + 1;
  END LOOP;

  -- Update round total_matches
  UPDATE tournament_rounds 
  SET total_matches = v_match_number - 1
  WHERE id = v_round_id;

  RETURN jsonb_build_object(
    'success', true,
    'matches_created', v_match_number - 1,
    'bye_player_id', v_bye_player_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Check if all matches in round are complete, advance if so
CREATE OR REPLACE FUNCTION tournament_check_round_completion(
  p_tournament_id UUID,
  p_round_number INTEGER
) RETURNS jsonb AS $$
DECLARE
  v_round RECORD;
  v_active_players INTEGER;
  v_next_round INTEGER;
BEGIN
  SELECT * INTO v_round FROM tournament_rounds 
    WHERE tournament_id = p_tournament_id AND round_number = p_round_number;
  
  IF v_round IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not found');
  END IF;

  -- Check if all matches completed
  IF v_round.total_matches = v_round.completed_matches THEN
    -- Count remaining active players
    SELECT COUNT(*) INTO v_active_players FROM tournament_player_state
      WHERE tournament_id = p_tournament_id AND status NOT IN ('eliminated', 'disqualified');
    
    -- If only 1 player left, they're the winner
    IF v_active_players = 1 THEN
      UPDATE tournament_sessions 
      SET 
        status = 'ended',
        ended_at = NOW(),
        winner_id = (SELECT user_id FROM tournament_player_state 
          WHERE tournament_id = p_tournament_id AND status NOT IN ('eliminated', 'disqualified') LIMIT 1)
      WHERE id = p_tournament_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'round_complete', true,
        'tournament_complete', true
      );
    ELSE
      -- Prepare next round
      v_next_round := p_round_number + 1;
      
      -- Mark current players as waiting for next round
      UPDATE tournament_player_state 
      SET status = 'waiting'
      WHERE tournament_id = p_tournament_id AND status = 'advanced';
      
      RETURN jsonb_build_object(
        'success', true,
        'round_complete', true,
        'tournament_complete', false,
        'next_round', v_next_round,
        'remaining_players', v_active_players
      );
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'round_complete', false,
      'remaining_matches', v_round.total_matches - v_round.completed_matches
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE tournament_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tournament_sessions (readable by all, managed by event admin)
CREATE POLICY "tournament_sessions_readable" ON tournament_sessions FOR SELECT USING (true);
CREATE POLICY "tournament_sessions_admin_insert" ON tournament_sessions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT created_by FROM events WHERE id = event_id)
);
CREATE POLICY "tournament_sessions_admin_update" ON tournament_sessions FOR UPDATE USING (
  auth.uid() IN (SELECT created_by FROM events WHERE id = event_id)
);

-- RLS Policies: tournament_rounds (readable by all)
CREATE POLICY "tournament_rounds_readable" ON tournament_rounds FOR SELECT USING (true);

-- RLS Policies: tournament_matches (readable by all, only players can update their own state)
CREATE POLICY "tournament_matches_readable" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "tournament_matches_player_update" ON tournament_matches FOR UPDATE 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id OR 
         auth.uid() IN (SELECT created_by FROM events 
                       WHERE id = (SELECT event_id FROM tournament_sessions 
                                  WHERE id = tournament_id)));

-- RLS Policies: tournament_player_state (players see own, admins see all)
CREATE POLICY "tournament_player_state_own" ON tournament_player_state FOR SELECT 
  USING (auth.uid() = user_id OR 
         auth.uid() IN (SELECT created_by FROM events 
                       WHERE id = (SELECT event_id FROM tournament_sessions 
                                  WHERE id = tournament_id)));
CREATE POLICY "tournament_player_state_admin_update" ON tournament_player_state FOR UPDATE 
  USING (auth.uid() IN (SELECT created_by FROM events 
                       WHERE id = (SELECT event_id FROM tournament_sessions 
                                  WHERE id = tournament_id)));

-- RLS Policies: tournament_answers (players submit own, admins review all)
CREATE POLICY "tournament_answers_own_insert" ON tournament_answers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tournament_answers_readable" ON tournament_answers FOR SELECT 
  USING (auth.uid() = user_id OR 
         auth.uid() IN (SELECT created_by FROM events 
                       WHERE id = (SELECT event_id FROM tournament_sessions 
                                  WHERE id = (SELECT tournament_id FROM tournament_matches 
                                            WHERE id = match_id))));

-- ==========================================
-- 6. TRIGGERS for automatic updates
-- ==========================================

-- Trigger: Update tournament_sessions.updated_at on any change
CREATE OR REPLACE FUNCTION update_tournament_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tournament_sessions_updated_at
BEFORE UPDATE ON tournament_sessions
FOR EACH ROW
EXECUTE FUNCTION update_tournament_sessions_updated_at();

-- Trigger: Update tournament_rounds.updated_at on any change
CREATE OR REPLACE FUNCTION update_tournament_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tournament_rounds_updated_at
BEFORE UPDATE ON tournament_rounds
FOR EACH ROW
EXECUTE FUNCTION update_tournament_rounds_updated_at();

-- Trigger: Update tournament_matches.updated_at on any change
CREATE OR REPLACE FUNCTION update_tournament_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tournament_matches_updated_at
BEFORE UPDATE ON tournament_matches
FOR EACH ROW
EXECUTE FUNCTION update_tournament_matches_updated_at();

-- Trigger: Update tournament_player_state.updated_at on any change
CREATE OR REPLACE FUNCTION update_tournament_player_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tournament_player_state_updated_at
BEFORE UPDATE ON tournament_player_state
FOR EACH ROW
EXECUTE FUNCTION update_tournament_player_state_updated_at();

-- ==========================================
-- 7. Update events table to support tournament mode
-- ==========================================

-- Add tournament_mode column if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS tournament_enabled BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rapid_fire_style TEXT DEFAULT 'traditional' CHECK (rapid_fire_style IN ('traditional', 'knockout_tournament'));

COMMENT ON COLUMN events.rapid_fire_style IS 'traditional = sequential rapid fire, knockout_tournament = bracket-style tournament';

-- ==========================================
-- Done
-- ==========================================

COMMIT;
