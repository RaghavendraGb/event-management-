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
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  user:  'bg-slate-800 text-slate-400 border-slate-700',
};

const STATUS_COLORS = {
  pending:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  // ── Reject User (Soft delete — status = 'rejected') ────────────
  // J: Soft rejects block login via App.jsx fetchProfile without removing data
  const rejectUser = async (userId, userName) => {
    if (!confirm(`Reject "${userName}"? They will be signed out and permanently blocked from logging in.`)) return;
    setActionLoading(userId);
    const { error } = await supabase
      .from('users')
      .update({ status: 'rejected' })
      .eq('id', userId);
    if (error) { alert('Error: ' + error.message); }
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected' } : u));
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
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            User Management
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Approve new registrations, manage roles, and remove users.</p>
        </div>
        <button onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all border border-slate-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Pending Alert Banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Clock className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
          <div>
            <p className="text-amber-400 font-black text-sm uppercase tracking-wider">
              {pendingCount} Registration{pendingCount > 1 ? 's' : ''} Awaiting Approval
            </p>
            <p className="text-amber-300/70 text-xs mt-0.5">Review and approve users below so they can log in.</p>
          </div>
          <button onClick={() => setTab('pending')}
            className="ml-auto px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-black uppercase rounded-lg transition-all shrink-0">
            Review Now
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Tab Pills */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                tab === t ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t === 'pending' && pendingCount > 0 && (
                <span className="w-4 h-4 bg-amber-500 text-amber-950 rounded-full text-[9px] flex items-center justify-center font-black">
                  {pendingCount}
                </span>
              )}
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, college..."
            className="bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none flex-1"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-white/5">
                <tr>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:table-cell">College</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hidden lg:table-cell">Joined</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(u => {
                  const isBusy = actionLoading === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">

                      {/* User info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-sm text-white uppercase shrink-0">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{u.name || 'Unknown'}</p>
                            <p className="text-slate-500 text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* College */}
                      <td className="p-4 hidden md:table-cell">
                        <p className="text-slate-400 text-sm flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          {u.college || <span className="text-slate-700 italic">Not set</span>}
                        </p>
                      </td>

                      {/* Status badge */}
                      <td className="p-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-black uppercase tracking-widest ${STATUS_COLORS[u.status] || STATUS_COLORS.pending}`}>
                          {u.status === 'approved'
                            ? <><CheckCircle2 className="inline w-3 h-3 mr-1" />Approved</>
                            : u.status === 'rejected'
                            ? <><UserX className="inline w-3 h-3 mr-1" />Rejected</>
                            : <><Clock className="inline w-3 h-3 mr-1" />Pending</>
                          }
                        </span>
                      </td>

                      {/* Role badge */}
                      <td className="p-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-black uppercase tracking-widest ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
                          {u.role === 'admin' ? <><ShieldCheck className="inline w-3 h-3 mr-1" />Admin</> : 'User'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-4 hidden lg:table-cell text-slate-500 text-xs font-mono">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Approve (only for pending) */}
                          {u.status === 'pending' && (
                            <button
                              disabled={isBusy}
                              onClick={() => approveUser(u.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}

                          {/* J: Reject (soft-blocks login without hard delete) */}
                          {u.status !== 'rejected' && (
                            <button
                              disabled={isBusy}
                              onClick={() => rejectUser(u.id, u.name)}
                              title="Reject — blocks login"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all disabled:opacity-50 border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          )}

                          {/* Toggle admin role */}
                          <button
                            disabled={isBusy}
                            onClick={() => toggleRole(u.id, u.role)}
                            title={u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all disabled:opacity-50 border ${
                              u.role === 'admin'
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500/40 hover:text-purple-400'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>

                          {/* Hard Delete */}
                          <button
                            disabled={isBusy}
                            onClick={() => removeUser(u.id, u.name)}
                            title="Hard delete — removes all data"
                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {isBusy && (
                            <div className="w-4 h-4 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-12 text-center">
                      <UserX className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 font-bold">
                        {search ? `No users matching "${search}"` : `No ${tab === 'all' ? '' : tab} users found.`}
                      </p>
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
