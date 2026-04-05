import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Users, CalendarDays, Search } from 'lucide-react';

function StatusBadge({ status }) {
  const cls = {
    live: 'badge badge--live',
    upcoming: 'badge badge--upcoming',
    ended: 'badge badge--ended',
  }[status] || 'badge badge--ended';
  return (
    <span className={cls}>
      {status === 'live' && <span className="live-dot" />}
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className="badge badge--blue" style={{ textTransform: 'none', letterSpacing: 0 }}>
      {type?.replace('_', ' ')}
    </span>
  );
}

export function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    async function getEvents() {
      const { data } = await supabase
        .from('events')
        .select(`*, participation:participation(count)`)
        .order('start_at', { ascending: true });

      if (data) setEvents(data);
      setLoading(false);
    }
    getEvents();
  }, []);

  const filtered = events.filter(evt => {
    const matchSearch = !search || evt.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || evt.status === filterStatus;
    const matchType = filterType === 'all' || evt.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const types = [...new Set(events.map(e => e.type).filter(Boolean))];

  const inputStyle = {
    background: 'var(--elevated)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Page header + filters */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 20,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Events</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              id="events-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events..."
              style={{ ...inputStyle, paddingLeft: 28, minWidth: 160, minHeight: 'unset', fontSize: 13 }}
            />
          </div>
          {/* Status filter */}
          <select
            id="events-filter-status"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, minHeight: 'unset' }}
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
          </select>
          {/* Type filter */}
          {types.length > 1 && (
            <select
              id="events-filter-type"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ ...inputStyle, minHeight: 'unset' }}
            >
              <option value="all">All Types</option>
              {types.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              padding: '14px 16px',
              borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <CalendarDays size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search || filterStatus !== 'all' || filterType !== 'all' ? 'No matching events' : 'No active events'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Check back soon</p>
        </div>
      ) : (
        <>
          {/* TABLE layout — tablet+ */}
          <div id="events-table-wrap" style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            overflow: 'hidden', display: 'none',
          }}>
            <table className="data-table" style={{ display: 'table', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Participants</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((evt) => {
                  const count = evt.participation?.[0]?.count || 0;
                  const isFull = evt.max_participants && count >= evt.max_participants;
                  return (
                    <tr key={evt.id}>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {evt.title}
                        </p>
                        {evt.description && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.4 }}>
                            {evt.description}
                          </p>
                        )}
                      </td>
                      <td><TypeBadge type={evt.type} /></td>
                      <td><StatusBadge status={evt.status} /></td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {count}{evt.max_participants ? ` / ${evt.max_participants}` : ''}
                        </span>
                      </td>
                      <td>
                        {isFull ? (
                          <span style={{ fontSize: 12, color: 'var(--red)' }}>Full</span>
                        ) : evt.status === 'ended' ? (
                          <Link to={`/events/${evt.id}`} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>Results</Link>
                        ) : (
                          <Link to={`/events/${evt.id}`} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                            {evt.status === 'live' ? 'Join' : 'Register'}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CARD LIST — mobile */}
          <div id="events-card-list">
            {filtered.map((evt) => {
              const count = evt.participation?.[0]?.count || 0;
              const isFull = evt.max_participants && count >= evt.max_participants;
              return (
                <div key={evt.id} style={{
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', flex: 1 }}>
                      {evt.title}
                    </p>
                    <StatusBadge status={evt.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <TypeBadge type={evt.type} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <CalendarDays size={11} style={{ display: 'inline', marginRight: 2 }} />
                      {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <Users size={11} style={{ display: 'inline', marginRight: 2 }} />
                      {count}{evt.max_participants ? ` / ${evt.max_participants}` : ''}
                    </span>
                  </div>
                  {isFull ? (
                    <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Full</span>
                  ) : evt.status === 'ended' ? (
                    <Link to={`/events/${evt.id}`} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex' }}>Results</Link>
                  ) : (
                    <Link to={`/events/${evt.id}`} className="btn-primary" style={{ fontSize: 12, display: 'inline-flex' }}>
                      {evt.status === 'live' ? 'Join Now' : 'Register'}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <style>{`
            @media (min-width: 768px) {
              #events-table-wrap { display: block !important; }
              #events-card-list { display: none !important; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
