import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export function TournamentPlaying({
  match,
  question,
  userId,
  player,
  leaderboard,
  tournament,
  onAnswerSubmit,
}) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const submitLockedRef = useRef(false);

  const isPlayer1 = match.player1_id === userId;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

  // Fetch opponent name
  useEffect(() => {
    const fetchOpponent = async () => {
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', opponentId)
        .single();

      if (data) {
        setOpponent(data.name);
      }
    };

    fetchOpponent();
  }, [opponentId]);

  // Timer countdown
  useEffect(() => {
    if (submitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setSubmitted(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted]);

  const handleSelectAnswer = (option) => {
    if (submitted || submitLockedRef.current) return;

    submitLockedRef.current = true;
    setSubmitted(true);
    setFeedback({
      answer: option,
      status: 'submitted',
      time: 30 - timeLeft,
    });

    // Submit to backend
    Promise.resolve(onAnswerSubmit(option)).finally(() => {
      submitLockedRef.current = false;
    });
  };

  const getTimeColor = () => {
    if (timeLeft <= 5) return 'text-red-500 border-red-500';
    if (timeLeft <= 10) return 'text-amber-400 border-amber-400';
    return 'text-blue-400 border-blue-500';
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 to-slate-900 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top HUD: Match Info */}
        <div className="flex justify-between items-center mb-8 bg-slate-900/80 backdrop-blur rounded-xl p-6 border border-slate-800">
          <div className="text-left">
            <div className="text-xs uppercase text-slate-500 font-bold tracking-widest">
              Round {tournament.current_round} • Match {match.match_number || 1}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {tournament.total_participants} Participants
            </div>
          </div>

          {/* Timer - BIG AND PROMINENT */}
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center font-mono font-black text-4xl border-4 transition-all ${getTimeColor()} ${
              timeLeft <= 3 ? 'animate-pulse scale-110' : ''
            }`}
          >
            {timeLeft}
          </div>

          {/* Right: Player rank */}
          <div className="text-right">
            <div className="text-xs uppercase text-slate-500 font-bold tracking-widest">
              Your Rank
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {leaderboard.findIndex((p) => p.user_id === userId) + 1 || '—'}
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Opponent Info */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 text-center">
              <div className="text-xs uppercase text-slate-500 font-bold mb-2">
                Opponent
              </div>
              <div className="text-xl font-bold text-white wrap-break-word">
                {opponent || 'Loading...'}
              </div>
            </div>

            {/* Leaderboard Mini */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="text-xs uppercase text-slate-500 font-bold mb-3">
                Leaderboard
              </div>
              <div className="space-y-2">
                {leaderboard.slice(0, 3).map((p, idx) => (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-2 p-2 rounded px-3 ${
                      p.user_id === userId
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'bg-slate-700/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-400 w-4">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-white flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="text-xs font-bold text-blue-400">
                      {p.matches_won}W
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Question and Options */}
          <div className="lg:col-span-2">
            <div className="bg-linear-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8">
              {/* Question */}
              <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-8 leading-tight">
                {question.question}
              </h2>

              {/* Answer Options - 2x2 Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(question.options || []).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectAnswer(option)}
                    disabled={submitted}
                    className={`p-6 rounded-xl font-bold text-lg transition-all transform ${
                      submitted
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:scale-105 hover:shadow-lg active:scale-95'
                    } ${
                      feedback?.answer === option
                        ? 'bg-green-500 border-green-400 text-white'
                        : 'bg-slate-700 border-2 border-slate-600 text-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}: {option}
                  </button>
                ))}
              </div>

              {/* Submission feedback */}
              {feedback && (
                <div className="mt-6 p-4 rounded-lg bg-blue-500/20 border border-blue-500/50 text-center">
                  <div className="text-sm font-bold text-blue-300">
                    Answer submitted in {feedback.time}s
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Waiting for opponent...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Your Stats */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
              <div className="text-xs uppercase text-slate-500 font-bold mb-3">
                Your Stats
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400">Matches Won</div>
                  <div className="text-2xl font-black text-green-400">
                    {player?.matches_won || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Score</div>
                  <div className="text-2xl font-black text-blue-400">
                    {player?.total_score || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Round</div>
                  <div className="text-2xl font-black text-purple-400">
                    Round {tournament.current_round}
                  </div>
                </div>
              </div>
            </div>

            {/* Match Info */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="text-xs uppercase text-slate-500 font-bold mb-2">
                Match Status
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="font-bold text-white capitalize">
                    {match.status}
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${((30 - timeLeft) / 30) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((30 - timeLeft) / 30) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default TournamentPlaying;
