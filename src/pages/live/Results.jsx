import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Award, Share2, CheckCircle2, XCircle, Trophy, Clock, Users } from 'lucide-react';
// FIX #15: ref to track confetti interval for cleanup
// FIX #16: ref to track AudioContext for cleanup

export function Results() {
  const { id } = useParams();
  const user = useStore((state) => state.user);

  // Data States
  const [eventData, setEventData] = useState(null);
  const [podium, setPodium] = useState([]);
  const [personalScore, setPersonalScore] = useState(null);
  const [mySubmittedScore, setMySubmittedScore] = useState(null); // shown on waiting screen
  const [questions, setQuestions] = useState([]);
  // Feature 8: team leaderboard
  const [teamPodium, setTeamPodium] = useState([]);
  
  // Ceremony States
  // phases: 'loading' | 'waiting' | 'calculating' | 'drumroll' | 'podium-3' | 'podium-2' | 'podium-1' | 'complete'
  const [phase, setPhase] = useState('loading');
  const [fetchError, setFetchError] = useState(null);
  const waitingChannelRef = useRef(null); // realtime channel while waiting for event to end

  // FIX #15: store confetti interval ref so we can clean up on unmount
  const confettiIntervalRef = useRef(null);
  // FIX #16: store AudioContext ref so we can close it after sound
  const audioCtxRef = useRef(null);

  // Cleanup on unmount: clear confetti, close audio, remove waiting channel
  useEffect(() => {
    return () => {
      if (confettiIntervalRef.current) clearInterval(confettiIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (waitingChannelRef.current) supabase.removeChannel(waitingChannelRef.current);
    };
  }, []);

  useEffect(() => {
    async function fetchResults() {
      if (!user) return;
      try {
        // G: try/catch on all 4 supabase fetches
        const { data: eData, error: eErr } = await supabase.from('events').select('*').eq('id', id).single();
        if (eErr) throw new Error(eErr.message);
        setEventData(eData);

        const { data: leaderData, error: lErr } = await supabase
          .from('participation')
          .select('user_id, score, team_id, teams(name), users(name, avatar_url, college)')
          .eq('event_id', id)
          .order('score', { ascending: false });
        if (lErr) throw new Error(lErr.message);

        if (leaderData) {
          setPodium(leaderData.slice(0, 3));
          const myRankIndex = leaderData.findIndex(p => p.user_id === user.id);
          if (myRankIndex !== -1) {
            setPersonalScore({ rank: myRankIndex + 1, data: leaderData[myRankIndex] });
          }

          // Feature 8: Aggregate team scores
          const teamMap = {};
          leaderData.forEach(p => {
            if (!p.team_id) return;
            if (!teamMap[p.team_id]) {
              teamMap[p.team_id] = { teamName: p.teams?.name || 'Unknown Team', score: 0 };
            }
            teamMap[p.team_id].score += p.score || 0;
          });
          const sortedTeams = Object.values(teamMap).sort((a, b) => b.score - a.score);
          if (sortedTeams.length > 0) setTeamPodium(sortedTeams.slice(0, 3));
        }

        // Fetch my personal submitted score (shown on waiting screen too)
        const { data: pData, error: pErr } = await supabase
          .from('participation')
          .select('answers, score')
          .eq('user_id', user.id)
          .eq('event_id', id)
          .single();
        if (pErr) throw new Error(pErr.message);
        if (pData?.score !== undefined) setMySubmittedScore(pData.score);

        // ─── KEY FIX: Only start ceremony if event is already ended OR winner announced ──
        // Ceremony triggers on EITHER: results_announced=true OR status=ended
        const ceremonyReady = eData.status === 'ended' || eData.results_announced === true;

        if (!ceremonyReady) {
          setPhase('waiting');

          // Realtime: watch for admin announcing winner OR ending the event
          const ch = supabase
            .channel(`results-wait-${id}`)
            .on('postgres_changes', {
              event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}`
            }, (payload) => {
              const ready = payload.new.status === 'ended' || payload.new.results_announced === true;
              if (ready) {
                supabase.removeChannel(ch);
                waitingChannelRef.current = null;
                setEventData(payload.new);
                setPhase('calculating');
              }
            })
            .subscribe();
          waitingChannelRef.current = ch;

          // Don't proceed to ceremony yet — stop here
          return;
        }

        // ─── Event already ended when navigating here ─────────────────────
        const { data: qData, error: qErr } = await supabase
          .from('event_questions')
          .select('*, question_bank(*)')
          .eq('event_id', id)
          .order('order_num', { ascending: true });
        if (qErr) throw new Error(qErr.message);

        if (qData && pData) {
          const enrichedQs = qData.map(q => ({
            ...q.question_bank,
            my_answer: pData.answers?.[q.id] || null
          }));
          setQuestions(enrichedQs);
        }

        setPhase('calculating');
      } catch (err) {
        console.error('❌ RESULTS_FETCH_ERROR', err);
        setFetchError(err.message || 'Failed to load results.');
      }
    }
    
    fetchResults();
  }, [id, user]);


  // Ceremony Orchestrator Hook
  useEffect(() => {
    if (phase === 'calculating') {
      // If we transitioned from 'waiting', podium data was loaded but q-review wasn't.
      // Load final leaderboard + question review now (non-blocking — ceremony still runs).
      if (questions.length === 0) {
        (async () => {
          try {
            // Re-fetch final leaderboard (scores may have changed while waiting)
            const { data: finalLeader } = await supabase
              .from('participation')
              .select('user_id, score, team_id, teams(name), users(name, avatar_url, college)')
              .eq('event_id', id)
              .order('score', { ascending: false });
            if (finalLeader) {
              setPodium(finalLeader.slice(0, 3));
              const myRankIndex = finalLeader.findIndex(p => p.user_id === user?.id);
              if (myRankIndex !== -1) setPersonalScore({ rank: myRankIndex + 1, data: finalLeader[myRankIndex] });
              // Team standings
              const teamMap = {};
              finalLeader.forEach(p => {
                if (!p.team_id) return;
                if (!teamMap[p.team_id]) teamMap[p.team_id] = { teamName: p.teams?.name || 'Unknown Team', score: 0 };
                teamMap[p.team_id].score += p.score || 0;
              });
              const sorted = Object.values(teamMap).sort((a, b) => b.score - a.score);
              if (sorted.length > 0) setTeamPodium(sorted.slice(0, 3));
            }
            // Question review
            const { data: pData } = await supabase.from('participation').select('answers').eq('user_id', user?.id).eq('event_id', id).single();
            const { data: qData } = await supabase.from('event_questions').select('*, question_bank(*)').eq('event_id', id).order('order_num', { ascending: true });
            if (qData && pData) {
              setQuestions(qData.map(q => ({ ...q.question_bank, my_answer: pData.answers?.[q.id] || null })));
            }
          } catch (e) { console.warn('Post-wait data fetch failed:', e); }
        })();
      }

      const t = setTimeout(() => {
        setPhase('drumroll');
      }, 2500);
      return () => clearTimeout(t);
    }


    if (phase === 'drumroll') {
      playDrumRoll();
      const t = setTimeout(() => {
        setPhase('podium-3');
      }, 3000);
      return () => clearTimeout(t);
    }

    if (phase === 'podium-3') {
      const t = setTimeout(() => setPhase('podium-2'), 1500);
      return () => clearTimeout(t);
    }
    if (phase === 'podium-2') {
      const t = setTimeout(() => setPhase('podium-1'), 1500);
      return () => clearTimeout(t);
    }
    if (phase === 'podium-1') {
      triggerConfetti();
      const t = setTimeout(() => setPhase('complete'), 5000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const playDrumRoll = () => {
    try {
      // FIX #16: store in ref so cleanup can close it
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const bufferSize = audioCtx.sampleRate * 2.5; 
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800; // Muffled snare
      
      const gainNode = audioCtx.createGain();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.value = 16; 
      oscillator.connect(gainNode.gain);
      oscillator.start();
      
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(1, audioCtx.currentTime + 2.0);
      masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.5);
      
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);
      masterGain.connect(audioCtx.destination);
      
      noiseSource.start();
      // FIX #16: close AudioContext after sound completes (2.5s + buffer)
      noiseSource.onended = () => {
        audioCtx.close().catch(() => {});
        audioCtxRef.current = null;
      };
    } catch(e) {
      console.warn("Audio Context blocked by browser policy without interaction");
    }
  };

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    // FIX #15: store interval in ref so unmount cleanup can clear it
    confettiIntervalRef.current = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };


  if (phase === 'loading') return <div className="bg-slate-950 h-screen flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm">Validating Database...</div>;

  {/* ── WAITING SCREEN: user submitted but event still live ── */}
  if (phase === 'waiting') return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Ambient glow */}
      <div className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-md w-full glass-card p-8 md:p-10 space-y-6 border-blue-500/20">

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-blue-500/30 border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full bg-blue-600/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
            Quiz Submitted! ✅
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            You've completed the quiz. The winner will be announced once all participants finish or the admin ends the event.
          </p>
        </div>

        {/* Personal score card */}
        {mySubmittedScore !== null && (
          <div className="bg-slate-900 border border-blue-500/20 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-1">Your Score</p>
            <p className="text-4xl font-black text-blue-400">{mySubmittedScore}</p>
            <p className="text-xs text-slate-600 mt-1">points</p>
          </div>
        )}

        {/* Live participant count */}
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Waiting for other participants...
        </div>

        <p className="text-[11px] text-slate-600 italic">
          This page will automatically show the leaderboard when the event ends. Do not close this tab.
        </p>
      </div>
    </div>
  );

  // G: Error state with retry
  if (fetchError) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
      <div className="glass-card p-10 max-w-lg border-red-500/30">
        <p className="text-red-400 font-bold text-lg mb-2">Failed to Load Results</p>
        <p className="text-slate-500 text-sm mb-6">{fetchError}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all">
          Retry
        </button>
      </div>
    </div>
  );


  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden pt-16">
      
      {/* 
        ===========================================
        PHASE 1 & 2: CALCULATING & DRUMROLL
        ===========================================
      */}
      <AnimatePresence>
        {(phase === 'calculating' || phase === 'drumroll') && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 text-center"
          >
            <div className="w-24 h-24 border-8 border-slate-800 border-t-purple-500 rounded-full animate-spin mb-8"></div>
            
            {phase === 'calculating' && (
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                Calculating Results...
              </h1>
            )}

            {phase === 'drumroll' && (
              <motion.h1 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-5xl md:text-7xl font-black uppercase tracking-widest text-white shadow-purple-500/50"
              >
                And the Winners Are...
              </motion.h1>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* 
        ===========================================
        PHASE 3+: PODIUM CEREMONY
        ===========================================
      */}
      {(phase.includes('podium') || phase === 'complete') && (
        <div className="w-full relative min-h-[80vh] flex flex-col items-center justify-center py-20 px-4">
          <h1 className="text-4xl font-black uppercase tracking-widest text-slate-300 mb-16 text-center">Global Podium</h1>
          
          <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[400px]">
            
            {/* 3rd Place */}
            {podium[2] && (phase === 'podium-3' || phase === 'podium-2' || phase === 'podium-1' || phase === 'complete') && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center order-3 md:order-1"
              >
                <div className="bg-orange-800/20 border border-orange-700/50 p-4 rounded-xl mb-4 flex flex-col items-center backdrop-blur-md shadow-2xl w-48 text-center">
                   <div className="w-16 h-16 bg-slate-800 rounded-full mb-2 overflow-hidden border-2 border-orange-500">
                      {podium[2].users?.avatar_url ? <img src={podium[2].users?.avatar_url} /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500 bg-slate-900">3</div>}
                   </div>
                   <p className="font-bold text-white truncate w-full">{podium[2].users?.name || 'Participant'}</p>
                   <p className="text-xs text-orange-400 font-bold mb-2">{podium[2].score} PTS</p>
                </div>
                <div className="w-32 h-32 md:h-48 bg-gradient-to-t from-orange-900 to-orange-800/40 border-t-4 border-orange-500 flex justify-center pt-4 shadow-[0_0_50px_rgba(194,65,12,0.2)] rounded-t-lg">
                  <span className="text-4xl font-black text-orange-500">3rd</span>
                </div>
              </motion.div>
            )}

            {/* 1st Place */}
            {podium[0] && (phase === 'podium-1' || phase === 'complete') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, y: 200 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.5 }}
                className="flex flex-col items-center order-1 md:order-2 z-10"
              >
                <div className="bg-yellow-500/20 border border-yellow-400/50 p-6 rounded-xl mb-4 flex flex-col items-center backdrop-blur-md shadow-[0_0_50px_rgba(234,179,8,0.4)] w-56 text-center transform -translate-y-4 relative">
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-950 font-black px-4 py-1 rounded-full text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1 whitespace-nowrap">
                     <Trophy className="w-4 h-4"/> Champion
                   </div>
                   <div className="w-24 h-24 bg-slate-800 rounded-full mb-3 overflow-hidden border-4 border-yellow-400 shadow-xl mt-2">
                      {podium[0].users?.avatar_url ? <img src={podium[0].users?.avatar_url} /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500 bg-slate-900 text-2xl">1</div>}
                   </div>
                   <p className="font-black text-xl text-white truncate w-full">{podium[0].users?.name || 'Participant'}</p>
                   {podium[0].users?.college && <p className="text-xs text-slate-400 uppercase tracking-widest truncate w-full mb-1">{podium[0].users.college}</p>}
                   <p className="text-lg text-yellow-400 font-black">{podium[0].score} PTS</p>
                </div>
                <div className="w-40 h-48 md:h-72 bg-gradient-to-t from-yellow-900 to-yellow-600/40 border-t-4 border-yellow-400 flex justify-center pt-6 shadow-[0_0_100px_rgba(234,179,8,0.3)] rounded-t-lg">
                  <span className="text-6xl font-black text-yellow-400 drop-shadow-lg">1st</span>
                </div>
              </motion.div>
            )}

            {/* 2nd Place */}
            {podium[1] && (phase === 'podium-2' || phase === 'podium-1' || phase === 'complete') && (
              <motion.div 
                initial={{ opacity: 0, y: 150 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center order-2 md:order-3"
              >
                <div className="bg-slate-500/20 border border-slate-400/50 p-4 rounded-xl mb-4 flex flex-col items-center backdrop-blur-md shadow-2xl w-48 text-center">
                   <div className="w-20 h-20 bg-slate-800 rounded-full mb-2 overflow-hidden border-2 border-slate-300">
                      {podium[1].users?.avatar_url ? <img src={podium[1].users?.avatar_url} /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-500 bg-slate-900 text-xl">2</div>}
                   </div>
                   <p className="font-bold text-white truncate w-full">{podium[1].users?.name || 'Participant'}</p>
                   <p className="text-sm text-slate-300 font-bold mb-2">{podium[1].score} PTS</p>
                </div>
                <div className="w-36 h-40 md:h-56 bg-gradient-to-t from-slate-900 to-slate-700/40 border-t-4 border-slate-400 flex justify-center pt-4 shadow-[0_0_50px_rgba(148,163,184,0.2)] rounded-t-lg">
                  <span className="text-5xl font-black text-slate-400">2nd</span>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      )}

      {/* 
        ===========================================
        FEATURE 8: TEAM STANDINGS (if teams exist)
        ===========================================
      */}
      {phase === 'complete' && teamPodium.length > 0 && (
        <div className="w-full max-w-5xl mx-auto px-4 pb-16">
          <h2 className="text-3xl font-black uppercase tracking-widest text-center text-slate-300 mb-12">Team Standings</h2>
          <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[280px]">

            {/* 3rd place team */}
            {teamPodium[2] && (
              <motion.div
                initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center order-3 md:order-1"
              >
                <div className="bg-orange-800/20 border border-orange-700/50 p-4 rounded-xl mb-3 flex flex-col items-center w-44 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-orange-500 flex items-center justify-center mb-2">
                    <span className="font-black text-orange-400 text-lg">3</span>
                  </div>
                  <p className="font-bold text-white text-sm truncate w-full">{teamPodium[2].teamName}</p>
                  <p className="text-xs text-orange-400 font-bold mt-1">{teamPodium[2].score} PTS</p>
                </div>
                <div className="w-28 h-28 bg-gradient-to-t from-orange-900 to-orange-800/40 border-t-4 border-orange-500 flex justify-center pt-3 rounded-t-lg">
                  <span className="text-3xl font-black text-orange-500">3rd</span>
                </div>
              </motion.div>
            )}

            {/* 1st place team */}
            {teamPodium[0] && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 150 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.5 }}
                className="flex flex-col items-center order-1 md:order-2 z-10"
              >
                <div className="bg-yellow-500/20 border border-yellow-400/50 p-5 rounded-xl mb-3 flex flex-col items-center shadow-[0_0_40px_rgba(234,179,8,0.3)] w-52 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-4 border-yellow-400 flex items-center justify-center mb-2">
                    <span className="font-black text-yellow-400 text-2xl">1</span>
                  </div>
                  <p className="font-black text-white text-base truncate w-full">{teamPodium[0].teamName}</p>
                  <p className="text-sm text-yellow-400 font-black mt-1">{teamPodium[0].score} PTS</p>
                </div>
                <div className="w-36 h-44 bg-gradient-to-t from-yellow-900 to-yellow-600/40 border-t-4 border-yellow-400 flex justify-center pt-4 shadow-[0_0_60px_rgba(234,179,8,0.25)] rounded-t-lg">
                  <span className="text-5xl font-black text-yellow-400">1st</span>
                </div>
              </motion.div>
            )}

            {/* 2nd place team */}
            {teamPodium[1] && (
              <motion.div
                initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center order-2 md:order-3"
              >
                <div className="bg-slate-500/20 border border-slate-400/50 p-4 rounded-xl mb-3 flex flex-col items-center w-44 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center mb-2">
                    <span className="font-black text-slate-300 text-xl">2</span>
                  </div>
                  <p className="font-bold text-white text-sm truncate w-full">{teamPodium[1].teamName}</p>
                  <p className="text-xs text-slate-300 font-bold mt-1">{teamPodium[1].score} PTS</p>
                </div>
                <div className="w-32 h-36 bg-gradient-to-t from-slate-900 to-slate-700/40 border-t-4 border-slate-400 flex justify-center pt-3 rounded-t-lg">
                  <span className="text-4xl font-black text-slate-400">2nd</span>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      )}


      {/* 
        ===========================================
        PHASE 4: COMPLETE DETAILS (Personal Review)
        ===========================================
      */}
      {phase === 'complete' && (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl mx-auto px-4 pb-32">
          
          <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
             <h2 className="text-3xl font-black uppercase tracking-widest text-white">Your Performance</h2>
             <Link to={`/leaderboard/${id}`} className="text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase tracking-widest text-sm flex items-center gap-2">
               Full Leaderboard <Share2 className="w-4 h-4"/>
             </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            
            {/* Shareable Stat Card */}
            <div className="col-span-1 md:col-span-1 border border-white/10 rounded-2xl overflow-hidden bg-slate-900 shadow-xl relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-800/20 opacity-50"></div>
              <div className="p-8 relative z-10 text-center flex flex-col items-center justify-center h-full space-y-4">
                 <p className="text-xs text-slate-400 uppercase tracking-[0.3em] font-black">{eventData?.title}</p>
                 <div className="w-24 h-24 bg-slate-950 rounded-full border-4 border-white/10 flex items-center justify-center mb-4 shadow-inner">
                    <span className="text-4xl font-black text-white">#{personalScore?.rank || '-'}</span>
                 </div>
                 <div>
                   <p className="text-3xl font-black text-emerald-400 tracking-wider break-all">{personalScore?.data?.score || 0}</p>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Final Score</p>
                 </div>
              </div>
            </div>

            {/* Questions Breakdown */}
            <div className="col-span-1 md:col-span-2 space-y-4">
               <div className="flex gap-4">
                 <div className="flex-1 bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-4">
                   <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                   <div>
                     <p className="text-2xl font-black text-emerald-400">{questions.filter(q => q.my_answer === q.correct_answer).length}</p>
                     <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Correct</p>
                   </div>
                 </div>
                 <div className="flex-1 bg-red-900/20 border border-red-500/20 p-4 rounded-xl flex items-center gap-4">
                   <XCircle className="w-8 h-8 text-red-500" />
                   <div>
                     <p className="text-2xl font-black text-red-400">{questions.filter(q => q.my_answer && q.my_answer !== q.correct_answer).length}</p>
                     <p className="text-[10px] text-red-500 uppercase font-black tracking-widest">Incorrect</p>
                   </div>
                 </div>
               </div>

               <div className="bg-slate-900 border border-white/5 rounded-xl p-6 custom-scrollbar max-h-96 overflow-y-auto space-y-6">
                 <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 sticky top-0 bg-slate-900 pb-2 border-b border-white/5">Question Review</h3>
                 {questions.map((q, i) => {
                   const isCorrect = q.my_answer === q.correct_answer;
                   const skipped = !q.my_answer;

                   return (
                     <div key={q.id} className="pb-6 border-b border-slate-800/50 last:border-0 last:pb-0">
                       <div className="flex items-start gap-4 mb-3">
                         <div className="shrink-0 w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-800">
                           {i + 1}
                         </div>
                         <p className="text-sm font-bold text-white leading-relaxed pt-1">{q.question}</p>
                       </div>
                       
                       <div className="pl-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                           <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Your Answer</p>
                           <p className={`text-sm font-bold ${isCorrect ? 'text-emerald-400' : skipped ? 'text-slate-500 italic' : 'text-red-400'}`}>
                             {q.my_answer || 'Skipped / Unanswered'}
                           </p>
                         </div>
                         <div className="bg-emerald-900/10 rounded-lg p-3 border border-emerald-500/20">
                           <p className="text-[10px] uppercase font-black tracking-widest text-emerald-500 mb-1">Correct Answer</p>
                           <p className="text-sm font-bold text-emerald-400">{q.correct_answer}</p>
                         </div>
                       </div>
                       
                       {q.explanation && (
                         <div className="pl-12 mt-3">
                           <p className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg"><span className="font-bold text-blue-400">Explanation:</span> {q.explanation}</p>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>

          </div>

          <div className="mt-12 text-center">
            <Link to={`/certificate/${id}`} className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_40px_rgba(79,70,229,0.4)] transition-all transform hover:scale-105">
              <Award className="w-6 h-6" /> Claim Your Certificate
            </Link>
          </div>

        </motion.div>
      )}

    </div>
  );
}
