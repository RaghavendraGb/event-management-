import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, serverNow } from '../../lib/supabase';
import { useStore } from '../../store';
import { Clock, AlertOctagon, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

import { NormalQuizMode } from '../../components/live/NormalQuizMode';
import { CompetitiveQuizMode } from '../../components/live/CompetitiveQuizMode';
import { RapidFireMode } from '../../components/live/RapidFireMode';
import { TournamentKnockout } from '../../components/live/TournamentKnockout';
import YouAndMeMatch from '../../components/live/YouAndMeMatch';
import { TreasureHuntMode } from '../../components/live/TreasureHuntMode';
import { SimulationMode } from '../../components/live/SimulationMode';
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
        <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)', padding: 40, fontFamily: 'ui-monospace, monospace' }}>
          <h1 style={{ color: 'var(--red)', fontSize: 24, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase' }}>Frontend Crash Captured</h1>
          <div style={{ background: 'var(--surface)', padding: 24, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', overflow: 'auto' }}>
            <p style={{ fontSize: 18, marginBottom: 16 }}>{this.state.error?.message}</p>
            <pre style={{ fontSize: 12, color: 'var(--text-muted)' }}>{this.state.error?.stack}</pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{ marginTop: 24 }}
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
  // Feature 2: read preloaded questions from Lobby
  const preloadedQuestions = useStore(state => state.preloadedQuestions);
  const clearPreloadedQuestions = useStore(state => state.clearPreloadedQuestions);

  const [eventData, setEventData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participationId, setParticipationId] = useState(null);

  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [simDone, setSimDone] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [submitQueued, setSubmitQueued] = useState(false);
  const [treasureGlobalEnded, setTreasureGlobalEnded] = useState(false);

  // ── H: Realtime connection status for network-aware UI ────────
  const [realtimeStatus, setRealtimeStatus] = useState('connected');
  // Fix #3: track whether we were previously CHANNEL_ERROR so we re-sync on reconnect
  const wasDisconnectedRef = useRef(false);

  // Fix #6: retry cooldown to prevent spam-clicking the Retry button
  const [retrying, setRetrying] = useState(false);

  const ANSWERS_KEY = `event_${id}_answers`;
  const PENDING_SYNC_KEY = `event_${id}_pending_sync`;
  const PENDING_SUBMIT_KEY = `event_${id}_pending_submit`;

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

  const syncWorkerRunning = useRef(false);

  const persistPendingSync = useCallback((payload) => {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(payload));
    if (isMountedRef.current) setHasPendingSync(true);
  }, [PENDING_SYNC_KEY]);

  const clearPendingSync = useCallback(() => {
    localStorage.removeItem(PENDING_SYNC_KEY);
    if (isMountedRef.current) setHasPendingSync(false);
  }, [PENDING_SYNC_KEY]);

  // ── 1. Core Boot Sequence ─────────────────────────────────────
  useEffect(() => {
    async function bootEngine() {
      console.log('🚀 LIVE_EVENT_BOOT_START', { id, userId: user?.id });
      if (!user) return navigate('/login');

      try {
        // ── G: try/catch on all fetches ──
        const { data: eData, error: eErr } = await supabase.from('events').select('*').eq('id', id).single();
        if (eErr || !eData) throw new Error(eErr?.message || 'Event not found');
        if (eData.status === 'ended' && eData.type !== 'treasure_hunt') return navigate(`/results/${id}`);
        // Block exam entry if results have already been announced
        if (eData.results_announced === true && eData.type !== 'treasure_hunt') return navigate(`/results/${id}`);
        // Redirect coding events to their dedicated coding arena
        if (eData.type === 'coding_challenge') return navigate(`/live-coding/${id}`);
        if (isMountedRef.current) setEventData(eData);

        // ── A: Populate single source of truth in global store ──
        // (totalQuestions will be updated after we fetch questions below)
        setLiveEventRuntime({
          eventId: id,
          eventTitle: eData.title,
          status: eData.status,
          startTime: eData.start_at ? new Date(eData.start_at).getTime() : null,
          endTime: eData.end_at ? new Date(eData.end_at).getTime() : null,
          currentQuestionIndex: 0,
          totalQuestions: 0,
          timeLeftStr: '',
          questionStartTime: null,
        });

        // Feature 2: Use preloaded questions from Lobby if available for this event
        let qData;
        if (eData.type === 'treasure_hunt' || (eData.type === 'quiz' && eData.quiz_mode === 'competitive')) {
          qData = [];
        } else if (preloadedQuestions?.eventId === id && preloadedQuestions?.questions?.length > 0) {
          console.log('✅ USING_PRELOADED_QUESTIONS', preloadedQuestions.questions.length);
          qData = preloadedQuestions.questions;
          clearPreloadedQuestions();
        } else {
          const { data: fetched, error: qErr } = await supabase
            .from('event_questions')
            .select('*, question_bank(*)')
            .eq('event_id', id)
            .order('order_num', { ascending: true });
          if (qErr) console.error('❌ QUESTIONS_ERROR', qErr);
          qData = fetched || [];
        }

        if (isMountedRef.current) setQuestions(qData);
        // Patch totalQuestions now that we have the count
        patchLiveEventRuntime({ totalQuestions: qData.length });

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
        if (pData.status === 'submitted' && eData.type !== 'treasure_hunt') return navigate(`/results/${id}`);

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
  }, [id, user, navigate, setLiveEventRuntime, patchLiveEventRuntime, preloadedQuestions, clearPreloadedQuestions]);

  // ── 2. Anti-Cheat & Fullscreen Bootstrap ────────────────────
  const startChallenge = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
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

    const payload = JSON.parse(localStorage.getItem(ANSWERS_KEY) || '{}');
    const finalScore = calculateScore(payload);

    if (!navigator.onLine) {
      localStorage.setItem(PENDING_SUBMIT_KEY, JSON.stringify({ answers: payload, score: finalScore }));
      persistPendingSync(payload);
      if (isMountedRef.current) {
        setSubmitQueued(true);
        setIsSubmitting(false);
      }
      isSubmittingRef.current = false;
      return;
    }

    try {
      // C: Use .neq('status','submitted') so DB only accepts the first write.
      // If another tab already submitted, this update matches 0 rows (idempotent).
      const { error } = await supabase.from('participation')
        .update({ answers: payload, score: finalScore, status: 'submitted' })
        .eq('id', pid)
        .neq('status', 'submitted');

      if (error) throw error;
    } catch (e) {
      console.error('❌ SUBMIT_ERROR', e);
      localStorage.setItem(PENDING_SUBMIT_KEY, JSON.stringify({ answers: payload, score: finalScore }));
      persistPendingSync(payload);
      if (isMountedRef.current) {
        setSubmitQueued(true);
        setIsSubmitting(false);
      }
      isSubmittingRef.current = false;
      return;
    }

    // Whether we wrote or another tab already did, navigate to results
    // Fix #8: clean up ALL event localStorage keys on submission
    cleanupEventKeys();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    navigate(`/results/${id}`);
  }, [ANSWERS_KEY, PENDING_SUBMIT_KEY, calculateScore, id, navigate, cleanupEventKeys, persistPendingSync]);

  // ── FIX #3: forceCheatSubmission reads from ref ──────────────
  const forceCheatSubmission = useCallback(async () => {
    const pid = participationIdRef.current;
    if (!pid) return;
    isSubmittingRef.current = true;
    if (isMountedRef.current) setIsSubmitting(true);

    const payload = JSON.parse(localStorage.getItem(ANSWERS_KEY) || '{}');
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
  }, [ANSWERS_KEY, calculateScore, cleanupEventKeys]);

  // ── FIX #4: Anti-cheat uses ref for violations ───────────────
  useEffect(() => {
    if (!hasStarted || isSubmitting) return;
    if (eventData?.type === 'quiz' && eventData?.quiz_mode === 'competitive') return;
    if (eventData?.type === 'treasure_hunt') return;
    if (eventData?.type === 'youandme') return;
    if (eventData?.type === 'rapid_fire' && eventData?.rapid_fire_style === 'knockout_tournament') return;

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
  }, [hasStarted, isSubmitting, forceCheatSubmission, eventData?.type, eventData?.quiz_mode, eventData?.rapid_fire_style]);

  // ── 3. Offline-first Sync Mechanism ─────────────────────────
  const flushPendingSubmission = useCallback(async () => {
    if (isSubmittingRef.current || !navigator.onLine) return;
    const raw = localStorage.getItem(PENDING_SUBMIT_KEY);
    if (!raw) return;
    const pid = participationIdRef.current;
    if (!pid) return;

    isSubmittingRef.current = true;
    if (isMountedRef.current) setIsSubmitting(true);

    try {
      const parsed = JSON.parse(raw);
      const payload = parsed?.answers || {};
      const score = Number(parsed?.score || 0);

      const { error } = await supabase
        .from('participation')
        .update({ answers: payload, score, status: 'submitted' })
        .eq('id', pid)
        .neq('status', 'submitted');

      if (error) throw error;

      localStorage.removeItem(PENDING_SUBMIT_KEY);
      if (isMountedRef.current) setSubmitQueued(false);
      cleanupEventKeys();
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      navigate(`/results/${id}`);
    } catch (e) {
      console.error('❌ PENDING_SUBMIT_FLUSH_FAILED', e);
      if (isMountedRef.current) setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [PENDING_SUBMIT_KEY, cleanupEventKeys, id, navigate]);

  const triggerSyncWorker = useCallback(async () => {
    if (syncWorkerRunning.current || !navigator.onLine) return;
    const pendingRaw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!pendingRaw) {
      await flushPendingSubmission();
      return;
    }

    syncWorkerRunning.current = true;

    const pid = participationIdRef.current;
    if (!pid) {
      syncWorkerRunning.current = false;
      return;
    }

    try {
      const payload = JSON.parse(pendingRaw);
      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase.from('participation').update({ answers: payload }).eq('id', pid);
          if (error) throw error;
          clearPendingSync();
          break;
        } catch {
          retries--;
          if (retries > 0) await new Promise((r) => setTimeout(r, 1500));
        }
      }

      await flushPendingSubmission();
    } catch (e) {
      console.error('❌ SYNC_WORKER_ERROR', e);
    }

    syncWorkerRunning.current = false;
  }, [PENDING_SYNC_KEY, clearPendingSync, flushPendingSubmission]);

  const answerQuestion = useCallback((questionId, option) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option };
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(next));
      persistPendingSync(next);
      triggerSyncWorker();
      return next;
    });
  }, [ANSWERS_KEY, persistPendingSync, triggerSyncWorker]);

  useEffect(() => {
    const hasPending = !!localStorage.getItem(PENDING_SYNC_KEY);
    const hasQueuedSubmit = !!localStorage.getItem(PENDING_SUBMIT_KEY);
    if (hasPending && isMountedRef.current) setHasPendingSync(true);
    if (hasQueuedSubmit && isMountedRef.current) setSubmitQueued(true);
    if (hasPending || hasQueuedSubmit) {
      triggerSyncWorker();
    }
  }, [PENDING_SUBMIT_KEY, PENDING_SYNC_KEY, triggerSyncWorker]);

  useEffect(() => {
    const handleOnline = () => {
      triggerSyncWorker();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [triggerSyncWorker]);

  // ── Admin Interrupt Subscription ─────────────────────────────
  // ── H: Track realtime status + Fix #3: re-sync on reconnect ──
  useEffect(() => {
    if (!eventData || !hasStarted) return;

    const endChannel = supabase.channel(`live-interrupt-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}`
      }, (payload) => {
        if (payload.new.status === 'ended') {
          if (eventData?.type === 'treasure_hunt') {
            if (isMountedRef.current) setTreasureGlobalEnded(true);
            return;
          }
          forceCheatSubmission();
          return;
        }
        // If admin announces results while the event is still live — navigate cleanly without force-submitting
        if (payload.new.results_announced === true) {
          if (isMountedRef.current) navigate(`/results/${id}`);
          return;
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
              if (data?.status === 'ended') {
                if (eventData?.type === 'treasure_hunt') {
                  if (isMountedRef.current) setTreasureGlobalEnded(true);
                  return;
                }
                forceCheatSubmission();
              }
            });
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
          wasDisconnectedRef.current = true;  // remember we were disconnected
        }
      });

    return () => supabase.removeChannel(endChannel);
  }, [eventData, hasStarted, id, forceCheatSubmission, navigate]);

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
        if (eventData?.type === 'treasure_hunt' || (eventData?.type === 'quiz' && eventData?.quiz_mode === 'competitive')) {
          if (isMountedRef.current) {
            setTimeLeftStr('00:00');
            patchLiveEventRuntime({ timeLeftStr: '00:00' });
          }
        } else if (eventData?.type === 'quiz' && eventData?.quiz_mode !== 'competitive') {
          // Standard quiz should not force-submit unexpectedly on timer drift/misconfigured end_at.
          // Let participant complete review and submit manually.
          if (isMountedRef.current) {
            setTimeLeftStr('Time up - submit when ready');
            patchLiveEventRuntime({ timeLeftStr: 'Time up - submit when ready' });
          }
        } else if (!isSubmittingRef.current) {
          submitEvent();
        }
      } else {
        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        const timeStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (isMountedRef.current) {
          setTimeLeftStr(timeStr);
          // Feature 1: patch store every second so LiveBanner stays current
          patchLiveEventRuntime({ timeLeftStr: timeStr });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [eventData, hasStarted, submitEvent, patchLiveEventRuntime]);

  // ── Feature 4: Soft lock — beforeunload when event is active ──
  useEffect(() => {
    if (!hasStarted || isSubmitting) return;
    if (eventData?.type === 'quiz' && eventData?.quiz_mode === 'competitive') return;
    if (eventData?.type === 'treasure_hunt') return;
    if (eventData?.type === 'youandme') return;
    if (eventData?.type === 'rapid_fire' && eventData?.rapid_fire_style === 'knockout_tournament') return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasStarted, isSubmitting, eventData?.type, eventData?.quiz_mode, eventData?.rapid_fire_style]);

  // Feature 1: stable callback for NormalQuizMode to report current question index
  // MUST be declared here (top-level hook, before all conditional returns)
  const handleQuestionChange = useCallback(
    (idx) => {
      setCurrentQuestionIndex(idx);
      patchLiveEventRuntime({ currentQuestionIndex: idx });
    },
    [patchLiveEventRuntime]
  );


  // ── Render guards ─────────────────────────────────────────────

  if (loading) return (
    <div className="text-center p-20">
      <div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto" />
    </div>
  );

  // G: Error state with retry — Fix #6: retry cooldown prevents spam calls
  if (error) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '40px 32px', maxWidth: 480, width: '100%' }}>
        <WifiOff size={48} style={{ color: 'var(--red)', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Failed to Load Event</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
        <button
          disabled={retrying}
          onClick={() => {
            if (retrying) return;
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

  const type = eventData?.type;
  const isRealtimeManagedMode =
    type === 'treasure_hunt' ||
    (type === 'quiz' && eventData?.quiz_mode === 'competitive') ||
    type === 'youandme' ||
    (type === 'rapid_fire' && eventData?.rapid_fire_style === 'knockout_tournament');

  // FATAL CHEAT SCREEN
  if (!isRealtimeManagedMode && violations >= 3) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <ShieldAlert size={80} style={{ color: 'var(--red)', marginBottom: 24 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Access Revoked</h1>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: 24, borderRadius: 12, maxWidth: 520, width: '100%' }}>
          <p style={{ fontSize: 15, color: 'var(--red)', fontWeight: 600, lineHeight: 1.6 }}>
            Your session was terminated due to multiple cheating violations (switch detected).
          </p>
        </div>
        <button onClick={() => navigate('/events')} className="btn-primary" style={{ marginTop: 32 }}>Return to Events</button>
      </div>
    );
  }

  // Pre-Start Lock Screen
  if (!isRealtimeManagedMode && !hasStarted) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 32px', maxWidth: 520, width: '100%' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{eventData.title}</h1>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 32 }}>Competition Engine Ready</p>

          <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', padding: 24, borderRadius: 8, textAlign: 'left', marginBottom: 32 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertOctagon size={16} style={{ color: 'var(--amber)' }} /> Rules & Security
            </p>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Switching tabs/windows will trigger a violation strike.</li>
              <li>Copy, paste, and right-click are strictly disabled.</li>
              <li>Accumulating 3 strikes terminates your session instantly.</li>
            </ul>
          </div>

          <button onClick={startChallenge} className="btn-primary" style={{ width: '100%', padding: '14px 24px', fontSize: 16 }}>
            Enter Fullscreen & Begin
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN COMPETITION ENGINE ───────────────────────────────────

  const renderMode = () => {
    if (type === 'youandme') {
      return (
        <YouAndMeMatch
          eventId={id}
          userId={user?.id}
          opponentId={eventData?.opponent_id}
          onSubmit={submitEvent}
        />
      );
    }
    if (type === 'rapid_fire' && eventData?.rapid_fire_style === 'knockout_tournament') {
      return (
        <TournamentKnockout
          eventId={id}
          userId={user?.id}
          onSubmit={submitEvent}
        />
      );
    }
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
    if (type === 'quiz' && eventData?.quiz_mode === 'competitive') {
      return <CompetitiveQuizMode eventId={id} />;
    }
    if (type === 'treasure_hunt') {
      return (
        <TreasureHuntMode
          eventId={id}
          forcedEnded={treasureGlobalEnded}
        />
      );
    }

    const currentQ = questions[currentQuestionIndex];
    const isSimulation = currentQ?.question_bank?.question_type === 'simulation' && !simDone;

    return (
      <div className="relative">
        <div style={{ display: isSimulation ? 'none' : 'block' }}>
          <NormalQuizMode
            questions={questions}
            answers={answers}
            answerQuestion={answerQuestion}
            onSubmit={submitEvent}
            isSubmitting={isSubmitting}
            onQuestionChange={handleQuestionChange}
          />
        </div>
        
        {isSimulation && (
          <SimulationMode
            question={currentQ}
            user={user}
            eventId={id}
            participationId={participationIdRef.current}
            onSimSubmitted={() => {
              // Mark as answered so NormalQuizMode shows it as completed
              answerQuestion(currentQ.id, 'simulation_submitted');
            }}
            onNext={() => {
              setSimDone(true);
              // Briefly hide then show to trigger NormalQuizMode's internal re-render
              // but we stay on the same index, student manually clicks Next
              setTimeout(() => setSimDone(false), 100);
            }}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    );
  };

  return (
    <LocalErrorBoundary>
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowX: 'hidden', userSelect: 'none' }}>

        {/* Violation Warning Banner */}
        {showViolationBanner && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'var(--red)', color: '#fff', textAlign: 'center', padding: '10px 16px', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'pulse 2s infinite' }}>
            ⚠ Violation {violations}/3 — Tab switch detected!
          </div>
        )}

        {/* H: Realtime Reconnecting Banner */}
        {realtimeStatus === 'reconnecting' && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99, background: 'var(--amber)', color: '#000', textAlign: 'center', padding: '8px 16px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <WifiOff size={14} /> Reconnecting to server — answers are saved locally
          </div>
        )}

        {(hasPendingSync || submitQueued) && (
          <div style={{ position: 'fixed', top: realtimeStatus === 'reconnecting' ? 34 : 0, left: 0, right: 0, zIndex: 98, background: 'rgba(37,99,235,0.92)', color: '#fff', textAlign: 'center', padding: '8px 16px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Wifi size={14} />
            {submitQueued ? 'Final submission queued. Will auto-submit when online.' : 'Unsynced answers detected. Auto-sync on reconnect.'}
          </div>
        )}

        {/* Top HUD Bar */}
        <div style={{ position: 'fixed', top: (hasPendingSync || submitQueued) ? (realtimeStatus === 'reconnecting' ? 68 : 34) : (realtimeStatus === 'reconnecting' ? 34 : 0), left: 0, right: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 50, padding: '8px 16px', height: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="live-dot" />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eventData.title}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: 'var(--elevated)', borderRadius: 99, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {(type || 'quiz').replace('_', ' ')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {timeLeftStr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Clock size={12} style={{ color: 'var(--amber)' }} />
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.04em' }}>{timeLeftStr}</span>
              </div>
            )}
            {violations > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(239,68,68,0.25)' }}>
                <ShieldAlert size={12} style={{ color: 'var(--red)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{violations}/3</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ paddingTop: (hasPendingSync || submitQueued) ? (realtimeStatus === 'reconnecting' ? 116 : 82) : (realtimeStatus === 'reconnecting' ? 82 : 48), display: 'grid', gridTemplateColumns: '1fr', minHeight: '100dvh' }} id="live-event-grid">
          <style>{`@media (min-width: 1280px) { #live-event-grid { grid-template-columns: 1fr 340px; } }`}</style>

          {/* Quiz Area */}
          <div style={{ overflowX: 'hidden' }}>
            {renderMode()}
          </div>

          {/* Live Leaderboard Sidebar */}
          <div style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'none' }} id="live-leaderboard-aside">
            <style>{`@media (min-width: 1280px) { #live-leaderboard-aside { display: flex; flex-direction: column; height: calc(100dvh - 48px); position: sticky; top: 48px; } }`}</style>
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
