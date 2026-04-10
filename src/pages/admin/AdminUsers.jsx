import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users, UserCheck, UserX, ShieldCheck, Shield,
  Search, Trash2, RefreshCw, Clock, CheckCircle2,
  ChevronDown, Mail, Building2
} from 'lucide-react';

const TABS = ['all', 'pending', 'approved', 'rejected'];
const TAB_LABELS = { all: 'All Users', pending: 'Pending Approval', approved: 'Approved', rejected: 'Rejected' };

const ROLE_COLORS = {
  admin: 'color: #a855f7; border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.06);',
  user:  'color: var(--text-muted); border-color: var(--border); background: var(--elevated);',
};

const STATUS_COLORS = {
  pending:  'color: var(--amber); border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.06);',
  approved: 'color: var(--green); border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.06);',
  rejected: 'color: var(--red); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.06);',
};

const parseStyle = (str) => {
  const obj = {};
  str.split(';').forEach(pair => {
    const [k, v] = pair.split(':');
    if (k && v) obj[k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase())] = v.trim();
  });
  return obj;
};

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // user id being actioned

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, college, role, status, created_at')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    if (error) console.error('Error fetching users:', error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // ── Approve User ────────────────────────────────────────────
  const approveUser = async (userId) => {
    setActionLoading(userId);
    const { error } = await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('id', userId);
    if (error) { alert('Error: ' + error.message); }
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'approved' } : u));
    }
    setActionLoading(null);
  };

  // ── Toggle Admin Role ────────────────────────────────────────
  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change this user's role to ${newRole}?`)) return;
    setActionLoading(userId);
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) { alert('Error: ' + error.message); }
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setActionLoading(null);
  };

  // ── Hard Remove User ─────────────────────────────────────────
  const removeUser = async (userId, userName) => {
    if (!confirm(`⚠️ HARD DELETE user "${userName}"? This permanently removes all their data. Cannot be undone.`)) return;
    setActionLoading(userId);
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (error) { alert('Could not remove user: ' + error.message); }
    else {
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
    setActionLoading(null);
  };

  // ── Filter / Search ─────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchTab = tab === 'all' || u.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.college?.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Personnel Control</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Authorize registrations, audit permissions, and monitor active operators.</p>
        </div>
        <button onClick={fetchUsers} className="btn-ghost" style={{ padding: '10px 20px', background: 'var(--elevated)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Synchronize
        </button>
      </div>

      {/* Pending Alert Banner */}
      {pendingCount > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Clock size={20} style={{ color: 'var(--amber)' }} className="animate-pulse" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {pendingCount} Registration Action Required
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Authenticate and approve personnel identities before system access is granted.</p>
          </div>
          <button onClick={() => setTab('pending')} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--amber)', color: '#000', fontSize: 11 }}>
            Resolve Now
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, gap: 4 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s',
                background: tab === t ? 'var(--blue)' : 'transparent',
                color: tab === t ? '#000' : 'var(--text-muted)',
              }}>
              {t === 'pending' && pendingCount > 0 && <span style={{ marginRight: 6, color: tab === t ? '#000' : 'var(--amber)' }}>●</span>}
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by identity / email / entity…"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px 10px 36px', color: 'var(--text-primary)', fontSize: 13 }}
          />
        </div>
      </div>

      {/* User Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Operator</th>
                  <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>College / Entity</th>
                  <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security Status</th>
                  <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>System Role</th>
                  <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {filtered.map(u => {
                  const isBusy = actionLoading === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || 'Anonymous'}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                         <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.college || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unspecified</span>}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, border: '1px solid currentColor', ...parseStyle(STATUS_COLORS[u.status] || STATUS_COLORS.pending) }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, border: '1px solid currentColor', ...parseStyle(ROLE_COLORS[u.role] || ROLE_COLORS.user) }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {u.status === 'pending' && (
                            <button onClick={() => approveUser(u.id)} disabled={isBusy} className="btn-primary" style={{ padding: '4px 10px', background: 'var(--green)', color: '#000', fontSize: 10 }}>
                              Approve
                            </button>
                          )}
                          <button onClick={() => toggleRole(u.id, u.role)} disabled={isBusy} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, background: 'var(--elevated)' }}>
                             {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                          <button onClick={() => removeUser(u.id, u.name)} disabled={isBusy} className="btn-ghost" style={{ padding: 4, minHeight: 'unset', color: 'var(--red)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No matching records located in the personnel directory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Footer count */}
      {!loading && (
        <p className="text-xs text-slate-600 text-right font-mono">
          Showing {filtered.length} of {users.length} registered users
        </p>
      )}
    </div>
  );
}
