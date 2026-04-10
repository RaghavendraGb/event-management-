import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Search, 
  Filter,
  MonitorPlay
} from 'lucide-react';

export function AdminSimulations() {
  const user = useStore(state => state.user);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('simulation_submissions')
      .select(`
        *,
        users(name, email, college),
        question_bank:question_id(question, sim_marks, sim_expected_output),
        events:event_id(title)
      `)
      .eq('status', activeTab)
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      setSubmissions(data);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleApprove = async (sub) => {
    const marksToAward = sub.question_bank?.sim_marks || 10;
    
    // 1. Update status
    const { error: subErr } = await supabase.from('simulation_submissions').update({
      status: 'approved',
      marks_awarded: marksToAward,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', sub.id);

    if (subErr) {
      alert(subErr.message);
      return;
    }
    
    // 2. Add marks to participation
    const { data: part } = await supabase
      .from('participation')
      .select('score')
      .eq('id', sub.participation_id)
      .single();
    
    await supabase.from('participation').update({
      score: (part?.score || 0) + marksToAward
    }).eq('id', sub.participation_id);
    
    fetchData();
  };

  const handleReject = async (sub) => {
    const reason = prompt('Optional: Enter rejection reason (shown to student in history):') || '';
    
    const { error } = await supabase.from('simulation_submissions').update({
      status: 'rejected',
      marks_awarded: 0,
      admin_note: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', sub.id);

    if (error) alert(error.message);
    else fetchData();
  };

  const filtered = submissions.filter(s => 
    s.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.users?.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.events?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Simulation Audit</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Verify architectural proofs, evaluate simulation integrity, and distribute performance marks.</p>
        </div>
        <div style={{ width: 48, height: 48, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MonitorPlay size={20} style={{ color: 'var(--blue)' }} />
        </div>
      </div>

      {/* Controls: Tabs & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', gap: 4, background: 'var(--elevated)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
             {['pending', 'approved', 'rejected'].map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 style={{
                   padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.2s',
                   background: activeTab === tab ? 'var(--surface)' : 'transparent',
                   color: activeTab === tab ? 'var(--blue)' : 'var(--text-muted)',
                   border: activeTab === tab ? '1px solid var(--border)' : '1px solid transparent'
                 }}
               >
                 {tab} {activeTab === tab && `(${filtered.length})`}
               </button>
             ))}
           </div>
           <div style={{ position: 'relative', width: 320 }}>
             <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
             <input
               placeholder="Filter by operator, entity or deployment..."
               style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px 10px 40px', color: 'var(--text-primary)', fontSize: 12 }}
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 128, textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 24 }}>
          {filtered.map((sub) => (
            <div key={sub.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Submission Header */}
              <div style={{ padding: 20, background: 'var(--elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.users?.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub.users?.email} · {sub.users?.college}</p>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: 4 }}>
                      {sub.events?.title}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {sub.question_bank?.sim_marks} Points Potential
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', fontMono: true, background: 'var(--surface)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 6 }}>
                     {sub.watermark_code}
                   </div>
                   <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>{new Date(sub.submitted_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Visual Proof */}
              <div style={{ padding: 20, flex: 1 }}>
                <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#000', position: 'relative' }}>
                  <img src={sub.screenshot_url} alt="Proof" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'contain', transition: 'all 0.3s' }} className="hover-scale" />
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: 6, backdropFilter: 'blur(4px)' }}>
                    <ExternalLink size={14} style={{ color: '#fff' }} />
                  </div>
                </a>
                
                {sub.question_bank?.sim_expected_output && (
                  <div style={{ marginTop: 16, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Expected Signature</p>
                    <p style={{ fontMono: true, fontSize: 11, color: 'var(--text-secondary)' }}>{sub.question_bank.sim_expected_output}</p>
                  </div>
                )}
              </div>

              {/* Action Layer */}
              <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--elevated)' }}>
                {sub.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => handleApprove(sub)} className="btn-primary" style={{ flex: 1, padding: '10px', background: 'var(--green)', color: '#000', fontSize: 11 }}>
                      Authorize Performance
                    </button>
                    <button onClick={() => handleReject(sub)} className="btn-ghost" style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11 }}>
                      Reject Proof
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px', borderRadius: 8, background: sub.status === 'approved' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${sub.status === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {sub.status === 'approved' ? <CheckCircle2 size={16} style={{ color: 'var(--green)' }} /> : <XCircle size={16} style={{ color: 'var(--red)' }} />}
                    <span style={{ fontSize: 10, fontWeight: 800, color: sub.status === 'approved' ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>
                      {sub.status === 'approved' ? `Authorized: ${sub.marks_awarded} Points Distr.` : 'Validation Failed'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 128, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center', borderStyle: 'dashed' }}>
              <MonitorPlay size={48} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 24px' }} />
              <p style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>Registry clean. No {activeTab} proofs identified.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
