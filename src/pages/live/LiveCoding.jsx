import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, serverNow } from '../../lib/supabase';
import { useStore } from '../../store';
import { Shield, Play, Send, Clock, ChevronRight, Check, X, LoaderCircle, TriangleAlert, Eye, EyeOff, Columns2, History, FileCode } from 'lucide-react';

export function LiveCoding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore(state => state.user);

  // Core Data
  const [eventData, setEventData] = useState(null);
  const [problem, setProblem] = useState(null);
  const [visibleTestCases, setVisibleTestCases] = useState([]);
  const [participationId, setParticipationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editor & Results State
  const starterCode = `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    // Read input from cin\n    // Write output to cout\n    \n    return 0;\n}`;
  const [editorCode, setEditorCode] = useState(starterCode);
  const [leftTab, setLeftTab] = useState('problem'); // 'problem', 'history'
  const [bottomTab, setBottomTab] = useState('results'); // 'results', 'custom', 'history'
  const [customInput, setCustomInput] = useState('');
  
  // Execution States
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState([]);

  // Timer & Status
  const [timeLeftStr, setTimeLeftStr] = useState('00:00:00');
  const timerRef = useRef(null);

  // Anti-Cheat
  const [violations, setViolations] = useState(0);
  const [showViolationBanner, setShowViolationBanner] = useState(false);
  const violationsRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoSubmitRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('coding_submissions')
      .select('*')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    if (data) setSubmissionHistory(data);
  }, [id, user]);

  useEffect(() => {
    async function bootCodingEngine() {
      if (!user) return navigate('/login');

      try {
        // 1. Fetch Event
        const { data: eData, error: eErr } = await supabase.from('events').select('*').eq('id', id).single();
        if (eErr || !eData) throw new Error('Event not found');
        if (eData.status === 'ended' || eData.results_announced) return navigate(`/results/${id}`);
        if (eData.type !== 'coding_challenge') return navigate(`/live/${id}`);
        setEventData(eData);

        // 2. Fetch Problem
        const { data: pData, error: pErr } = await supabase.from('coding_problems').select('*').eq('event_id', id).single();
        if (pErr || !pData) throw new Error('Admin has not set up the problem yet. Please wait.');
        setProblem(pData);

        // 3. Fetch Visible Test Cases
        const { data: tData } = await supabase.from('coding_test_cases').select('*').eq('problem_id', pData.id).eq('is_hidden', false).order('order_num');
        setVisibleTestCases(tData || []);

        // 4. Participation
        const { data: participationRows, error: partErr } = await supabase
          .from('participation')
          .select('id, violations, status')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .limit(1);
        const part = Array.isArray(participationRows) ? participationRows[0] : null;
        if (partErr || !part) return navigate(`/events/${id}`);
        if (part.status === 'submitted') return navigate(`/results/${id}`);
        
        setParticipationId(part.id);
        setViolations(part.violations || 0);
        violationsRef.current = part.violations || 0;

        // 5. Load History
        fetchHistory();

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    bootCodingEngine();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, user, navigate, fetchHistory]);

  // Countdown Timer Implementation
  useEffect(() => {
    if (!eventData?.end_at) return;
    
    const interval = setInterval(() => {
      const distance = new Date(eventData.end_at).getTime() - serverNow();
      if (distance <= 0) {
        clearInterval(interval);
        if (!isSubmittingRef.current) autoSubmitRef.current?.();
      } else {
        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeftStr(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [eventData]);

  // Anti-Cheat Implementation
  useEffect(() => {
    if (loading || isSubmitting) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittingRef.current) {
        const newV = violationsRef.current + 1;
        violationsRef.current = newV;
        setViolations(newV);
        setShowViolationBanner(true);
        setTimeout(() => setShowViolationBanner(false), 3000);

        if (participationId) {
          supabase.from('participation').update({ violations: newV }).eq('id', participationId).then();
        }

        if (newV >= 3) {
          autoSubmitRef.current?.();
        }
      }
    };

    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('paste', preventDefault);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('paste', preventDefault);
    };
  }, [loading, isSubmitting, participationId]);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setBottomTab('results');
    setRunResults(null);
    
    try {
      const results = [];
      for (const tc of visibleTestCases) {
        // Sequential execution with small delay to avoid Piston rate limits
        if (results.length > 0) await new Promise(r => setTimeout(r, 300));

        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: "cpp",
            version: "10.2.0",
            files: [{ name: "main.cpp", content: editorCode }],
            stdin: tc.input
          })
        });
        
        if (!res.ok) {
           results.push({ passed: false, error: 'Compiler service unavailable', details: `HTTP Error ${res.status}. Please try again.` });
           continue;
        }
        
        const data = await res.json();
        
        // Check for compilation errors
        if (data.compile && data.compile.code !== 0) {
          results.push({ 
            passed: false, 
            error: 'Compilation Error', 
            details: data.compile.stderr || data.compile.output 
          });
          // If compile fails once, it will fail for all test cases, so we can stop
          break;
        }

        const stdout = (data.run?.stdout || '').trim();
        const stderr = (data.run?.stderr || '');
        const expected = tc.expected_output.trim();
        const passed = stdout === expected && data.run?.code === 0;
        
        results.push({ 
          passed, 
          stdout, 
          stderr, 
          expected, 
          input: tc.input, 
          runtime_ms: 0 // Piston doesn't return precise runtime, we show < 1ms in UI or hide
        });
      }
      setRunResults(results);
    } catch {
      alert('Compiler unavailable. Please check your connection and try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCustomRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setBottomTab('results');
    setRunResults(null);
    
    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: "cpp",
          version: "10.2.0",
          files: [{ name: "main.cpp", content: editorCode }],
          stdin: customInput
        })
      });
      
      if (!res.ok) {
         setRunResults([{ passed: false, is_custom: true, error: 'Compiler service unavailable', details: `HTTP Error ${res.status}` }]);
         return;
      }
      
      const data = await res.json();
      if (data.compile && data.compile.code !== 0) {
        setRunResults([{ 
          passed: false, 
          is_custom: true, 
          error: 'Compilation Error', 
          details: data.compile.stderr || data.compile.output 
        }]);
      } else {
        const stdout = (data.run?.stdout || '').trim();
        const stderr = (data.run?.stderr || '');
        setRunResults([{ 
          passed: data.run?.code === 0, 
          is_custom: true, 
          stdout, 
          stderr 
        }]); 
      }
    } catch {
      alert('Compiler unavailable. Please check your connection and try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const judgeSubmission = useCallback(async () => {
    setIsSubmitting(true);
    setBottomTab('results');
    try {
      const { data, error } = await supabase.functions.invoke('judge-submission', {
        body: { 
          code: editorCode, 
          event_id: id, 
          problem_id: problem.id, 
          user_id: user.id 
        }
      });
      if (error) throw error;
      setRunResults(data.results);
      fetchHistory();
      alert(`Judging complete! Score: ${data.score} pts`);
    } catch (err) {
      alert('Judging function error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [editorCode, fetchHistory, id, problem?.id, user?.id]);

  const handleSubmit = async () => {
    if (!window.confirm('Submit your code? This will be judged against all hidden cases.')) return;
    judgeSubmission();
  };

  const autoSubmit = useCallback(async () => {
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    await judgeSubmission();
    navigate(`/results/${id}`);
  }, [id, judgeSubmission, navigate]);

  useEffect(() => {
    autoSubmitRef.current = autoSubmit;
  }, [autoSubmit]);

  const handleTabKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.target;
      const newVal = editorCode.substring(0, selectionStart) + '    ' + editorCode.substring(selectionEnd);
      setEditorCode(newVal);
      
      // Force cursor to move forward by 4 spaces after React re-render
      requestAnimationFrame(() => {
        e.target.selectionStart = e.target.selectionEnd = selectionStart + 4;
      });
    }
  };

  if (loading) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center"><LoaderCircle className="w-12 h-12 text-purple-500 animate-spin" /><p className="mt-4 text-slate-500 font-black uppercase tracking-widest text-xs">Booting Arena...</p></div>;
  if (error) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-center"><TriangleAlert className="w-16 h-16 text-amber-500 mb-4" /><h2 className="text-2xl font-black text-white mb-2">Arena Connection Error</h2><p className="text-slate-400 max-w-md mb-8">{error}</p><button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl">Retry Connection</button></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden select-none">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/5 bg-slate-900 shrink-0 relative z-50">
        <div className="flex items-center gap-4">
           <div className="px-2 py-1 bg-blue-600 rounded text-[10px] font-black text-white uppercase">C++ 17</div>
           <h1 className="text-sm font-bold text-white truncate max-w-[200px]">{eventData?.title}</h1>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-white/5 rounded-lg">
             <Clock className="w-3.5 h-3.5 text-red-500" />
             <span className="font-mono font-bold text-red-500 text-sm tracking-widest">{timeLeftStr}</span>
           </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded border border-white/5 mr-4">
              <Shield className={`w-3 h-3 ${violations > 0 ? 'text-red-500 animate-pulse' : 'text-slate-600'}`} />
              <span className={`text-[10px] font-black ${violations > 0 ? 'text-red-500' : 'text-slate-500'}`}>VIOLATIONS: {violations}/3</span>
           </div>
           
           <button onClick={handleRun} disabled={isRunning || isSubmitting} className="flex items-center gap-2 px-4 py-1.5 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
             {isRunning ? <LoaderCircle className="w-3.5 h-3.5 animate-spin"/> : <Play className="w-3.5 h-3.5" />} Run
           </button>
           <button onClick={handleSubmit} disabled={isRunning || isSubmitting} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 active:scale-95 disabled:opacity-50">
             <Send className="w-3.5 h-3.5" /> {isSubmitting ? 'Judging...' : 'Submit'}
           </button>
        </div>
      </div>

      {/* Anti-cheat strip */}
      <div className="flex items-center justify-between px-4 h-8 bg-amber-950/60 border-b border-amber-800/40 shrink-0">
        <div className="flex items-center gap-3">
           <div className="flex gap-1.5">
             {[1,2,3].map(i => (
               <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i <= violations ? 'bg-red-500 border-red-400' : 'border-amber-500/50'}`} />
             ))}
           </div>
           <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
             Tab Switch Detected: {violations}/3 — {3-violations} more will result in auto-submission.
           </p>
        </div>
        <p className="text-[10px] text-slate-500 italic">paste & right-click strictly disabled</p>
      </div>

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Violation Overlay */}
        {showViolationBanner && (
          <div className="absolute inset-0 z-[100] bg-red-600/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition-all">
             <div className="bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
                <TriangleAlert className="w-10 h-10" />
                <div className="text-left">
                  <p className="text-xl font-black uppercase tracking-widest">Tab Switch Violation!</p>
                  <p className="text-sm font-bold opacity-80">Strikes: {violations} / 3</p>
                </div>
             </div>
          </div>
        )}

        {/* Left Panel */}
        <div className="w-[42%] border-r border-white/5 flex flex-col overflow-hidden bg-slate-900/20">
          <div className="flex border-b border-white/5 shrink-0 bg-slate-900/40">
             <button onClick={() => setLeftTab('problem')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${leftTab === 'problem' ? 'text-white bg-slate-950 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>Problem</button>
             <button onClick={() => setLeftTab('history')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${leftTab === 'history' ? 'text-white bg-slate-950 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>My Submissions</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {leftTab === 'problem' ? (
              <>
                <div>
                  <h2 className="text-2xl font-black text-white mb-2">{problem?.title}</h2>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase rounded">Medium</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{visibleTestCases.length + 3}+ total test cases</span>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {problem?.statement}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Input Format</h4>
                    <div className="bg-slate-950 border border-white/5 p-4 rounded-xl font-mono text-xs text-blue-400">{problem?.input_format}</div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output Format</h4>
                    <div className="bg-slate-950 border border-white/5 p-4 rounded-xl font-mono text-xs text-emerald-400">{problem?.output_format}</div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Constraints</h4>
                    <div className="bg-slate-900/50 p-3 rounded-lg font-mono text-xs text-slate-400">{problem?.constraints}</div>
                  </div>
                </div>

                <div className="space-y-6">
                  {visibleTestCases.map((tc, i) => (
                    <div key={tc.id} className="space-y-3">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                         <span className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white italic">Ex {i+1}</span> Example Test Case
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Input</p>
                           <pre className="bg-slate-950 border border-white/5 p-3 rounded-lg font-mono text-[11px] text-slate-300">{tc.input}</pre>
                        </div>
                        <div className="space-y-1.5">
                           <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Expected Output</p>
                           <pre className="bg-slate-950 border border-white/5 p-3 rounded-lg font-mono text-[11px] text-slate-300">{tc.expected_output}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-slate-950 border-2 border-dashed border-white/5 p-6 rounded-2xl text-center">
                    <EyeOff className="w-8 h-8 text-slate-800 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Additional hidden test cases will be run upon submission</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl mb-6">
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Global Best</p>
                   <p className="text-2xl font-black text-white">{submissionHistory.reduce((max, s) => Math.max(max, s.score), 0)} pts</p>
                </div>
                
                {submissionHistory.map((sub) => (
                  <div key={sub.id} className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white mb-1">{sub.passed_count} / {sub.total_count} Passed</p>
                      <p className="text-[10px] text-slate-500">{new Date(sub.submitted_at).toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-blue-400">{sub.score} pts</p>
                    </div>
                  </div>
                ))}
                {submissionHistory.length === 0 && <p className="text-center py-10 text-slate-500 text-xs font-bold uppercase tracking-widest">No Submissions Yet</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1a1d23]">
             <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#13161b]">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 bg-blue-500 rounded-full" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main.cpp</span>
                </div>
                <div className="text-[10px] font-bold text-slate-700 italic">paste disabled · right-click disabled</div>
             </div>
             
             <textarea
               value={editorCode}
               onChange={e => setEditorCode(e.target.value)}
               onKeyDown={handleTabKey}
               spellCheck={false}
               autoComplete="off"
               autoCorrect="off"
               className="flex-1 w-full bg-transparent text-[#e2e8f0] p-6 font-mono text-[13px] leading-[1.8] resize-none outline-none caret-blue-400 custom-scrollbar"
               style={{ tabSize: 4 }}
             />
          </div>

          {/* Bottom Panel */}
          <div className="h-[240px] border-t border-white/5 bg-[#0f1117] flex flex-col shrink-0">
             <div className="flex px-4 border-b border-white/5 shrink-0">
                <button onClick={() => setBottomTab('results')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${bottomTab === 'results' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}>Test Results</button>
                <button onClick={() => setBottomTab('custom')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${bottomTab === 'custom' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}>Custom Input</button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {bottomTab === 'results' ? (
                  <div className="space-y-4">
                    {!runResults && !isRunning && !isSubmitting && (
                      <p className="text-slate-600 text-[11px] font-bold tracking-wider text-center py-10 uppercase">Click Run or Submit to see execution results</p>
                    )}
                    {(isRunning || isSubmitting) && (
                      <div className="flex flex-col items-center justify-center py-10">
                        <LoaderCircle className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Communicating with Judge Engine...</p>
                      </div>
                    )}
                    {runResults && !isRunning && !isSubmitting && (
                      <div className="space-y-4">
                        {runResults.map((res, i) => (
                           <div key={i} className={`p-4 rounded-xl border flex flex-col gap-3 ${res.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 {res.passed ? <Check className="text-emerald-500 w-4 h-4" /> : <X className="text-red-500 w-4 h-4" />}
                                 <div>
                                    <p className="text-xs font-black text-white uppercase">{res.is_custom ? 'Custom Exec' : `Test ${i+1} ${res.is_hidden ? '(Hidden)' : ''}`}</p>
                                    <p className={`text-[10px] font-bold ${res.passed ? 'text-emerald-500' : 'text-red-500'}`}>{res.passed ? (res.is_custom ? 'EXECUTED' : 'PASSED') : (res.error || 'FAILED')}</p>
                                 </div>
                               </div>
                               {!res.is_hidden && res.runtime_ms && (
                                 <span className="text-[10px] text-slate-500 font-mono">{res.runtime_ms}ms</span>
                               )}
                             </div>
                             
                             {/* Detailed Output Panel */}
                             {(!res.is_hidden || res.is_custom) && (
                               <div className="pl-7 space-y-2">
                                 {res.details && (
                                   <div className="bg-red-500/10 p-2 rounded border border-red-500/20 font-mono text-[10px] text-red-400 whitespace-pre-wrap">{res.details}</div>
                                 )}
                                 {res.stderr && (
                                   <div>
                                     <p className="text-[9px] font-black text-slate-500 uppercase">Stderr / Runtime Error</p>
                                     <div className="bg-red-500/10 p-2 rounded border border-red-500/20 font-mono text-[10px] text-red-400 whitespace-pre-wrap mt-1">{res.stderr}</div>
                                   </div>
                                 )}
                                 {!res.is_custom && !res.passed && !res.stderr && !res.error && (
                                   <div className="grid grid-cols-2 gap-3 mt-2">
                                     <div>
                                       <p className="text-[9px] font-black text-slate-500 uppercase">Expected Output</p>
                                       <div className="bg-slate-900/50 p-2 rounded font-mono text-[10px] text-emerald-400 whitespace-pre-wrap mt-1">{res.expected}</div>
                                     </div>
                                     <div>
                                       <p className="text-[9px] font-black text-slate-500 uppercase">Your Output</p>
                                       <div className="bg-slate-900/50 p-2 rounded font-mono text-[10px] text-red-400 whitespace-pre-wrap mt-1">{res.stdout || '(no output)'}</div>
                                     </div>
                                   </div>
                                 )}
                                 {(res.passed || res.is_custom) && res.stdout && (
                                   <div>
                                     <p className="text-[9px] font-black text-slate-500 uppercase">Stdout</p>
                                     <div className="bg-slate-900/50 p-2 rounded font-mono text-[10px] text-slate-300 whitespace-pre-wrap mt-1">{res.stdout}</div>
                                   </div>
                                 )}
                               </div>
                             )}
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custom Stdin</p>
                     <textarea value={customInput} onChange={e => setCustomInput(e.target.value)} rows={4} className="w-full bg-slate-950 border border-white/5 rounded-xl p-3 text-mono text-xs text-white focus:outline-none focus:border-blue-500/30" placeholder="Type input to feed to cin..." />
                     <button onClick={handleCustomRun} disabled={isRunning || isSubmitting} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-50">Execute Selection</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
