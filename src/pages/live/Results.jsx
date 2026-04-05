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
        // For coding events, there are no event_questions - skip this fetch
        if (eData.type !== 'coding_challenge') {
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
            // Question review — skip for coding events
            if (eventData?.type !== 'coding_challenge') {
              const { data: pData } = await supabase.from('participation').select('answers').eq('user_id', user?.id).eq('event_id', id).single();
              const { data: qData } = await supabase.from('event_questions').select('*, question_bank(*)').eq('event_id', id).order('order_num', { ascending: true });
              if (qData && pData) {
                setQuestions(qData.map(q => ({ ...q.question_bank, my_answer: pData.answers?.[q.id] || null })));
              }
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


  if (phase === 'loading') return <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Validating results...</div>;

  {/* ── WAITING SCREEN: user submitted but event still live ── */}
  if (phase === 'waiting') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', userSelect: 'none' }}>
      <div style={{ maxWidth: 400, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 28px' }}>
        {/* Spinner */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--elevated)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--blue)', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: 'var(--blue)' }} />
            </div>
          </div>
        </div>

        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          {eventData?.type === 'coding_challenge' ? 'Code Submitted ✓' : 'Quiz Submitted ✓'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          {eventData?.type === 'coding_challenge'
            ? 'Your code has been received and judged. The final leaderboard will be revealed soon.'
            : "You've completed the quiz. Results will appear once the admin announces the winner."}
        </p>

        {mySubmittedScore !== null && (
          <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Your Score</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--blue)' }}>{mySubmittedScore}</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for other participants...</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
          Page auto-updates when event ends. Do not close this tab.
        </p>
      </div>
    </div>
  );

  // G: Error state with retry
  if (fetchError) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '32px 28px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Failed to Load Results</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{fetchError}</p>
        <button onClick={() => window.location.reload()} className="btn-primary" style={{ display: 'inline-flex' }}>Retry</button>
      </div>
    </div>
  );


  return (
    <div style={{ minHeight: '100dvh', paddingTop: 40, overflowX: 'hidden' }}>
      
      {/* 
        ===========================================
        PHASE 1 & 2: CALCULATING & DRUMROLL
        ===========================================
      */}
      <AnimatePresence>
        {(phase === 'calculating' || phase === 'drumroll') && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}
          >
            <div style={{ width: 56, height: 56, border: '4px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 28 }} />

            {phase === 'calculating' && (
              <p style={{ fontSize: 'clamp(22px, 5vw, 40px)', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Calculating Results...
              </p>
            )}

            {phase === 'drumroll' && (
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ fontSize: 'clamp(24px, 6vw, 52px)', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                And the Winners Are...
              </motion.p>
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
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingLeft: 16, paddingRight: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 40 }}>Global Podium</p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 8, minHeight: 340 }} id="podium-row">
            <style>{`@media (min-width: 640px) { #podium-row { flex-direction: row; } }`}</style>

            {/* 3rd Place */}
            {podium[2] && (phase === 'podium-3' || phase === 'podium-2' || phase === 'podium-1' || phase === 'complete') && (
              <motion.div
                initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', order: 3 }}
              >
                <div style={{ background: 'var(--surface)', border: '2px solid #b45309', borderRadius: 8, padding: '12px 16px', marginBottom: 8, width: 148, textAlign: 'center' }}>
                  <div className="avatar-circle" style={{ margin: '0 auto 8px', width: 48, height: 48, fontSize: 16 }}>
                    {podium[2].users?.avatar_url ? <img src={podium[2].users?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (podium[2].users?.name?.charAt(0) || '3')}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{podium[2].users?.name || 'Participant'}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>{podium[2].score} pts</p>
                </div>
                <div style={{ width: 100, height: 120, background: 'var(--elevated)', borderTop: '3px solid #b45309', display: 'flex', justifyContent: 'center', paddingTop: 12, borderRadius: '4px 4px 0 0' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#b45309' }}>3rd</span>
                </div>
              </motion.div>
            )}

            {/* 1st Place */}
            {podium[0] && (phase === 'podium-1' || phase === 'complete') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 120 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.5 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', order: 1, zIndex: 10 }}
              >
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid #f59e0b', borderRadius: 8, padding: '16px 20px', marginBottom: 8, width: 168, textAlign: 'center', position: 'relative', transform: 'translateY(-16px)' }}>
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#000', fontWeight: 800, fontSize: 10, padding: '3px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trophy size={10} /> Champion
                  </div>
                  <div className="avatar-circle" style={{ margin: '8px auto 10px', width: 60, height: 60, fontSize: 20, border: '2px solid #f59e0b' }}>
                    {podium[0].users?.avatar_url ? <img src={podium[0].users?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (podium[0].users?.name?.charAt(0) || '1')}
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{podium[0].users?.name || 'Participant'}</p>
                  {podium[0].users?.college && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-word' }}>{podium[0].users.college}</p>}
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{podium[0].score} pts</p>
                </div>
                <div style={{ width: 124, height: 196, background: 'var(--elevated)', borderTop: '3px solid #f59e0b', display: 'flex', justifyContent: 'center', paddingTop: 16, borderRadius: '4px 4px 0 0' }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#f59e0b' }}>1st</span>
                </div>
              </motion.div>
            )}

            {/* 2nd Place */}
            {podium[1] && (phase === 'podium-2' || phase === 'podium-1' || phase === 'complete') && (
              <motion.div
                initial={{ opacity: 0, y: 90 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', order: 2 }}
              >
                <div style={{ background: 'var(--surface)', border: '2px solid #a1a1aa', borderRadius: 8, padding: '12px 16px', marginBottom: 8, width: 148, textAlign: 'center' }}>
                  <div className="avatar-circle" style={{ margin: '0 auto 8px', width: 52, height: 52, fontSize: 18 }}>
                    {podium[1].users?.avatar_url ? <img src={podium[1].users?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (podium[1].users?.name?.charAt(0) || '2')}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{podium[1].users?.name || 'Participant'}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa' }}>{podium[1].score} pts</p>
                </div>
                <div style={{ width: 110, height: 156, background: 'var(--elevated)', borderTop: '3px solid #a1a1aa', display: 'flex', justifyContent: 'center', paddingTop: 14, borderRadius: '4px 4px 0 0' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#a1a1aa' }}>2nd</span>
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
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 80px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Performance</h2>
            <Link to={`/leaderboard/${id}`} style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              Full Leaderboard <Share2 size={12} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 28 }} id="perf-grid">
            <style>{`@media (min-width: 768px) { #perf-grid { grid-template-columns: 1fr 2fr; } }`}</style>
            
            {/* Score Card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', wordBreak: 'break-word' }}>{eventData?.title}</p>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>#{personalScore?.rank || '—'}</span>
              </div>
              <div>
                <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>{personalScore?.data?.score || 0}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Score</p>
              </div>
            </div>

            {/* Questions Breakdown — show for quiz events; show Coding Summary for coding events */}
            <div className="col-span-1 md:col-span-2 space-y-4">
              {eventData?.type === 'coding_challenge' ? (
                <div className="bg-slate-900 border border-white/5 rounded-xl p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto">
                    <Trophy className="w-8 h-8 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Coding Submission</p>
                    <p className="text-4xl font-black text-violet-400">{personalScore?.data?.score ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Final Score</p>
                  </div>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Your code was automatically judged against all visible and hidden test cases.
                    Check the leaderboard for your final rank.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{questions.filter(q => q.my_answer === q.correct_answer).length}</p>
                        <p style={{ fontSize: 10, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Correct</p>
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <XCircle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>{questions.filter(q => q.my_answer && q.my_answer !== q.correct_answer).length}</p>
                        <p style={{ fontSize: 10, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Incorrect</p>
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
                </>
              )}
            </div>

          </div>

          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <Link to={`/certificate/${id}`} className="btn-primary" style={{ display: 'inline-flex', padding: '11px 24px', fontSize: 14, fontWeight: 700 }}>
              <Award size={16} /> Claim Certificate
            </Link>
          </div>

        </motion.div>
      )}

    </div>
  );
}
