import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, serverNow } from '../../lib/supabase';
import { Clock3, ShieldAlert, Trophy, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const MotionH3 = motion.h3;
const MotionButton = motion.button;
const MotionDiv = motion.div;

function formatMs(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const sec = Math.ceil(safe / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CompetitiveQuizMode({ eventId, sessionToken, onRuntimeUpdate }) {
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [player, setPlayer] = useState(null);
  const [question, setQuestion] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [countdownMs, setCountdownMs] = useState(0);
  const [selected, setSelected] = useState('');
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [feedbackTick, setFeedbackTick] = useState(0);
  const [adminControlBusy, setAdminControlBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connected');
  const [slowNetwork, setSlowNetwork] = useState(false);

  const mountedRef = useRef(true);
  const questionIndexRef = useRef(-1);
  const advanceRequestedRef = useRef(false);
  const syncRequestRef = useRef(0);
  const slowNetworkTimerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const isEnded = session?.status === 'ended' || player?.status === 'finished';
  const isPaused = session?.status === 'paused';
  const isDisqualified = player?.status === 'disqualified';
  const remainingSeconds = Math.max(0, Math.floor(countdownMs / 1000));
  const isLast5 = !isPaused && !isEnded && remainingSeconds <= 5;

  const playTone = useCallback((kind) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = kind === 'good' ? 'triangle' : 'sawtooth';
      osc.frequency.value = kind === 'good' ? 740 : 210;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
      osc.onended = () => {
        ctx.close().catch(() => {});
        if (audioCtxRef.current === ctx) audioCtxRef.current = null;
      };
    } catch {
      // Audio playback can be blocked by browser policy.
    }
  }, []);

  const sync = useCallback(async (action = 'heartbeat') => {
    const requestId = ++syncRequestRef.current;
    const startedAt = performance.now();
    const { data, error: invokeError } = await supabase.functions.invoke('competitive-quiz-engine', {
      body: { action, eventId, sessionToken },
    });
    if (requestId !== syncRequestRef.current) return data;
    const elapsed = performance.now() - startedAt;
    if (elapsed > 1200) {
      setSlowNetwork(true);
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      slowNetworkTimerRef.current = setTimeout(() => {
        setSlowNetwork(false);
        slowNetworkTimerRef.current = null;
      }, 2500);
    }

    if (invokeError || data?.error) {
      throw new Error(invokeError?.message || data?.error || 'Competitive sync failed');
    }

    if (data?.session) setSession(data.session);
    if (data?.player) {
      setPlayer(data.player);
      if (data.player.answeredCurrent) setLocked(true);
    }
    if (Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard);

    const q = data?.question || null;
    if (!q) {
      setQuestion(null);
      setSelected('');
      return data;
    }

    if (q.index !== questionIndexRef.current) {
      questionIndexRef.current = q.index;
      setQuestion(q);
      setSelected('');
      setLocked(!!data?.player?.answeredCurrent);
      setFeedback({ type: '', text: '' });
    }

    setQuestion(q);
    return data;
  }, [eventId, sessionToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setBooting(true);
    sync('bootstrap')
      .catch((err) => {
        if (alive && mountedRef.current) setError(err.message || 'Failed to join competitive quiz');
      })
      .finally(() => {
        if (alive && mountedRef.current) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, [sync]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`cq-session-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'competitive_quiz_sessions',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        sync('heartbeat').catch(() => {});
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('reconnecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, sync]);

  useEffect(() => {
    const end = session?.questionEndTime ? new Date(session.questionEndTime).getTime() : 0;
    if (!end) {
      setCountdownMs(0);
      advanceRequestedRef.current = false;
      return;
    }

    const tick = () => {
      const left = Math.max(0, end - serverNow());
      setCountdownMs(left);
      if (left === 0) {
        setLocked(true);
        if (session?.status === 'live' && !advanceRequestedRef.current) {
          advanceRequestedRef.current = true;
          sync('heartbeat').catch(() => {});
        }
      } else {
        advanceRequestedRef.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [session?.questionEndTime, session?.status, sync]);

  useEffect(() => {
    if (!session || !question) return;
    const totalQuestions = Number(session.totalQuestions || 0);
    const currentQuestionIndex = Number(question.index || 0);
    const left = Math.max(0, Math.ceil(countdownMs / 1000));
    const timeLeftStr = `${left}s`;
    onRuntimeUpdate?.({
      status: session.status,
      totalQuestions,
      currentQuestionIndex,
      questionEndAt: session.questionEndTime || null,
      timeLeftStr,
    });
  }, [session, question, countdownMs, onRuntimeUpdate]);

  useEffect(() => {
    if (isEnded) return;
    const trapBack = () => {
      window.history.pushState(null, '', window.location.href);
      setFeedback({ type: 'warn', text: 'Back navigation is disabled during the live competitive round.' });
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', trapBack);
    return () => window.removeEventListener('popstate', trapBack);
  }, [isEnded]);

  useEffect(() => {
    if (!session?.violationMode) return;

    const onVisibility = () => {
      if (document.hidden) {
        supabase.functions.invoke('competitive-quiz-engine', {
          body: { action: 'violation', eventId, sessionToken },
        }).then(({ data }) => {
          if (data?.result === 'disqualified') {
            setFeedback({ type: 'bad', text: 'Disqualified for tab switching.' });
          } else if (data?.result) {
            setFeedback({ type: 'bad', text: 'Violation detected. Current question penalized.' });
          }
          sync('heartbeat').catch(() => {});
        }).catch(() => {});
      }
    };

    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('paste', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('contextmenu', preventDefault);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('contextmenu', preventDefault);
    };
  }, [eventId, session?.violationMode, sessionToken, sync]);

  const optionPalette = useMemo(() => ['#2563eb', '#ef4444', '#f59e0b', '#10b981'], []);

  const submit = async (option) => {
    if (!question || locked || isPaused || isEnded || isDisqualified) return;
    setSelected(option);
    setLocked(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('competitive-quiz-engine', {
        body: { action: 'submit', eventId, answer: option, sessionToken },
      });

      if (invokeError || data?.error) throw new Error(invokeError?.message || data?.error || 'Submit failed');

      if (data.result === 'correct') {
        playTone('good');
        setFeedbackTick((prev) => prev + 1);
        setFeedback({ type: 'good', text: `Correct! +${data.points} points` });
      } else if (data.result === 'wrong') {
        playTone('bad');
        setFeedbackTick((prev) => prev + 1);
        setFeedback({ type: 'bad', text: `Wrong. +${data.points || 0} points` });
      } else if (data.result === 'already-answered') {
        setFeedback({ type: 'warn', text: 'Answer already locked for this question.' });
      }

      if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard);
      await sync('heartbeat');
    } catch (err) {
      setFeedback({ type: 'bad', text: err.message || 'Submission failed' });
      setLocked(false);
    }
  };

  const control = async (command) => {
    setAdminControlBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('competitive-quiz-engine', {
        body: { action: 'control', eventId, command, sessionToken },
      });
      if (invokeError || data?.error) throw new Error(invokeError?.message || data?.error || 'Control command failed');
      await sync('heartbeat');
    } catch (err) {
      setFeedback({ type: 'bad', text: err.message || 'Control failed' });
    } finally {
      setAdminControlBusy(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">{error}</div>
      </div>
    );
  }

  const totalQuestions = Number(session?.totalQuestions || 0);
  const currentQNum = Number((session?.currentQuestionIndex || 0) + 1);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 font-competition">
      {realtimeStatus === 'reconnecting' && (
        <div className="mb-3 rounded-xl border border-amber-300/40 bg-amber-500/15 px-4 py-2 text-amber-100 text-sm font-bold">
          Reconnecting...
        </div>
      )}
      {slowNetwork && (
        <div className="mb-3 rounded-xl border border-sky-300/40 bg-sky-500/15 px-4 py-2 text-sky-100 text-sm font-bold">
          Slow network detected
        </div>
      )}
      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(160deg,#0b1222_0%,#0f172a_45%,#1e293b_100%)] overflow-hidden">
        <div className="px-5 md:px-8 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-sky-300 font-bold">Competitive Quiz</p>
            <h2 className="text-white text-[28px] md:text-[32px] font-black leading-tight">Question {Math.min(currentQNum, Math.max(totalQuestions, 1))} / {Math.max(totalQuestions, 1)}</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border font-bold flex items-center gap-2 transition-all ${
              isLast5
                ? 'border-red-300/60 bg-red-500/20 text-red-200 animate-pulse'
                : 'border-amber-300/30 bg-amber-400/10 text-amber-100'
            }`}>
              <Clock3 size={15} />
              <span className={isLast5 ? 'text-3xl md:text-[32px] leading-none timer-critical' : 'text-2xl md:text-[32px] leading-none'}>{isLast5 ? `${remainingSeconds}s` : formatMs(countdownMs)}</span>
            </div>
            <div className="px-4 py-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-100 font-bold">
              Score {Number(player?.score || 0)}
            </div>
            {session?.violationMode && (
              <div className="px-3 py-2 rounded-xl border border-red-300/25 bg-red-400/10 text-red-100 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={13} /> {session.violationMode}
              </div>
            )}
          </div>
        </div>

        {isPaused && (
          <div className="px-6 py-3 bg-amber-400/10 border-b border-amber-300/20 text-amber-100 text-sm font-semibold">
            Quiz paused by admin. Stand by for resume.
          </div>
        )}

        {isDisqualified ? (
          <div className="p-8 text-center text-red-100">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-wider">Disqualified</h3>
            <p>Anti-cheat rules were violated. Your rank is removed.</p>
          </div>
        ) : isEnded ? (
          <div className="p-6 md:p-8">
            <h3 className="text-xl md:text-2xl text-white font-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <Trophy className="text-amber-300" /> Final Leaderboard
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[1, 2, 3].map((rank) => {
                const p = leaderboard.find((x) => Number(x.rank) === rank);
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                return (
                  <div key={rank} className="rounded-xl border border-white/15 bg-slate-950/40 p-4">
                    <p className="text-sm font-bold text-amber-100 mb-1">{medal} Place</p>
                    <p className="text-white font-semibold">{p?.name || 'Pending...'}</p>
                    <p className="text-xs text-slate-300 mt-1">{Number(p?.score || 0)} pts</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-0">
            <div className="p-5 md:p-8 border-r border-white/10">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 md:p-6 min-h-70 flex flex-col">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300 font-bold mb-3">Live Question</p>
                <AnimatePresence mode="wait">
                  <MotionH3
                    key={question?.id || `q-${currentQNum}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="text-white text-[28px] md:text-[32px] font-black leading-snug flex-1"
                  >
                    {question?.text || 'Waiting for next question...'}
                  </MotionH3>
                </AnimatePresence>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mt-4">
                {(question?.options || []).map((opt, i) => {
                  const color = optionPalette[i % optionPalette.length];
                  const active = selected === opt;
                  return (
                    <MotionButton
                      key={`${opt}-${i}`}
                      onClick={() => submit(opt)}
                      disabled={locked || isPaused || isEnded}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: locked || isPaused || isEnded ? 1 : 1.01 }}
                      className="rounded-2xl px-4 py-5 text-left font-semibold text-[19px] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:brightness-110"
                      style={{
                        background: active ? color : `${color}c0`,
                        border: active ? '2px solid #ffffff' : '2px solid transparent',
                        boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.35)' : '0 10px 20px rgba(0,0,0,0.25)',
                      }}
                    >
                      <span className="opacity-90">{String.fromCharCode(65 + i)}.</span> {opt}
                    </MotionButton>
                  );
                })}
              </div>

              <AnimatePresence>
                {feedback.text && (
                  <MotionDiv
                    key={`${feedback.type}-${feedbackTick}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={feedback.type === 'bad' ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28 }}
                    className={`mt-4 rounded-xl px-4 py-3 border text-sm font-semibold ${
                      feedback.type === 'good'
                        ? 'border-emerald-300/35 bg-emerald-500/18 text-emerald-100'
                        : feedback.type === 'bad'
                        ? 'border-red-300/35 bg-red-500/18 text-red-100'
                        : 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                    }`}
                  >
                    {feedback.text}
                  </MotionDiv>
                )}
              </AnimatePresence>
            </div>

            <aside className="p-5 md:p-6 bg-white/5 backdrop-blur-xl border-l border-white/10">
              <h4 className="text-xs uppercase tracking-[0.14em] text-slate-300 font-bold mb-3">Top 5 Live</h4>
              <div className="space-y-2">
                {leaderboard.map((row) => (
                  <div key={row.userId} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-base font-semibold truncate">
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`} {row.name}
                      </p>
                    </div>
                    <div className="text-sky-100 text-base font-bold">{row.score}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-300">Your rank</p>
                <p className="text-white text-xl font-black">{player?.rank ? `#${player.rank}` : '-'}</p>
                <p className="text-xs text-slate-300 mt-1">Violations: {Number(player?.violations || 0)}</p>
                <p className="text-xs text-slate-300">Last gain: +{Number(player?.lastPoints || 0)}</p>
              </div>

              {player?.isAdmin && (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={adminControlBusy} onClick={() => control('pause')} className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 text-black disabled:opacity-50 hover:bg-amber-400 transition-colors">Pause</button>
                    <button disabled={adminControlBusy} onClick={() => control('resume')} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-black disabled:opacity-50 hover:bg-emerald-400 transition-colors">Resume</button>
                    <button disabled={adminControlBusy} onClick={() => control('end')} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500 text-white disabled:opacity-50 hover:bg-red-400 transition-colors">End</button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1"><Zap size={11} /> Admin controls</p>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
