import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  Calendar, Users, Award, 
  Activity, ArrowRight, CheckCircle2 
} from 'lucide-react';

function StatCard({ title, value, icon, color, description }) {
  const CardIcon = icon;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }} className="hover-elevated">
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.03, filter: 'blur(20px)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <CardIcon size={20} />
        </div>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
      </div>
      <div>
        <h3 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</h3>
        {description && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{description}</p>}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalParticipants: 0,
    certificatesMinted: 0
  });
  
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDash() {
      // Parallel Aggregations
      const [eventsRes, partsRes, certsRes] = await Promise.all([
        supabase.from('events').select('id, title, status, type, start_at', { count: 'exact' }),
        supabase.from('participation').select('id', { count: 'exact' }),
        supabase.from('certificates').select('id', { count: 'exact' })
      ]);

      const events = eventsRes.data || [];
      const activeCount = events.filter(e => e.status === 'live').length;

      setStats({
        totalEvents: eventsRes.count || 0,
        activeEvents: activeCount,
        totalParticipants: partsRes.count || 0,
        certificatesMinted: certsRes.count || 0
      });

      // Grab recent 5
      setRecentEvents(events.sort((a,b) => new Date(b.start_at) - new Date(a.start_at)).slice(0, 5));
      setLoading(false);
    }
    loadDash();
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}><div style={{ width: 40, height: 40, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Command Center</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Real-time platform metrics and operational oversight.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)', padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 800, border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
             <div className="live-dot" /> SYSTEM ACTIVE
           </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        <StatCard title="Asset Deployments" value={stats.totalEvents} icon={Calendar} color="var(--blue)" description="Total competition instances created." />
        <StatCard title="Active Protocols" value={stats.activeEvents} icon={Activity} color="var(--green)" description="Currently running live events." />
        <StatCard title="Personnel Registry" value={stats.totalParticipants} icon={Users} color="#a855f7" description="Total registered participant accounts." />
        <StatCard title="Authentication Issued" value={stats.certificatesMinted} icon={Award} color="var(--amber)" description="Total certificates generated to date." />
      </div>

      {/* Recent Activity */}
      <div style={{ spaceY: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Deployments</h2>
          <Link to="/admin/events" style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }} className="hover-underline">
            Access Full Registry <ArrowRight size={14}/>
          </Link>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 24px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Event Signature</th>
                  <th style={{ padding: '16px 24px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sub-protocol</th>
                  <th style={{ padding: '16px 24px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lifecycle State</th>
                  <th style={{ padding: '16px 24px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Initialization</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {recentEvents.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }} className="row-hover">
                    <td style={{ padding: '18px 24px' }}>
                      <Link to={`/admin/events`} style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>{e.title}</Link>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', background: 'var(--elevated)', borderRadius: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', border: '1px solid var(--border)', letterSpacing: '0.02em' }}>
                        {e.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      {e.status === 'upcoming' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }} /> Scheduled
                      </span>}
                      {e.status === 'live' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="live-dot" /> Live Active
                      </span>}
                      {e.status === 'ended' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={12} /> Terminated
                      </span>}
                    </td>
                    <td style={{ padding: '18px 24px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {new Date(e.start_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {recentEvents.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: 64, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--elevated)' }}>
                      <Activity size={32} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Registry Empty. Initialize a deployment to start.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
