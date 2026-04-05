import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { CodeXml, Plus, Trash2, Save, FileCode, CircleCheck, CircleAlert, LayoutDashboard, ListOrdered, Eye, EyeOff } from 'lucide-react';

export function AdminCodingProblems() {
  const user = useStore((state) => state.user);
  
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('problem'); // 'problem' or 'test_cases'
  
  // Problem Form State
  const [problemData, setProblemData] = useState({
    title: '',
    statement: '',
    input_format: '',
    output_format: '',
    constraints: '',
    time_limit_ms: 3000,
    points_per_testcase: 2
  });
  const [problemId, setProblemId] = useState(null);
  const [savingProblem, setSavingProblem] = useState(false);

  // Test Case State
  const [testCases, setTestCases] = useState([]);
  const [newTestCase, setNewTestCase] = useState({
    input: '',
    expected_output: '',
    is_hidden: true,
    order_num: 1
  });
  const [addingTestCase, setAddingTestCase] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data: evts } = await supabase
      .from('events')
      .select('id, title, status')
      .eq('type', 'coding_challenge')
      .order('created_at', { ascending: false });
    
    if (evts) {
      // Check which events already have problems
      const { data: problems } = await supabase
        .from('coding_problems')
        .select('event_id');
      
      const problemMap = new Set(problems?.map(p => p.event_id));
      setEvents(evts.map(e => ({
        ...e,
        has_problem: problemMap.has(e.id)
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const loadProblem = useCallback(async (eventId) => {
    const { data: prob } = await supabase
      .from('coding_problems')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (prob) {
      setProblemData({
        title: prob.title,
        statement: prob.statement,
        input_format: prob.input_format,
        output_format: prob.output_format,
        constraints: prob.constraints || '',
        time_limit_ms: prob.time_limit_ms,
        points_per_testcase: prob.points_per_testcase
      });
      setProblemId(prob.id);
      loadTestCases(prob.id);
    } else {
      setProblemData({
        title: '',
        statement: '',
        input_format: '',
        output_format: '',
        constraints: '',
        time_limit_ms: 3000,
        points_per_testcase: 2
      });
      setProblemId(null);
      setTestCases([]);
    }
  }, []);

  const loadTestCases = async (probId) => {
    const { data: tcs } = await supabase
      .from('coding_test_cases')
      .select('*')
      .eq('problem_id', probId)
      .order('order_num', { ascending: true });
    if (tcs) {
      setTestCases(tcs);
      setNewTestCase(prev => ({ ...prev, order_num: tcs.length + 1 }));
    }
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    loadProblem(eventId);
    setActiveTab('problem');
  };

  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setSavingProblem(true);
    
    const { data: saved, error } = await supabase
      .from('coding_problems')
      .upsert({
        event_id: selectedEventId,
        ...problemData
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
    } else {
      setProblemId(saved.id);
      // Refresh events list to show "has_problem"
      fetchEvents();
      alert('Problem saved successfully!');
    }
    setSavingProblem(false);
  };

  const handleAddTestCase = async (e) => {
    e.preventDefault();
    if (!problemId) return;
    setAddingTestCase(true);

    const { error } = await supabase
      .from('coding_test_cases')
      .insert({
        problem_id: problemId,
        ...newTestCase
      });

    if (error) {
      alert(error.message);
    } else {
      setNewTestCase({
        input: '',
        expected_output: '',
        is_hidden: true,
        order_num: testCases.length + 2
      });
      loadTestCases(problemId);
      alert('Test case added successfully!');
    }
    setAddingTestCase(false);
  };

  const handleDeleteTestCase = async (id) => {
    if (!window.confirm('Delete this test case?')) return;
    const { error } = await supabase
      .from('coding_test_cases')
      .delete()
      .eq('id', id);
    if (error) alert(error.message);
    else loadTestCases(problemId);
  };

  const visibleCount = testCases.filter(t => !t.is_hidden).length;
  const hiddenCount = testCases.filter(t => t.is_hidden).length;

  if (loading && events.length === 0) return <div className="p-10 text-center"><div className="w-10 h-10 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 pb-20">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coding Architecture</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Configure algorithmic challenges, judge-ready test cases, and execution constraints.</p>
        </div>
        <div style={{ width: 48, height: 48, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CodeXml size={20} style={{ color: 'var(--blue)' }} />
        </div>
      </div>

      {/* Section 1: Event Selector */}
      <section style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.6 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>01. Select Challenge Deployment</h2>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontMono: true }}>{events.length} Target Events</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleSelectEvent(ev.id)}
              style={{
                background: selectedEventId === ev.id ? 'var(--surface)' : 'var(--elevated)',
                border: selectedEventId === ev.id ? '1px solid var(--blue)' : '1px solid var(--border)',
                borderRadius: 12, padding: 20, textAlign: 'left', transition: 'all 0.2s',
                boxShadow: selectedEventId === ev.id ? '0 8px 32px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
                  background: ev.status === 'live' ? 'rgba(16,185,129,0.1)' : 'var(--elevated)',
                  color: ev.status === 'live' ? 'var(--green)' : 'var(--text-muted)',
                  border: '1px solid currentColor'
                }}>
                  {ev.status}
                </span>
                {ev.has_problem && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CircleCheck size={12} /> CONFIGURED
                  </span>
                )}
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{ev.title}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {ev.id.slice(0, 8)}...</p>
            </button>
          ))}
          {events.length === 0 && !loading && (
             <div style={{ gridColumn: '1 / -1', padding: 48, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center', borderStyle: 'dashed' }}>
               <p style={{ color: 'var(--text-muted)', fontWeight: 700 }}>No coding deployments found in the registry.</p>
             </div>
          )}
        </div>
      </section>

      {/* Section 2: Editor */}
      {selectedEventId && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('problem')}
              style={{
                padding: '16px 32px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '2px solid transparent', transition: 'all 0.2s',
                color: activeTab === 'problem' ? 'var(--blue)' : 'var(--text-muted)',
                borderColor: activeTab === 'problem' ? 'var(--blue)' : 'transparent',
                background: activeTab === 'problem' ? 'var(--surface)' : 'transparent'
              }}
            >
              Problem Specification
            </button>
            <button
              onClick={() => problemId ? setActiveTab('test_cases') : alert('Commit problem statement first.')}
              style={{
                padding: '16px 32px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '2px solid transparent', transition: 'all 0.2s',
                color: activeTab === 'test_cases' ? 'var(--blue)' : 'var(--text-muted)',
                borderColor: activeTab === 'test_cases' ? 'var(--blue)' : 'transparent',
                background: activeTab === 'test_cases' ? 'var(--surface)' : 'transparent',
                opacity: problemId ? 1 : 0.4
              }}
            >
              Test Scenarios ({testCases.length})
            </button>
          </div>

          <div style={{ padding: 32 }}>
            {activeTab === 'problem' ? (
              <form onSubmit={handleSaveProblem} style={{ display: 'grid', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  <div style={{ display: 'grid', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Challenge Identity</label>
                      <input required value={problemData.title} onChange={e=>setProblemData({...problemData, title: e.target.value})} placeholder="e.g. Memory Optimized Sort" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Problem Narrative (Markdown)</label>
                      <textarea required value={problemData.statement} onChange={e=>setProblemData({...problemData, statement: e.target.value})} rows={14} placeholder="Define the algorithmic challenge objectives..." style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, resize: 'none' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>STDIN Interface</label>
                      <textarea required value={problemData.input_format} onChange={e=>setProblemData({...problemData, input_format: e.target.value})} rows={4} placeholder="Define input structure per line..." style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>STDOUT Contract</label>
                      <textarea required value={problemData.output_format} onChange={e=>setProblemData({...problemData, output_format: e.target.value})} rows={3} placeholder="Define expected output precision..." style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>System Constraints</label>
                      <input value={problemData.constraints} onChange={e=>setProblemData({...problemData, constraints: e.target.value})} placeholder="e.g. 1 ≤ T ≤ 50, 0 ≤ N ≤ 10^7" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                       <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, textAlign: 'center' }}>CPU Limit (ms)</label>
                          <input type="number" required value={problemData.time_limit_ms} onChange={e=>setProblemData({...problemData, time_limit_ms: parseInt(e.target.value)})} style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', textAlign: 'center', fontMono: true }} />
                       </div>
                       <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, textAlign: 'center' }}>Points / Test</label>
                          <input type="number" required value={problemData.points_per_testcase} onChange={e=>setProblemData({...problemData, points_per_testcase: parseInt(e.target.value)})} style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', textAlign: 'center', fontMono: true }} />
                       </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
                  <button type="submit" disabled={savingProblem} className="btn-primary" style={{ padding: '12px 40px', background: 'var(--blue)', color: '#000', fontSize: 12 }}>
                    <Save size={16} /> {savingProblem ? 'Synchronizing...' : 'Commit Problem'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'grid', gap: 40 }}>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Execution Scenarios</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                         <span style={{ color: 'var(--green)', fontWeight: 700 }}>{visibleCount} Sample</span> · <span style={{ fontWeight: 700 }}>{hiddenCount} Security</span>
                      </p>
                    </div>
                    {testCases.length < 5 && (
                      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)', fontSize: 11, fontWeight: 700 }}>
                        <CircleAlert size={14} /> Min 5 scenarios recommended for integrity.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }} className="custom-scrollbar">
                     {testCases.map((tc) => (
                       <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--elevated)', border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
                         <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>{tc.order_num}</div>
                         <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                           <div>
                             <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Stdin</p>
                             <p style={{ fontMono: true, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tc.input || '(empty)'}</p>
                           </div>
                           <div>
                             <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Stdout</p>
                             <p style={{ fontMono: true, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tc.expected_output || '(empty)'}</p>
                           </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                           <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, border: '1px solid currentColor', color: tc.is_hidden ? 'var(--text-muted)' : 'var(--green)' }}>
                             {tc.is_hidden ? 'Security' : 'Sample'}
                           </span>
                           <button onClick={() => handleDeleteTestCase(tc.id)} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} className="hover-red">
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </div>
                     ))}
                     {testCases.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 48, fontWeight: 700 }}>No test scenarios defined for this architecture.</p>}
                  </div>
                </div>

                <div style={{ background: 'var(--elevated)', padding: 32, borderRadius: 16, border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>New Scenario Entry</h3>
                  <form onSubmit={handleAddTestCase} style={{ display: 'grid', gap: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                       <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Architectural Input (stdin)</label>
                          <textarea required value={newTestCase.input} onChange={e=>setNewTestCase({...newTestCase, input: e.target.value})} rows={3} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontMono: true, fontSize: 13, resize: 'none' }} />
                       </div>
                       <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Expected Signature (stdout)</label>
                          <textarea required value={newTestCase.expected_output} onChange={e=>setNewTestCase({...newTestCase, expected_output: e.target.value})} rows={3} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontMono: true, fontSize: 13, resize: 'none' }} />
                       </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scope:</span>
                          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, gap: 4 }}>
                            <button type="button" onClick={() => setNewTestCase({...newTestCase, is_hidden: false})}
                              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: !newTestCase.is_hidden ? 'var(--blue)' : 'transparent', color: !newTestCase.is_hidden ? '#000' : 'var(--text-muted)' }}>Visible</button>
                            <button type="button" onClick={() => setNewTestCase({...newTestCase, is_hidden: true})}
                              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: newTestCase.is_hidden ? 'var(--elevated)' : 'transparent', color: newTestCase.is_hidden ? 'var(--text-primary)' : 'var(--text-muted)' }}>Security</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Index:</span>
                            <input type="number" required value={newTestCase.order_num} onChange={e=>setNewTestCase({...newTestCase, order_num: parseInt(e.target.value)})} style={{ width: 64, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', color: 'var(--text-primary)', textAlign: 'center', fontMono: true }} />
                          </div>
                       </div>
                       <button type="submit" disabled={addingTestCase} className="btn-primary" style={{ padding: '12px 32px', background: 'var(--text-primary)', color: 'var(--surface)', fontSize: 11 }}>
                         <Plus size={16} /> {addingTestCase ? 'Injecting...' : 'Add Scenario'}
                       </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );

}
