import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Clock, Radio, Activity } from 'lucide-react';

export function Lobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  
  // Base Data
  const [ticket, setTicket] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Social Data
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [totalJoined, setTotalJoined] = useState(0);

  // Realtime Data
  const [liveCount, setLiveCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');

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

      // If already live, just kick them in!
      if (ticketData.events.status === 'live') {
        navigate(`/live/${id}`);
        return;
      }

      // 2. Fetch Aggregated Joined Data
      const { data: parts, count } = await supabase
        .from('participation')
        .select(`users(id, name, avatar_url)`, { count: 'exact' })
        .eq('event_id', id)
        .limit(20);
        
      if (parts) {
        setParticipants(parts.map(p => p.users));
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
  }, [id, user, navigate]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!user || loading) return;

    // 1. Setup Status Subscription / Fallback Polling
    const statusChannel = supabase.channel(`event-${id}-updates`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new.status === 'live') {
          navigate(`/live/${id}`);
        }
      })
      .subscribe();

    const fallbackPoller = setInterval(async () => {
      const { data } = await supabase.from('events').select('status').eq('id', id).single();
      if (data && data.status === 'live') {
        navigate(`/live/${id}`);
      }
    }, 5000);

    // 2. Setup Presence Channel
    const room = supabase.channel(`lobby-${id}`, {
      config: { presence: { key: user.id } }
    });

    room.on('presence', { event: 'sync' }, () => {
      const state = room.presenceState();
      setLiveCount(Object.keys(state).length);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await room.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(room);
      clearInterval(fallbackPoller);
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


  if (loading || !eventData) return <div className="flex justify-center p-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-6xl mx-auto pb-16">
      
      {/* Sponsor Banner */}
      {eventData.sponsor_logo_url && (
        <div className="w-full h-24 mb-6 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest mr-4">Sponsored By</p>
          <img src={eventData.sponsor_logo_url} alt="Sponsor" className="max-h-12 object-contain grayscale-[0.5] hover:grayscale-0 transition-all opacity-80 hover:opacity-100" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Action Area */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden relative">
            <div className="absolute inset-0 bg-blue-500/5 pulse-bg"></div>
            
            <div className="p-10 flex flex-col items-center justify-center text-center border-b border-white/5 relative z-10">
              <span className="px-3 py-1 text-xs rounded-full font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 mb-4 inline-block border border-blue-500/30">
                {eventData.type.replace('_', ' ')}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-8">
                {eventData.title}
              </h1>

              <div className="bg-slate-900/80 backdrop-blur-sm px-8 py-6 rounded-2xl border border-slate-700 shadow-2xl mb-8 transform transition-transform hover:scale-105">
                <p className="text-sm text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4"/> Starts In
                </p>
                <div className="text-4xl md:text-5xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wider">
                  {timeLeft}
                </div>
              </div>

              <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 px-6 py-4 rounded-xl border border-emerald-500/20">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-lg tracking-wide uppercase">Waiting for Admin to launch...</span>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 flex justify-between items-center relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{liveCount} Online Now</p>
                  <p className="text-xs text-slate-400">Looking at this page</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{totalJoined} Registered</p>
                  <p className="text-xs text-slate-400">Total Participants</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400"/> Current Roster</h3>
              <div className="flex flex-wrap gap-2">
                {participants.map((u, i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0 group relative cursor-pointer hover:border-blue-500 transition-colors">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400 uppercase">{u.name?.charAt(0)}</span>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                      {u.name}
                    </div>
                  </div>
                ))}
                {totalJoined > 20 && (
                  <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                    +{totalJoined - 20}
                  </div>
                )}
              </div>
            </div>

            {teams.length > 0 && (
              <div className="glass-card p-6">
                 <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-purple-400"/> Registered Teams</h3>
                 <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {teams.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <span className="text-sm font-bold text-slate-200">{t.name}</span>
                        <span className="text-xs font-medium bg-slate-800 px-2 py-1 rounded text-purple-300">
                          {t.team_members[0]?.count || 1} Members
                        </span>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Aside - Digital Ticket panel */}
        <div className="col-span-1">
          <div className="relative w-full max-w-sm mx-auto">
            {/* Pass cutout edges effect */}
            <div className="absolute left-[-15px] top-1/3 -mt-4 w-8 h-8 rounded-full bg-slate-950 z-20"></div>
            <div className="absolute right-[-15px] top-1/3 -mt-4 w-8 h-8 rounded-full bg-slate-950 z-20"></div>

            <div className="glass-card border border-slate-700 shadow-2xl relative z-10 flex flex-col items-center">
              <div className="w-full bg-gradient-to-br from-blue-900/80 to-slate-900 p-6 text-center border-b-[3px] border-dashed border-slate-950 rounded-t-xl">
                <h2 className="text-xl font-black text-white mb-1 uppercase tracking-wider">Your Ticket</h2>
                
                {ticket.teams ? (
                  <div className="mt-4 bg-slate-950/50 backdrop-blur-md px-4 py-2 rounded-lg border border-purple-500/30">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Team</p>
                    <p className="text-base font-bold text-purple-300 truncate">{ticket.teams.name}</p>
                  </div>
                ) : (
                  <div className="mt-4 bg-slate-950/50 backdrop-blur-md px-4 py-2 rounded-lg border border-blue-500/30">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Entry</p>
                    <p className="text-base font-bold text-blue-300">Solo Competitor</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-900/80 w-full p-8 flex flex-col items-center rounded-b-xl border-t border-white/5">
                <div className="bg-white p-3 rounded-xl shadow-lg mb-4">
                  <QRCodeSVG 
                    value={JSON.stringify({ pid: ticket.id, uid: user.id })} 
                    size={160}
                    level="L"
                    includeMargin={false}
                  />
                </div>
                
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Ticket ID</p>
                <p className="font-mono text-slate-300 tracking-wider font-medium mt-1 text-xs">{ticket.id.split('-')[0]}</p>
              </div>
            </div>
            
            <p className="text-center text-xs text-slate-500 mt-6 px-4">
              Do not close this page. You will be automatically teleported into the live arena when the event begins.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
