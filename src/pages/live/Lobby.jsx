import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Clock, Radio, Activity, Bell, BellOff } from 'lucide-react';

export function Lobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const setPreloadedQuestions = useStore((state) => state.setPreloadedQuestions);
  
  // Base Data
  const [ticket, setTicket] = useState(null);
  const [eventData, setEventData] = useState(null);
  const eventTypeRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      // 1. Fetch Ticket Info
      const { data: ticketData, error } = await supabase
        .from('participation')
        .select(`
          id, status, registered_at,
          events (*),
          teams (name, invite_code)
        `)
        .eq('user_id', user.id)
        .eq('event_id', id)
        .single();

      if (error || !ticketData) {
        navigate(`/events/${id}`);
        return;
      }
      setTicket(ticketData);
      setEventData(ticketData.events);
      setEventType(ticketData.events.type);
      eventTypeRef.current = ticketData.events.type;

      // If results announced or event ended, redirect to results — not lobby
      if (ticketData.events.results_announced === true || ticketData.events.status === 'ended') {
        navigate(`/results/${id}`);
        return;
      }

      // If already live, just kick them in!
      if (ticketData.events.status === 'live') {
        navigate(ticketData.events.type === 'coding_challenge' ? `/live-coding/${id}` : `/live/${id}`);
        return;
      }

      // Feature 2: Preload questions into Zustand store while waiting in lobby
      // Coding events have no event_questions — skip this fetch for them
      if (ticketData.events.status === 'upcoming' && ticketData.events.type !== 'coding_challenge') {
        supabase
          .from('event_questions')
          .select('*, question_bank(*)')
          .eq('event_id', id)
          .order('order_num', { ascending: true })
          .then(({ data: qData }) => {
            if (qData && isMountedRef.current) {
              setPreloadedQuestions({ eventId: id, questions: qData });
            }
          });
      }

      // 2. Fetch Aggregated Joined Data
      const { data: parts, count } = await supabase
        .from('participation')
        .select(`users(id, name, avatar_url)`, { count: 'exact' })
        .eq('event_id', id)
        .limit(20);
        
      if (parts) {
        setParticipants(parts.map(p => p.users).filter(Boolean));
        setTotalJoined(count || parts.length);
      }

      // 3. Fetch Teams if relevant
      const { data: teamsData } = await supabase
        .from('teams')
        .select(`id, name, team_members(count)`)
        .eq('event_id', id);
      if (teamsData) setTeams(teamsData);

      setLoading(false);
    }
    loadData();
  }, [id, user, navigate, setPreloadedQuestions]);

  // Feature 11: Schedule browser notifications for event start
  useEffect(() => {
    if (!eventData?.start_at || notifPermission !== 'granted') return;

    const startMs = new Date(eventData.start_at).getTime();
    const fiveMinBefore = startMs - 5 * 60 * 1000;
    const now = Date.now();

    // 5-minute warning (only if it's in the future)
    if (fiveMinBefore > now) {
      notifTimer5Ref.current = setTimeout(() => {
        if (document.hidden) {
          new Notification(`Zentrix: ${eventData.title} starts in 5 minutes!`, {
            body: 'Get ready — the competition is about to begin.',
            icon: '/icon-192x192.png',
          });
        }
      }, fiveMinBefore - now);
    }

    // At-start notification
    if (startMs > now) {
      notifTimerStartRef.current = setTimeout(() => {
        if (document.hidden) {
          new Notification(`Zentrix: ${eventData.title} is LIVE now!`, {
            body: 'Click to join the competition.',
            icon: '/icon-192x192.png',
          });
        }
      }, startMs - now);
    }

    return () => {
      if (notifTimer5Ref.current) clearTimeout(notifTimer5Ref.current);
      if (notifTimerStartRef.current) clearTimeout(notifTimerStartRef.current);
    };
  }, [eventData, notifPermission]);

  const requestNotification = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  // Realtime Subscriptions
  useEffect(() => {
    if (!user || loading) return;

    // FIX #22: Hold ref to fallbackPoller so realtime handler can clear it immediately
    let fallbackPoller = null;

    // 1. Setup Status Subscription / Fallback Polling
    const statusChannel = supabase.channel(`event-${id}-updates`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new.results_announced === true || payload.new.status === 'ended') {
          if (fallbackPoller) {
            clearInterval(fallbackPoller);
            fallbackPoller = null;
          }
          if (isMountedRef.current) navigate(`/results/${id}`);
          return;
        }
        if (payload.new.status === 'live') {
          // FIX #22: clear poller BEFORE navigating to prevent stale .then() callbacks
          if (fallbackPoller) {
            clearInterval(fallbackPoller);
            fallbackPoller = null;
          }
          if (isMountedRef.current) {
            // Use payload type if available, otherwise fallback to ref
            const type = payload.new.type || eventTypeRef.current;
            navigate(type === 'coding_challenge' ? `/live-coding/${id}` : `/live/${id}`);
          }
        }
      })
      .subscribe();

    fallbackPoller = setInterval(async () => {
      const { data } = await supabase.from('events').select('status, results_announced, type').eq('id', id).single();
      if (!data || !isMountedRef.current) return;
      if (data.results_announced === true || data.status === 'ended') {
        if (fallbackPoller) clearInterval(fallbackPoller);
        navigate(`/results/${id}`);
        return;
      }
      if (data.status === 'live') {
        if (fallbackPoller) clearInterval(fallbackPoller);
        navigate(data.type === 'coding_challenge' ? `/live-coding/${id}` : `/live/${id}`);
      }
    }, 5000);

    // 2. Setup Presence Channel
    const room = supabase.channel(`lobby-${id}`, {
      config: { presence: { key: user.id } }
    });

    room.on('presence', { event: 'sync' }, () => {
      const state = room.presenceState();
      if (isMountedRef.current) setLiveCount(Object.keys(state).length);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await room.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(room);
      if (fallbackPoller) clearInterval(fallbackPoller);
    };
  }, [id, user, loading, navigate]);

  // Countdown Timer
  useEffect(() => {
    if (!eventData) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(eventData.start_at).getTime() - now;
      if (distance < 0) {
        setTimeLeft('Starting Very Soon...');
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        let str = '';
        if (days > 0) str += `${days}d `;
        str += `${hours}h ${minutes}m ${seconds}s`;
        setTimeLeft(str);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [eventData]);


  if (loading || !eventData) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div style={{ width: 40, height: 40, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 64 }}>
      
      {/* Sponsor Banner */}
      {eventData.sponsor_logo_url && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Sponsored By</p>
          <img src={eventData.sponsor_logo_url} alt="Sponsor" style={{ maxHeight: 40, objectFit: 'contain', opacity: 0.85 }} />
        </div>
      )}

      {/* Feature 11: Notification permission prompt */}
      {notifPermission !== 'granted' && notifPermission !== 'denied' && (
        <div style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Bell size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Get notified when this starts</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>We'll alert you 5 minutes before the event begins.</p>
          </div>
          <button onClick={requestNotification} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
            Enable
          </button>
        </div>
      )}
      {notifPermission === 'granted' && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Bell size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--green)' }}>Notifications enabled — you'll be alerted when this event starts</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} id="lobby-grid">
        <style>{`@media (min-width: 1024px) { #lobby-grid { grid-template-columns: 1fr 300px; } }`}</style>
        {/* Main Action Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <span className="badge badge--blue" style={{ marginBottom: 12, display: 'inline-flex' }}>{eventData.type.replace('_', ' ')}</span>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24, wordBreak: 'break-word' }}>
                {eventData.title}
              </h1>

              <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 28px', marginBottom: 20, display: 'inline-block' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Clock size={12} /> Starts In
                </p>
                <div style={{ fontSize: 32, fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--amber)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>
                  {timeLeft}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="live-dot" />
                <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>Waiting for admin to launch...</span>
              </div>
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--elevated)', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={14} style={{ color: 'var(--blue)' }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{liveCount} Online Now</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>On this page</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={14} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{totalJoined} Registered</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total participants</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }} id="lobby-roster-grid">
            <style>{`@media (min-width: 640px) { #lobby-roster-grid { grid-template-columns: repeat(2, 1fr); } }`}</style>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
              <p className="t-section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={11} /> Current Roster</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {participants.map((u, i) => (
                  <div key={i} className="avatar-circle" title={u?.name || 'Participant'} style={{ cursor: 'default' }}>
                    {u?.avatar_url
                      ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (u?.name?.charAt(0) || '?')
                    }
                  </div>
                ))}
                {totalJoined > 20 && (
                  <div className="avatar-circle" style={{ color: 'var(--text-muted)', fontSize: 11 }}>+{totalJoined - 20}</div>
                )}
                {participants.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No participants yet</p>}
              </div>
            </div>

            {teams.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <p className="t-section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={11} /> Teams</p>
                <div style={{ maxHeight: 180, overflowY: 'auto' }} className="custom-scrollbar">
                  {teams.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{t.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {(Array.isArray(t.team_members) && t.team_members[0]?.count) || 0} members
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Digital Ticket panel */}
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Your Ticket</p>
              {ticket.teams ? (
                <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', display: 'inline-block' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Team</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{ticket.teams.name}</p>
                </div>
              ) : (
                <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', display: 'inline-block' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Entry</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Solo Competitor</p>
                </div>
              )}
            </div>

            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <QRCodeSVG
                  value={JSON.stringify({ pid: ticket.id, uid: user.id })}
                  size={148}
                  level="L"
                  includeMargin={false}
                />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Ticket ID</p>
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, letterSpacing: '0.1em' }}>{ticket.id.split('-')[0]}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
            Page auto-redirects when event starts. Do not close this tab.
          </p>
        </div>

      </div>
    </div>
  );
}
