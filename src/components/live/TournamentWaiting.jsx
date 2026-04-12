import { Clock, TrendingUp } from 'lucide-react';

export function TournamentWaiting({ player, tournament, leaderboard }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pt-16 pb-10">
      <div className="max-w-2xl mx-auto px-4">
        {/* Main Message */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Clock className="w-20 h-20 text-blue-400 animate-bounce" />
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            ⏳ Waiting for Next Round
          </h1>

          <p className="text-lg text-slate-300 mb-6">
            Great performance! You've advanced to the next round.
          </p>

          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/50 rounded-full px-4 py-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-blue-300">
              Waiting for other matches to complete...
            </span>
          </div>
        </div>

        {/* Your Stats Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 rounded-2xl p-8 mb-8">
          <div className="text-center mb-6">
            <div className="text-sm uppercase text-slate-500 font-bold tracking-widest">
              Your Performance
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/60 rounded-xl p-4 text-center">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Matches Won
              </div>
              <div className="text-3xl font-black text-green-400">
                {player?.matches_won || 0}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-4 text-center">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Round
              </div>
              <div className="text-3xl font-black text-purple-400">
                {tournament?.current_round || 1}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-4 text-center">
              <div className="text-xs uppercase text-slate-400 font-bold mb-2">
                Total Score
              </div>
              <div className="text-3xl font-black text-blue-400">
                {player?.total_score || 0}
              </div>
            </div>
          </div>

          <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
              style={{
                width: `${
                  player?.matches_won === 0
                    ? 0
                    : Math.min((player?.matches_won / 5) * 100, 100)
                }%`,
              }}
            />
          </div>

          <p className="text-xs text-slate-400 text-center">
            Keep winning to reach the finals!
          </p>
        </div>

        {/* Leaderboard */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white uppercase tracking-widest">
              Live Leaderboard
            </h2>
          </div>

          <div className="space-y-3">
            {leaderboard.map((player, idx) => (
              <div
                key={player.user_id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  player.user_id === player?.user_id
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-slate-900/40 border-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl font-black text-slate-500 w-8">
                    {idx === 0 && '🥇'}
                    {idx === 1 && '🥈'}
                    {idx === 2 && '🥉'}
                    {idx >= 3 && `#${idx + 1}`}
                  </div>
                  <div>
                    <div className="font-bold text-white">
                      {player.name}
                      {player.user_id === player?.user_id && (
                        <span className="text-xs text-blue-400 ml-2">(You)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      Status: {player.status}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-green-400">
                    {player.matches_won}W
                  </div>
                  <div className="text-xs text-slate-400">
                    {player.total_score} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tournament Info */}
        <div className="mt-8 bg-slate-900/60 border border-slate-700 rounded-xl p-6 text-center">
          <div className="text-sm text-slate-400 mb-2">
            Total Participants: <span className="font-bold text-white">
              {tournament?.total_participants} 📊
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Tournament Status: <span className="font-semibold text-slate-300">
              {tournament?.status} 🔴
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentWaiting;
