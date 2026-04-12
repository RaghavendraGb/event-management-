import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Compass, Crown, KeyRound, Lock, Map, Timer, Trophy, XCircle } from 'lucide-react';
import { supabase, serverNow } from '../../lib/supabase';

const STAGE_INTROS = [
  'You discovered a hidden clue...',
  'A mysterious lock blocks your path...',
  'Treasure is near, solve this to proceed...',
  'The map shifts under your feet. Decode the next mark...',
  'A buried chamber opens. One puzzle stands between you and glory...',
];

function formatClock(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TreasureHuntMode({ eventId, forcedEnded = false }) {
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [player, setPlayer] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [stageIntroText, setStageIntroText] = useState('');
  const [showStageIntro, setShowStageIntro] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [penaltyLeft, setPenaltyLeft] = useState(0);

  const introStageRef = useRef(0);
  const isMountedRef = useRef(true);

  const isGameEnded = forcedEnded || session?.status === 'ended';
  const isPlayerFinished = player?.status === 'finished';
  const isLocked = isGameEnded || isPlayerFinished || penaltyLeft > 0 || isSubmitting;

  const currentStage = Number(player?.currentStage || 1);
  const totalStages = Number(session?.totalStages || 1);
  const progressPct = Math.min(100, Math.max(0, (currentStage / Math.max(1, totalStages)) * 100));
  const stageIntro = useMemo(() => STAGE_INTROS[(currentStage - 1) % STAGE_INTROS.length], [currentStage]);

  const syncBootstrap = useCallback(async () => {
    const { data, error: invokeError } = await supabase.functions.invoke('treasure-engine', {
      body: { action: 'bootstrap', eventId },
    });

    if (invokeError || data?.error) {
      throw new Error(invokeError?.message || data?.error || 'Unable to sync treasure hunt state');
    }

    setSession(data.session);
    setPlayer(data.player);
    setQuestion(data.question);
    setPenaltyLeft(Number(data.player?.penaltySecondsLeft || 0));
  }, [eventId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setBooting(true);
    setError('');

    syncBootstrap()
      .catch((err) => {
        if (alive && isMountedRef.current) setError(err.message || 'Failed to connect treasure engine');
      })
      .finally(() => {
        if (alive && isMountedRef.current) setBooting(false);
      });

    return () => {
      alive = false;
    };
  }, [syncBootstrap]);

  useEffect(() => {
    if (!player?.currentStage || isGameEnded || isPlayerFinished) return;
    if (introStageRef.current === player.currentStage) return;
    introStageRef.current = player.currentStage;
    setStageIntroText(stageIntro);
    setShowStageIntro(true);
    const timer = setTimeout(() => setShowStageIntro(false), 2200);
    return () => clearTimeout(timer);
  }, [player?.currentStage, stageIntro, isGameEnded, isPlayerFinished]);

  useEffect(() => {
    if (!player?.penaltyUntil && penaltyLeft <= 0) return;
    const tick = () => {
      if (!player?.penaltyUntil) {
        setPenaltyLeft(0);
        return;
      }
      const diffMs = new Date(player.penaltyUntil).getTime() - serverNow();
      const next = Math.max(0, Math.ceil(diffMs / 1000));
      setPenaltyLeft(next);
      if (next <= 0) {
        syncBootstrap().catch(() => {});
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [player?.penaltyUntil, penaltyLeft, syncBootstrap]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`treasure-session-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'treasure_hunt_sessions',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        syncBootstrap().catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, syncBootstrap]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answerInput.trim() || isLocked) return;

    setIsSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('treasure-engine', {
        body: { action: 'submit', eventId, answer: answerInput },
      });

      if (invokeError || data?.error) throw new Error(invokeError?.message || data?.error || 'Submission failed');

      setAnswerInput('');

      if (data.result === 'locked') {
        setPenaltyLeft(Number(data.penaltySecondsLeft || 0));
        setFeedback({ type: 'warn', text: 'Cooldown active. Wait before attempting the next clue.' });
      }

      if (data.result === 'wrong') {
        setFeedback({ type: 'bad', text: 'Wrong path. A penalty has been applied.' });
        setPlayer((prev) => ({
          ...prev,
          attempts: Number(data.attempts || (prev?.attempts || 0) + 1),
          penaltyUntil: data.penaltyUntil,
        }));
        setPenaltyLeft(Number(data.penaltySeconds || 0));
      }

      if (data.result === 'correct') {
        setFeedback({ type: 'good', text: 'Path unlocked. You found a treasure piece!' });
        setPlayer((prev) => ({ ...prev, ...data.player }));
        setQuestion(data.question || null);
        confetti({ particleCount: 70, spread: 55, origin: { y: 0.65 } });
      }

      if (data.result === 'finished') {
        setFeedback({ type: 'good', text: 'Treasure secured. Awaiting final standings...' });
        setPlayer((prev) => ({ ...prev, status: 'finished', finishRank: data.finishRank || null }));
        await syncBootstrap();
      }

      if (data.result === 'ended') {
        setFeedback({ type: 'warn', text: 'Game ended. Top 3 players completed the hunt.' });
        await syncBootstrap();
      }
    } catch (err) {
      setFeedback({ type: 'bad', text: err.message || 'Submission failed. Retry in a moment.' });
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
          <XCircle className="mx-auto mb-3 text-red-400" />
          <h2 className="text-xl font-black text-white mb-2 uppercase tracking-wider">Treasure Engine Error</h2>
          <p className="text-sm text-red-100 mb-4">{error}</p>
          <button onClick={() => syncBootstrap().catch(() => {})} className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold">
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  const topPlayers = session?.topPlayers || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.16),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-6 md:p-8">
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300 font-bold flex items-center gap-2">
              <Map size={14} /> Realtime Treasure Hunt
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Stage {currentStage} / {totalStages}</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 text-sm font-bold flex items-center gap-2">
              <Timer size={14} />
              {penaltyLeft > 0 ? `Penalty ${formatClock(penaltyLeft)}` : 'No penalty'}
            </div>
            <div className="px-3 py-2 rounded-lg border border-amber-300/20 bg-amber-400/10 text-amber-100 text-sm font-bold flex items-center gap-2">
              <Compass size={14} /> Attempts {Number(player?.attempts || 0)}
            </div>
          </div>
        </div>

        <div className="relative mb-7">
          <div className="h-3 rounded-full bg-slate-900/80 border border-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-300 uppercase tracking-wider">
            <span>Map Progress</span>
            <span>{Math.max(0, currentStage - 1)} checkpoints completed</span>
          </div>
        </div>

        {showStageIntro && (
          <div className="relative mb-6 rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sky-100 text-sm font-bold animate-pulse">
            {stageIntroText}
          </div>
        )}

        {isGameEnded ? (
          <div className="relative rounded-2xl border border-amber-300/30 bg-amber-400/10 p-6">
            <h3 className="text-xl text-white font-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-amber-300" /> Hunt Complete
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              {[1, 2, 3].map((rank) => {
                const p = topPlayers.find((x) => Number(x.rank) === rank);
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                return (
                  <div key={rank} className="rounded-xl border border-white/15 bg-slate-950/40 p-4">
                    <p className="text-sm text-amber-200 font-bold mb-1">{medal} Place</p>
                    <p className="text-white font-semibold">{p?.name || 'Pending...'}</p>
                  </div>
                );
              })}
            </div>
            {player?.finishRank && Number(player.finishRank) > 3 && (
              <p className="mt-4 text-sm text-slate-200">Game ended. Top 3 players completed the hunt.</p>
            )}
            {!player?.finishRank && (
              <p className="mt-4 text-sm text-slate-200">Game ended. Top 3 players completed the hunt.</p>
            )}
          </div>
        ) : isPlayerFinished ? (
          <div className="relative rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-6">
            <h3 className="text-xl text-emerald-100 font-black uppercase tracking-wider mb-2 flex items-center gap-2">
              <Crown size={18} /> Treasure Secured
            </h3>
            <p className="text-sm text-emerald-50">
              {player?.finishRank
                ? `You finished at rank #${player.finishRank}. Waiting for the hunt to close when top 3 complete.`
                : 'You finished the trail. Waiting for final rankings.'}
            </p>
          </div>
        ) : (
          <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300 font-bold mb-3">Current Clue</p>
              {question ? (
                <>
                  <p className="text-lg md:text-xl font-semibold text-white leading-relaxed">{question.question}</p>
                  {question.media && (
                    <img src={question.media} alt="Treasure hint" className="mt-4 rounded-xl border border-white/10 max-h-72 object-cover w-full" />
                  )}
                  {Number(player?.attempts || 0) >= 2 && question.hint && (
                    <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                      Hint unlocked: {question.hint}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-200 text-sm">Waiting for clue synchronization...</p>
              )}

              <form className="mt-5" onSubmit={handleSubmit}>
                <input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder={penaltyLeft > 0 ? 'Cooldown active...' : 'Type your answer'}
                  disabled={isLocked}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isLocked || !answerInput.trim()}
                  className="mt-3 w-full rounded-xl py-3 font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <KeyRound size={16} />
                  {isSubmitting ? 'Validating...' : 'Unlock Stage'}
                </button>
              </form>

              {feedback.text && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm border ${
                  feedback.type === 'good'
                    ? 'bg-emerald-500/15 border-emerald-300/40 text-emerald-100'
                    : feedback.type === 'bad'
                    ? 'bg-red-500/15 border-red-300/40 text-red-100'
                    : 'bg-amber-500/15 border-amber-300/40 text-amber-100'
                }`}>
                  {feedback.type === 'good' && 'Path unlocked! '}
                  {feedback.type === 'bad' && 'Wrong path... '}
                  {feedback.text}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300 font-bold mb-3">Journey Status</p>
              <div className="space-y-2">
                {Array.from({ length: totalStages }).map((_, idx) => {
                  const stage = idx + 1;
                  const complete = stage < currentStage;
                  const active = stage === currentStage;
                  return (
                    <div key={stage} className={`rounded-lg px-3 py-2 border text-sm ${
                      complete
                        ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                        : active
                        ? 'border-amber-300/40 bg-amber-500/10 text-amber-100'
                        : 'border-white/10 bg-slate-950/40 text-slate-400'
                    }`}>
                      Stage {stage} {complete ? 'completed' : active ? 'active' : 'locked'}
                    </div>
                  );
                })}
              </div>

              {penaltyLeft > 0 && (
                <div className="mt-4 rounded-lg border border-red-300/35 bg-red-500/10 p-3 text-sm text-red-100 flex items-center gap-2">
                  <Lock size={15} /> Input locked for {formatClock(penaltyLeft)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
