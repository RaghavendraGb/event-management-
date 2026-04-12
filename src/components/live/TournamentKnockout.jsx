import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TournamentPlaying from './TournamentPlaying';
import TournamentWaiting from './TournamentWaiting';
import TournamentResults from './TournamentResults';

export function TournamentKnockout({ eventId, userId, onSubmit }) {
  const [state, setState] = useState('loading'); // loading, waiting, playing, finished
  const [tournament, setTournament] = useState(null);
  const [player, setPlayer] = useState(null);
  const [match, setMatch] = useState(null);
  const [question, setQuestion] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const syncIntervalRef = useRef(null);

  const syncTournamentState = useCallback(async () => {
    if (!tournament?.id || !userId) return;

    try {
      const { data, error: err } = await supabase.functions.invoke(
        'tournament-knockout-engine',
        {
          body: {
            action: 'heartbeat',
            tournament_id: tournament.id,
            event_id: eventId,
            user_id: userId,
          },
        }
      );

      if (err) throw err;
      if (!data?.success) throw new Error(data?.error);

      setTournament(data.tournament);
      setPlayer(data.player);
      setMatch(data.match);
      setQuestion(data.question);
      setLeaderboard(data.leaderboard);

      // Update state based on player status
      if (data.player?.status === 'playing' && data.match) {
        setState('playing');
      } else if (
        data.player?.status === 'waiting' ||
        data.player?.status === 'advanced'
      ) {
        setState('waiting');
      } else if (data.tournament?.winner_id) {
        setState('finished');
      } else {
        setState('waiting');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError(String(err));
    }
  }, [tournament?.id, userId, eventId]);

  // Initial state fetch
  useEffect(() => {
    const initTournament = async () => {
      if (!userId || !eventId) return;

      try {
        // Try to fetch existing tournament for this event
        const { data: sessions, error: err } = await supabase
          .from('tournament_sessions')
          .select('*')
          .eq('event_id', eventId)
          .single();

        if (err && err.code !== 'PGRST116') {
          throw err;
        }

        if (sessions) {
          setTournament({
            id: sessions.id,
            status: sessions.status,
            current_round: sessions.current_round,
            total_participants: sessions.total_participants,
          });

          // Fetch player state
          const { data: playerData } = await supabase
            .from('tournament_player_state')
            .select('*')
            .eq('tournament_id', sessions.id)
            .eq('user_id', userId)
            .single();

          if (playerData) {
            setPlayer({
              user_id: playerData.user_id,
              status: playerData.status,
              current_round: playerData.current_round,
              matches_won: playerData.matches_won,
              matches_lost: playerData.matches_lost,
              total_score: playerData.total_score,
            });

            // Fetch current match if playing
            if (playerData.current_match_id) {
              const { data: matchData } = await supabase
                .from('tournament_matches')
                .select('*')
                .eq('id', playerData.current_match_id)
                .single();

              if (matchData) {
                setMatch({
                  id: matchData.id,
                  player1_id: matchData.player1_id,
                  player2_id: matchData.player2_id,
                  status: matchData.status,
                  started_at: matchData.started_at,
                });
              }
            }
          }
        } else {
          setState('waiting'); // Tournament not started yet
        }
      } catch (err) {
        console.error('Init error:', err);
        setError(String(err));
      }
    };

    initTournament();
  }, [userId, eventId]);

  // Setup sync interval
  useEffect(() => {
    if (state === 'playing') {
      syncIntervalRef.current = setInterval(syncTournamentState, 1000);
      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      };
    }
  }, [state, syncTournamentState]);

  const handleAnswerSubmit = useCallback(
    async (selectedAnswer) => {
      if (!match?.id || !userId) return;

      try {
        const { data, error: err } = await supabase.functions.invoke(
          'tournament-knockout-engine',
          {
            body: {
              action: 'submit_answer',
              tournament_id: tournament.id,
              event_id: eventId,
              user_id: userId,
              answer: selectedAnswer,
            },
          }
        );

        if (err) throw err;
        if (!data?.success) throw new Error(data?.error);

        // Sync state after submission
        await syncTournamentState();
      } catch (err) {
        console.error('Submit error:', err);
        setError(String(err));
      }
    },
    [match?.id, userId, tournament?.id, eventId, syncTournamentState]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 animate-pulse" />
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">
          Error
        </h2>
        <p className="text-slate-400 max-w-md">{error}</p>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10">
        <Zap className="w-16 h-16 text-blue-400 animate-pulse" />
        <p className="text-white font-bold">Initializing Tournament...</p>
      </div>
    );
  }

  if (state === 'playing' && match && question) {
    return (
      <TournamentPlaying
        match={match}
        question={question}
        userId={userId}
        player={player}
        leaderboard={leaderboard}
        tournament={tournament}
        onAnswerSubmit={handleAnswerSubmit}
      />
    );
  }

  if (state === 'waiting') {
    return (
      <TournamentWaiting
        player={player}
        tournament={tournament}
        leaderboard={leaderboard}
      />
    );
  }

  if (state === 'finished' && tournament?.winner_id) {
    return (
      <TournamentResults
        tournament={tournament}
        player={player}
        leaderboard={leaderboard}
        onComplete={onSubmit}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
      <AlertTriangle className="w-16 h-16 text-amber-500 animate-pulse" />
      <h2 className="text-2xl font-black text-white uppercase tracking-widest">
        Tournament Starting
      </h2>
      <p className="text-slate-400 max-w-md">
        Waiting for admin to start the tournament...
      </p>
    </div>
  );
}

export default TournamentKnockout;
