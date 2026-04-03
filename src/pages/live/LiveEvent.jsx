import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, serverNow } from '../../lib/supabase';
import { useStore } from '../../store';
import { Clock, AlertOctagon, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

import { NormalQuizMode } from '../../components/live/NormalQuizMode';
import { RapidFireMode } from '../../components/live/RapidFireMode';
import { TreasureHuntMode } from '../../components/live/TreasureHuntMode';
import { LiveLeaderboard } from '../../components/live/LiveLeaderboard';
import React from 'react';

class LocalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('DEBUG_CRASH_INFO:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white p-10 font-mono">
          <h1 className="text-red-500 text-2xl font-bold mb-4 uppercase">Frontend Crash Captured</h1>
          <div className="bg-slate-900 p-6 rounded-xl border border-red-500/30 overflow-auto">
            <p className="text-lg mb-4">{this.state.error?.message}</p>
            <pre className="text-xs text-slate-500">{this.state.error?.stack}</pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-blue-600 rounded-lg font-bold"
          >
            Retry Component
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LiveEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore(state => state.user);
  const setLiveEventRuntime = useStore(state => state.setLiveEventRuntime);
  const patchLiveEventRuntime = useStore(state => state.patchLiveEventRuntime);
  const clearLiveEventRuntime = useStore(state => state.clearLiveEventRuntime);

  const [eventData, setEventData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participationId, setParticipationId] = useState(null);

  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');

  // ── H: Realtime connection status for network-aware UI ────────
  const [realtimeStatus, setRealtimeStatus] = useState('connected');
  // Fix #3: track whether we were previously CHANNEL_ERROR so we re-sync on reconnect
  const wasDisconnectedRef = useRef(false);

  // Fix #6: retry cooldown to prevent spam-clicking the Retry button
  const [retrying, setRetrying] = useState(false);

  // Fix #8: helper to purge all localStorage keys belonging to this event
  const cleanupEventKeys = useCallback(() => {
    const prefix = `event_${id}_`;
    const rfqPrefix = `rfq_`;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(prefix)) localStorage.removeItem(k);
      // Also remove rfq timer keys for this event (namespaced in RapidFireMode)
      if (k.startsWith(rfqPrefix) && k.includes(`_${id}_`)) localStorage.removeItem(k);
    });
  }, [id]);

  // Anti-Cheat States
  const [hasStarted, setHasStarted] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showViolationBanner, setShowViolationBanner] = useState(false);

  // ── Refs (always-current values for async callbacks) ──────────
  const participationIdRef = useRef(null);
  const violationsRef = useRef(0);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  // Sync state → ref
  useEffect(() => { participationIdRef.current = participationId; }, [participationId]);
  useEffect(() => { violationsRef.current = violations; }, [violations]);
  useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);

  // Mounted guard + store cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearLiveEventRuntime(); // clear global runtime on unmount
    };
  }, [clearLiveEventRuntime]);

  const syncQueueRef = useRef([]);
  const syncWorkerRunning = useRef(false);

  // ── 1. Core Boot Sequence ─────────────────────────────────────
  useEffect(() => {
    async function bootEngine() {
      console.log('🚀 LIVE_EVENT_BOOT_START', { id, userId: user?.id });
      if (!user) return navigate('/login');

      try {
        // ── G: try/catch on all fetches ──
        const { data: eData, error: eErr } = await supabase.from('events').select('*').eq('id', id).single();
        if (eErr || !eData) throw new Error(eErr?.message || 'Event not found');
        if (eData.status === 'ended') return navigate(`/results/${id}`);
        if (isMountedRef.current) setEventData(eData);

        // ── A: Populate single source of truth in global store ──
        setLiveEventRuntime({
          eventId: id,
          status: eData.status,
          startTime: eData.start_at ? new Date(eData.start_at).getTime() : null,
          endTime: eData.end_at ? new Date(eData.end_at).getTime() : null,
          currentQuestionIndex: 0,
          questionStartTime: null,
        });

        const { data: qData, error: qErr } = await supabase
          .from('event_questions')
          .select('*, question_bank(*)')
          .eq('event_id', id)
          .order('order_num', { ascending: true });
        if (qErr) console.error('❌ QUESTIONS_ERROR', qErr);
        if (isMountedRef.current) setQuestions(qData || []);

        const { data: pData, error: pErr } = await supabase
          .from('participation')
          .select('id, answers, status, violations')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .single();

        if (pErr || !pData) {
          console.error('❌ PARTICIPATION_ERROR', pErr);
          return navigate(`/events/${id}`);
        }
        if (pData.status === 'submitted') return navigate(`/results/${id}`);

        participationIdRef.current = pData.id;
        if (isMountedRef.current) {
          setParticipationId(pData.id);
          if (pData.violations) {
            violationsRef.current = pData.violations;
            setViolations(pData.violations);
          }
        }

        const localS = localStorage.getItem(`event_${id}_answers`);
        if (localS) {
          if (isMountedRef.current) setAnswers(JSON.parse(localS));
        } else if (pData.answers) {
          if (isMountedRef.current) setAnswers(pData.answers);
          localStorage.setItem(`event_${id}_answers`, JSON.stringify(pData.answers));
        }

        if (isMountedRef.current) setLoading(false);
      } catch (err) {
        console.error('❌ BOOT_ERROR', err);
        if (isMountedRef.current) {
          setError(err.message || 'Failed to load event. Please refresh.');
          setLoading(false);
        }
      }
    }
    bootEngine();
  }, [id, user, navigate, setLiveEventRuntime]);

  // ── 2. Anti-Cheat & Fullscreen Bootstrap ────────────────────
  const startChallenge = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.log('Fullscreen request declined or unsupported.');
    }
    setHasStarted(true);
  };

  const calculateScore = useCallback((payload) => {
    let finalScore = 0;
    questions.forEach(q => {
      if (payload[q.id] && payload[q.id] === q.question_bank?.correct_answer) {
        finalScore += q.question_bank?.points || 10;
      }
    });
    return finalScore;
  }, [questions]);

  // ── 5. Final Submission ──────────────────────────────────────
  // ── C: Atomic double-submission prevention ──────────────────
  const submitEvent = useCallback(async () => {
    if (isSubmittingRef.current) return;
    const pid = participationIdRef.current;
    if (!pid) {
      console.error('❌ SUBMIT_FAILED: participationId not yet loaded');
      return;
    }
    if (isMountedRef.current) setIsSubmitting(true);
    isSubmittingRef.current = true;

    const payload = JSON.parse(localStorage.getItem(`event_${id}_answers`) || '{}');
    const finalScore = calculateScore(payload);

    // C: Use .neq('status','submitted') so DB only accepts the first write.
    // If another tab already submitted, this update matches 0 rows (idempotent).
    const { error, data: updated } = await supabase.from('participation')
      .update({ answers: payload, score: finalScore, status: 'submitted' })
      .eq('id', pid)
      .neq('status', 'submitted')   // ← server-side idempotency guard
      .select('id');

    if (error) {
      console.error('❌ SUBMIT_ERROR', error);
      // Retry once on network error (but not if already submitted)
      await supabase.from('participation')
        .update({ answers: payload, score: finalScore, status: 'submitted' })
        .eq('id', pid)
        .neq('status', 'submitted');
    }

    // Whether we wrote or another tab already did, navigate to results
    // Fix #8: clean up ALL event localStorage keys on submission
    cleanupEventKeys();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    navigate(`/results/${id}`);
  }, [id, calculateScore, navigate, cleanupEventKeys]);

  // ── FIX #3: forceCheatSubmission reads from ref ──────────────
  const forceCheatSubmission = useCallback(async () => {
    const pid = participationIdRef.current;
    if (!pid) return;
    isSubmittingRef.current = true;
    if (isMountedRef.current) setIsSubmitting(true);

    const payload = JSON.parse(localStorage.getItem(`event_${id}_answers`) || '{}');
    const finalScore = calculateScore(payload);

    await supabase.from('participation').update({
      answers: payload,
      score: finalScore,
      status: 'completed',
      violations: 3
    }).eq('id', pid)
      .neq('status', 'submitted');  // C: also idempotent

    // Fix #8: also clean up on forced cheat submission
    cleanupEventKeys();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }, [id, calculateScore, cleanupEventKeys]);

  // ── FIX #4: Anti-cheat uses ref for violations ───────────────
  useEffect(() => {
    if (!hasStarted || isSubmitting) return;

    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('paste', preventDefault);

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittingRef.current) {
        const newV = violationsRef.current + 1;
        violationsRef.current = newV;

        const pid = participationIdRef.current;
        if (pid) {
          supabase.from('participation').update({ violations: newV }).eq('id', pid).then();
        }

        if (isMountedRef.current) {
          setViolations(newV);
          setShowViolationBanner(true);
          if (newV < 3) {
            setTimeout(() => {
              if (isMountedRef.current) setShowViolationBanner(false);
            }, 5000);
          }
        }

        if (newV >= 3) {
          forceCheatSubmission();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasStarted, isSubmitting, forceCheatSubmission]);

  // ── 3. Offline-first Sync Mechanism ─────────────────────────
  const triggerSyncWorker = useCallback(async () => {
    if (syncWorkerRunning.current || syncQueueRef.current.length === 0) return;
    syncWorkerRunning.current = true;

    while (syncQueueRef.current.length > 0) {
      const payload = syncQueueRef.current[syncQueueRef.current.length - 1];
      syncQueueRef.current = [];
      const pid = participationIdRef.current;
      if (!pid) {
        await new Promise(r => setTimeout(r, 1000));
        if (participationIdRef.current) {
          syncQueueRef.current.push(payload);
        }
        break;
      }
      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase.from('participation').update({ answers: payload }).eq('id', pid);
          if (error) throw error;
          break;
        } catch (e) {
          retries--;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    syncWorkerRunning.current = false;
  }, []);

  const answerQuestion = useCallback((questionId, option) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option };
      localStorage.setItem(`event_${id}_answers`, JSON.stringify(next));
      syncQueueRef.current.push(next);
      triggerSyncWorker();
      return next;
    });
  }, [id, triggerSyncWorker]);

  // ── Admin Interrupt Subscription ─────────────────────────────
  // ── H: Track realtime status + Fix #3: re-sync on reconnect ──
  useEffect(() => {
    if (!eventData || !hasStarted) return;

    const endChannel = supabase.channel(`live-interrupt-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}`
      }, (payload) => {
        if (payload.new.status === 'ended') {
          forceCheatSubmission();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          // Fix #3: if we reconnected after a disconnect, re-fetch event state
          // to catch any status changes we missed while offline
          if (wasDisconnectedRef.current) {
            wasDisconnectedRef.current = false;
            supabase.from('events').select('status').eq('id', id).single().then(({ data }) => {
              if (data?.status === 'ended') forceCheatSubmission();
            });
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
          wasDisconnectedRef.current = true;  // remember we were disconnected
        }
      });

    return () => supabase.removeChannel(endChannel);
  }, [eventData, hasStarted, id, forceCheatSubmission]);

  // ── 4. Server-Side Global Timer ─────────────────────────────
  useEffect(() => {
    if (!eventData || !hasStarted || !eventData.end_at) return;

    // Fix #1: Use serverNow() (Date.now() + clockOffset) to eliminate client drift
    const endMs = new Date(eventData.end_at).getTime();

    const interval = setInterval(() => {
      // Fix #1: every tick uses server-adjusted time
      const distance = endMs - serverNow();

      if (distance <= 0) {
        clearInterval(interval);
        if (!isSubmittingRef.current) submitEvent();
      } else {
        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        const timeStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (isMountedRef.current) setTimeLeftStr(timeStr);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [eventData, hasStarted, submitEvent]);


  // ── Render guards ─────────────────────────────────────────────

  if (loading) return (
    <div className="text-center p-20">
      <div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto" />
    </div>
  );

  // G: Error state with retry — Fix #6: retry cooldown prevents spam calls
  if (error) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
      <div className="glass-card p-10 max-w-lg border-red-500/30">
        <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-white mb-3">Failed to Load Event</h2>
        <p className="text-slate-400 mb-6">{error}</p>
        <button
          disabled={retrying}
          onClick={() => {
            if (retrying) return;           // Fix #6: ref-like guard
            setRetrying(true);
            // Re-enable after 5s regardless of outcome
            setTimeout(() => setRetrying(false), 5000);
            window.location.reload();
          }}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );

  // FATAL CHEAT SCREEN
  if (violations >= 3) {
    return (
      <div className="min-h-screen bg-red-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <ShieldAlert className="w-24 h-24 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-widest">Access Revoked</h1>
        <p className="text-red-200 text-lg max-w-xl bg-red-900/50 p-6 rounded-xl border border-red-500/50">
          Your event session was forcibly submitted and terminated due to multiple cheating violations (Switching tabs/windows).
        </p>
        <button onClick={() => navigate('/events')} className="mt-8 px-8 py-3 bg-white text-red-950 font-bold rounded-xl shadow-lg">Return Home</button>
      </div>
    );
  }

  // Pre-Start Lock Screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="glass-card p-10 max-w-xl border-emerald-500/30">
          <h1 className="text-3xl font-black text-white mb-2">{eventData.title}</h1>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-8">Competition Engine Ready</p>

          <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-lg text-left mb-8 space-y-3 shadow-inner">
            <p className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-500" /> Anti-Cheat Rules Enforced:
            </p>
            <ul className="text-sm text-slate-400 pl-6 list-disc space-y-1">
              <li>Switching tabs or windows will trigger a violation strike.</li>
              <li>Copy, paste, and right-click have been strictly disabled.</li>
              <li>Accumulating 3 strikes instantly terminates your session.</li>
            </ul>
          </div>

          <button onClick={startChallenge} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg uppercase tracking-widest rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 active:scale-95">
            Enter Fullscreen &amp; Begin
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN COMPETITION ENGINE ───────────────────────────────────
  const type = eventData?.type;

  const renderMode = () => {
    if (type === 'rapid_fire') {
      return (
        <RapidFireMode
          questions={questions}
          answers={answers}
          answerQuestion={answerQuestion}
          onSubmit={submitEvent}
          isSubmitting={isSubmitting}
          eventId={id}
          userId={user?.id}
        />
      );
    }
    if (type === 'treasure_hunt') {
      return (
        <TreasureHuntMode
          questions={questions}
          answers={answers}
          answerQuestion={answerQuestion}
          onSubmit={submitEvent}
          isSubmitting={isSubmitting}
        />
      );
    }
    return (
      <NormalQuizMode
        questions={questions}
        answers={answers}
        answerQuestion={answerQuestion}
        onSubmit={submitEvent}
        isSubmitting={isSubmitting}
      />
    );
  };

  return (
    <LocalErrorBoundary>
      <div className="min-h-screen bg-slate-950 select-none overflow-x-hidden">

        {/* Violation Warning Banner */}
        {showViolationBanner && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 px-4 font-bold text-xs sm:text-sm uppercase tracking-widest animate-pulse shadow-2xl">
            ⚠ Violation {violations}/3 — Tab switch detected!
          </div>
        )}

        {/* H: Realtime Reconnecting Banner */}
        {realtimeStatus === 'reconnecting' && (
          <div className="fixed top-0 left-0 right-0 z-[99] bg-amber-600/90 text-white text-center py-1.5 px-4 font-bold text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            Reconnecting to server — answers are saved locally
          </div>
        )}

        {/* Top HUD Bar */}
        <div className="fixed top-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 z-50 px-3 sm:px-6 py-2.5 flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
              {eventData.title}
            </span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 border border-slate-700 capitalize shrink-0">
              {(type || 'quiz').replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {timeLeftStr && (
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm">{timeLeftStr}</span>
              </div>
            )}
            {violations > 0 && (
              <div className="flex items-center gap-1 bg-red-900/50 px-2.5 py-1.5 rounded-lg border border-red-500/50">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span className="font-bold text-red-400 text-xs sm:text-sm">{violations}/3</span>
              </div>
            )}
            {/* H: Network indicator */}
            {realtimeStatus === 'reconnecting' && (
              <div className="flex items-center gap-1 bg-amber-900/40 px-2.5 py-1.5 rounded-lg border border-amber-500/30">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="pt-14 grid grid-cols-1 xl:grid-cols-4 min-h-screen">

          {/* Quiz Area */}
          <div className="col-span-1 xl:col-span-3 overflow-x-hidden">
            {renderMode()}
          </div>

          {/* Live Leaderboard Sidebar */}
          <div className="hidden xl:flex flex-col h-screen sticky top-14 border-l border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <LiveLeaderboard
              eventId={id}
              currentUserId={user?.id}
              limit={15}
            />
          </div>
        </div>
      </div>
    </LocalErrorBoundary>
  );
}
