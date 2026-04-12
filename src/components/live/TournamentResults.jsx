import { Trophy, Award, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function TournamentResults({ tournament, player, leaderboard, onComplete }) {
  const [winner, setWinner] = useState(null);
  const [yourRank, setYourRank] = useState(null);

  useEffect(() => {
    const fetchWinner = async () => {
      if (!tournament?.winner_id) return;

      const { data } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('id', tournament.winner_id)
        .single();

      if (data) {
        setWinner(data);
      }

      // Find your rank
      const rank =
        leaderboard.findIndex((p) => p.user_id === player?.user_id) + 1 || null;
      setYourRank(rank);
    };

    fetchWinner();
  }, [tournament?.winner_id, player?.user_id, leaderboard]);

  const isWinner = tournament?.winner_id === player?.user_id;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-16 pb-10 flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        {/* Winner Section */}
        <div className="text-center mb-12">
          {isWinner ? (
            <>
              <div className="flex justify-center mb-6 animate-bounce">
                <Trophy className="w-32 h-32 text-yellow-400" />
              </div>

              <h1 className="text-5xl md:text-6xl font-black text-white mb-3 leading-tight">
                🎉 YOU WON! 🎉
              </h1>

              <p className="text-2xl text-yellow-300 font-bold mb-2">
                TOURNAMENT CHAMPION
              </p>

              <p className="text-lg text-slate-400">
                Congratulations on your incredible victory!
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <Award className="w-24 h-24 text-slate-400" />
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                Tournament Ended
              </h1>

              <p className="text-xl text-slate-300 font-bold mb-2">
                Your Rank: #{yourRank || '—'}
              </p>

              <p className="text-lg text-slate-400">
                Great effort in the tournament!
              </p>
            </>
          )}
        </div>

        {/* Winner Card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border-2 border-yellow-500/30 rounded-2xl p-8 mb-8 text-center">
          <div className="text-sm uppercase text-slate-500 font-bold tracking-widest mb-4">
            🏆 Tournament Champion
          </div>

          <div className="mb-6">
            {winner?.avatar_url ? (
              <img
                src={winner.avatar_url}
                alt={winner.name}
                className="w-24 h-24 rounded-full mx-auto border-4 border-yellow-400 mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-yellow-500/20 border-4 border-yellow-400 mx-auto mb-4 flex items-center justify-center">
                <Star className="w-12 h-12 text-yellow-400" />
              </div>
            )}
          </div>

          <h2 className="text-3xl font-black text-white mb-6">
            {winner?.name || 'Champion'}
          </h2>

          {/* Winner Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/60 rounded-xl p-4">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Matches Won
              </div>
              <div className="text-2xl font-black text-yellow-400">
                {leaderboard[0]?.matches_won || 0}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-4">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Final Rounds
              </div>
              <div className="text-2xl font-black text-yellow-400">
                {tournament?.current_round || 1}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-4">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Total Score
              </div>
              <div className="text-2xl font-black text-yellow-400">
                {leaderboard[0]?.total_score || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Final Leaderboard */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8 mb-8">
          <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-6">
            Final Standings
          </h3>

          <div className="space-y-3">
            {leaderboard.slice(0, 5).map((p, idx) => (
              <div
                key={p.user_id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  idx === 0
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : idx === 1
                      ? 'bg-slate-500/10 border-slate-500/50'
                      : idx === 2
                        ? 'bg-orange-500/10 border-orange-500/50'
                        : 'bg-slate-900/40 border-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-3xl font-black w-12 text-center">
                    {idx === 0 && '🥇'}
                    {idx === 1 && '🥈'}
                    {idx === 2 && '🥉'}
                    {idx >= 3 && `#${idx + 1}`}
                  </div>
                  <div>
                    <div className="font-bold text-white">
                      {p.name}
                      {p.user_id === player?.user_id && (
                        <span className="text-xs text-blue-400 ml-2">(You)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-lg">
                    {idx === 0 && <span className="text-yellow-400">{p.matches_won}W</span>}
                    {idx === 1 && <span className="text-slate-300">{p.matches_won}W</span>}
                    {idx === 2 && <span className="text-orange-400">{p.matches_won}W</span>}
                    {idx >= 3 && <span className="text-slate-300">{p.matches_won}W</span>}
                  </div>
                  <div className="text-xs text-slate-400">{p.total_score} pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Summary */}
        {!isWinner && (
          <div className="bg-slate-800/60 border border-blue-700/30 rounded-2xl p-8 mb-8">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-6">
              Your Summary
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 rounded-xl p-4">
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                  Final Rank
                </div>
                <div className="text-3xl font-black text-blue-400">
                  #{yourRank || '—'}
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4">
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                  Matches Won
                </div>
                <div className="text-3xl font-black text-blue-400">
                  {player?.matches_won || 0}
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4">
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                  Matches Lost
                </div>
                <div className="text-3xl font-black text-red-400">
                  {player?.matches_lost || 0}
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4">
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                  Total Score
                </div>
                <div className="text-3xl font-black text-green-400">
                  {player?.total_score || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onComplete}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-black text-lg rounded-xl border border-blue-500 transition-all active:scale-95 shadow-lg"
        >
          🎯 View Certificate & Return Home
        </button>

        {/* Share Stats */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400 mb-3">
            📊 Share your tournament results
          </p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all">
              📢 Share on Social
            </button>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all">
              📋 Download Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentResults;
