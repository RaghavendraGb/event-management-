import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { Clock, AlertOctagon, ShieldAlert } from 'lucide-react';

import { NormalQuizMode } from '../../components/live/NormalQuizMode';
import { RapidFireMode } from '../../components/live/RapidFireMode';
import { TreasureHuntMode } from '../../components/live/TreasureHuntMode';
import { LiveLeaderboard } from '../../components/live/LiveLeaderboard';

export function LiveEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore(state => state.user);

  const [eventData, setEventData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participationId, setParticipationId] = useState(null);
  
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');

  // Anti-Cheat States
  const [hasStarted, setHasStarted] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showViolationBanner, setShowViolationBanner] = useState(false);

  const syncQueueRef = useRef([]);
  const syncWorkerRunning = useRef(false);

  // 1. Core Boot Sequence
  useEffect(() => {
    async function bootEngine() {
      if (!user) return navigate('/login');

      const { data: eData } = await supabase.from('events').select('*').eq('id', id).single();
      if (!eData) return navigate('/');
      if (eData.status === 'ended') return navigate(`/results/${id}`);
      setEventData(eData);

      const { data: qData } = await supabase
        .from('event_questions')
        .select('*, question_bank(*)')
        .eq('event_id', id)
        .order('order_num', { ascending: true });
        
      setQuestions(qData || []);

      const { data: pData } = await supabase
        .from('participation')
        .select('id, answers, status, violations')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .single();
        
      if (!pData) return navigate(`/events/${id}`);
      if (pData.status === 'completed') return navigate(`/results/${id}`);
      setParticipationId(pData.id);
      if (pData.violations) setViolations(pData.violations);

      const localS = localStorage.getItem(`event_${id}_answers`);
      if (localS) {
        setAnswers(JSON.parse(localS));
      } else if (pData.answers) {
        setAnswers(pData.answers);
        localStorage.setItem(`event_${id}_answers`, JSON.stringify(pData.answers));
      }

      setLoading(false);
    }
    bootEngine();
  }, [id, user, navigate]);

  // 2. Anti-Cheat & Fullscreen Bootstrap
  const startChallenge = async () => {
    // Attempt Fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.log("Fullscreen request declined or unsupported.");
    }
    setHasStarted(true);
  };

  useEffect(() => {
    if (!hasStarted || isSubmitting) return;

    // DOM Lockdowns
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('paste', preventDefault);

    // Tab Blur / Visibility Logger
    const handleVisibilityChange = async () => {
      if (document.hidden && !isSubmitting) {
        setViolations(prev => {
          const newV = prev + 1;
          
          // Log Violation instantly to DB
          supabase.from('participation').update({ violations: newV }).eq('id', participationId).then();
          
          setShowViolationBanner(true);
          // Hide banner after 5s unless it's the final fatal strike
          if (newV < 3) {
            setTimeout(() => setShowViolationBanner(false), 5000);
          }
          
          // Enforce execution on 3rd strike
          if (newV >= 3) {
            forceCheatSubmission();
          }

          return newV;
        });
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
    // eslint-disable-next-line
  }, [hasStarted, participationId, isSubmitting]);

  const calculateScore = useCallback((payload) => {
    let finalScore = 0;
    questions.forEach(q => {
       if (payload[q.id] && payload[q.id] === q.question_bank?.correct_answer) {
         finalScore += q.question_bank?.points || 10;
       }
    });
    return finalScore;
  }, [questions]);

  const forceCheatSubmission = useCallback(async () => {
    setIsSubmitting(true);
    const payload = JSON.parse(localStorage.getItem(`event_${id}_answers`) || '{}');
    const finalScore = calculateScore(payload);

    await supabase.from('participation').update({
      answers: payload,
      score: finalScore,
      status: 'completed',
      violations: 3
    }).eq('id', participationId);
    
    localStorage.removeItem(`event_${id}_answers`);
    // Exit fullscreen
    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  }, [id, participationId, calculateScore]);

  // 3. Offline-first Sync Mechanism
  const answerQuestion = useCallback((questionId, option) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option };
      localStorage.setItem(`event_${id}_answers`, JSON.stringify(next));
      syncQueueRef.current.push(next);
      triggerSyncWorker();
      return next;
    });
  }, [id]);

  const triggerSyncWorker = async () => {
    if (syncWorkerRunning.current || syncQueueRef.current.length === 0) return;
    syncWorkerRunning.current = true;

    while (syncQueueRef.current.length > 0) {
      const payload = syncQueueRef.current[syncQueueRef.current.length - 1]; 
      syncQueueRef.current = [];
      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase.from('participation').update({ answers: payload }).eq('id', participationId);
          if (error) throw error;
          break;
        } catch (e) {
          retries--;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    syncWorkerRunning.current = false;
  };

  // Postgres Status Subscription for Admin Interrupts
  useEffect(() => {
    if (!eventData || !hasStarted) return;
    
    const endChannel = supabase.channel(`live-interrupt-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new.status === 'ended') {
           forceCheatSubmission(); // Safely wraps up answers and redirects to results
        }
      })
      .subscribe();

    return () => supabase.removeChannel(endChannel);
  }, [eventData, hasStarted, id, forceCheatSubmission]);

  // 4. Strict Server-Side Derived Timer (Quiz Mode Only)
  useEffect(() => {
    if (!eventData || eventData.type !== 'quiz' || !hasStarted) return;
    const endMs = new Date(eventData.end_at).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const distance = endMs - now;

      if (distance <= 0) {
        clearInterval(interval);
        submitEvent();
      } else {
        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeftStr(`${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [eventData, hasStarted, submitEvent]);

  // 5. Final Submission
  const submitEvent = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const payload = JSON.parse(localStorage.getItem(`event_${id}_answers`) || '{}');
    const finalScore = calculateScore(payload);

    await supabase.from('participation').update({ 
      answers: payload, 
      score: finalScore,
      status: 'completed' 
    }).eq('id', participationId);
    
    localStorage.removeItem(`event_${id}_answers`);
    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    navigate(`/results/${id}`);
  }, [isSubmitting, id, participationId, calculateScore, navigate]);


  if (loading) return <div className="text-center p-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto"></div></div>;

  // FATAL CHEAT SCREEN (Locked)
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

  // Pre-Start Lock Screen (Wait to capture Fullscreen interaction)
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="glass-card p-10 max-w-xl border-emerald-500/30">
          <h1 className="text-3xl font-black text-white mb-2">{eventData.title}</h1>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-8">Competition Engine Ready</p>
          
          <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-lg text-left mb-8 space-y-3 shadow-inner">
             <p className="text-sm font-bold text-slate-300 flex items-center gap-2">
               <AlertOctagon className="w-4 h-4 text-amber-500"/> Anti-Cheat Rules Enforced:
             </p>
             <ul className="text-sm text-slate-400 pl-6 list-disc space-y-1">
               <li>Switching tabs or windows will trigger a violation strike.</li>
               <li>Copy, paste, and right-click have been strictly disabled.</li>
               <li>Accumulating 3 strikes instantly terminates your session.</li>
             </ul>
          </div>

          <button onClick={startChallenge} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg uppercase tracking-widest rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 active:scale-95">
            Enter Fullscreen & Begin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pt-16 select-none">
      
      {/* Violation Slide-In Banner */}
      <div className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-transform duration-500 ${showViolationBanner ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className={`mt-4 px-8 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border flex items-center gap-4 ${
          violations === 2 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-amber-500 border-amber-300 text-amber-950'
        }`}>
          <AlertOctagon className="w-8 h-8 animate-pulse" />
          <div>
            <p className="font-black text-lg uppercase tracking-wider">
              {violations === 2 ? 'Final Warning (2/3)' : 'Violation Logged (1/3)'}
            </p>
            <p className="text-sm font-medium opacity-90">Switching tabs is strictly prohibited.</p>
          </div>
        </div>
      </div>

      {/* Global Live Header */}
      <div className="fixed top-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-40 h-16 flex items-center px-6 justify-between">
        <h1 className="font-bold text-white text-lg tracking-tight hidden md:block">{eventData.title}</h1>
        <div className="flex gap-2">
          {eventData.type === 'quiz' && (
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-full border border-blue-500/30 text-blue-400 font-mono font-bold tracking-wider">
              <Clock className="w-4 h-4" /> {timeLeftStr || '--:--'}
            </div>
          )}
          <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest rounded flex items-center gap-2 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Live
          </div>
        </div>
      </div>

      {/* Layout Split: Engine on Left (3/4), Leaderboard on Right (1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[calc(100vh-64px)] w-full">
        <div className="lg:col-span-3 pb-10 border-r border-white/5">
          {eventData.type === 'quiz' && (
            <NormalQuizMode 
              questions={questions} answers={answers} answerQuestion={answerQuestion} 
              onSubmit={submitEvent} isSubmitting={isSubmitting}
            />
          )}

          {eventData.type === 'rapid_fire' && (
            <RapidFireMode 
              questions={questions} answers={answers} answerQuestion={answerQuestion} 
              onSubmit={submitEvent} isSubmitting={isSubmitting}
            />
          )}

          {eventData.type === 'treasure_hunt' && (
            <TreasureHuntMode 
              questions={questions} answers={answers} answerQuestion={answerQuestion} 
              onSubmit={submitEvent} isSubmitting={isSubmitting}
            />
          )}
        </div>
        
        {/* Right Sidebar Leaderboard */}
        <div className="hidden lg:block lg:col-span-1 bg-slate-900/40 relative h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          <LiveLeaderboard eventId={id} currentUserId={user.id} />
        </div>
      </div>
    </div>
  );
}
