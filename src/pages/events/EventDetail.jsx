import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { Users, Info, ArrowRight, KeyRound } from 'lucide-react';

export function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [team, setTeam] = useState(null); // The team they are in, if any
  
  // Registration Modals State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMode, setJoinMode] = useState('solo'); // 'solo', 'create_team', 'join_team'
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      const { data: evt } = await supabase.from('events').select('*').eq('id', id).single();
      if (evt) setEvent(evt);
      
      if (user && evt) {
        // Fetch participation info + linked team info in one query
        const { data: participation } = await supabase
          .from('participation')
          .select('id, team_id, teams(name, invite_code)')
          .eq('user_id', user.id)
          .eq('event_id', evt.id)
          .maybeSingle(); 
          
        if (participation) {
          setIsRegistered(true);
          if (participation.teams) {
            setTeam(participation.teams);
          }
        }
      }
      setLoading(false);
    }
    fetchDetails();
  }, [id, user]);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: `/events/${id}` } });
    
    setSubmitting(true);
    let finalTeamId = null;

    try {
      if (joinMode === 'create_team') {
        const code = generateCode();
        const { data: newTeam, error: teamErr } = await supabase.from('teams').insert([{
          name: teamName,
          event_id: event.id,
          invite_code: code,
          created_by: user.id
        }]).select().single();
        
        if (teamErr) throw teamErr;
        finalTeamId = newTeam.id;

        // Add creator to team_members
        await supabase.from('team_members').insert([{
          team_id: finalTeamId,
          user_id: user.id
        }]);

      } else if (joinMode === 'join_team') {
        // Look up team by code
        const { data: foundTeam, error: findErr } = await supabase
          .from('teams')
          .select('id')
          .eq('invite_code', inviteCode)
          .eq('event_id', event.id)
          .single();
          
        if (findErr || !foundTeam) throw new Error("Invalid Invite Code for this event!");
        finalTeamId = foundTeam.id;

        // Add to team members
        await supabase.from('team_members').insert([{
          team_id: finalTeamId,
          user_id: user.id
        }]);
      }

      // Finally, insert participation logic (applies to solo and team)
      const { error: partErr } = await supabase.from('participation').insert([{
        user_id: user.id,
        event_id: event.id,
        team_id: finalTeamId,
        status: 'registered'
      }]);

      if (partErr) throw partErr;

      // SUCCESS! Redirect physically to lobby ticket
      navigate(`/lobby/${event.id}`);

    } catch (err) {
      alert(err.message);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="text-center py-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto"></div></div>;
  if (!event) return <div className="text-center py-20 text-xl font-medium">Event not found.</div>;

  const isLive = event.status === 'live';

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="glass-card overflow-hidden">
        {/* Banner */}
        <div className={`h-48 relative flex items-end p-8 ${isLive ? 'bg-gradient-to-r from-emerald-900 to-slate-900 border-b border-emerald-500/30' : 'bg-gradient-to-r from-blue-900 to-slate-900 border-b border-blue-500/30'}`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <div className="relative z-10 w-full flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wider ${
                    isLive ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                    event.status === 'upcoming' ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'
                  }`}>
                  {event.status}
                </span>
                <span className="text-xs text-blue-200 font-bold uppercase tracking-widest bg-blue-950/80 px-3 py-1 rounded border border-blue-400/30">
                  {event.type.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-5xl font-extrabold text-white tracking-tight">{event.title}</h1>
            </div>
            
            {/* Action Area Right */}
            <div className="pb-1">
              {isRegistered ? (
                <button 
                  onClick={() => navigate(`/lobby/${event.id}`)}
                  className="px-8 py-3.5 bg-white text-slate-900 hover:bg-slate-200 font-extrabold rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 transition-all text-center flex items-center gap-2"
                >
                  {isLive ? 'Enter Live Event' : 'View Ticket / Lobby'} <ArrowRight className="w-5 h-5"/>
                </button>
              ) : (
                <button 
                  onClick={() => setShowJoinModal(true)}
                  disabled={event.status === 'ended'}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 hover:scale-105 transition-all"
                >
                  {event.status === 'ended' ? 'Event Ended' : 'Register Now'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Content Body */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-10 bg-slate-950/50">
          <div className="col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Info className="w-5 h-5 text-blue-500"/> About The Event</h2>
              <div className="text-slate-300 leading-relaxed bg-slate-900/50 p-6 rounded-xl border border-white/5">
                {event.description || 'No description provided by the organizers.'}
              </div>
            </section>

            {isRegistered && team && (
              <section className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Users className="w-5 h-5 text-purple-400"/> Your Team</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-extrabold text-purple-100">{team.name}</p>
                    <p className="text-sm text-purple-300/70">Invite your friends to register via the invite code.</p>
                  </div>
                  <div className="bg-slate-950 px-4 py-2 rounded-lg border border-purple-500/50 flex flex-col items-center">
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Invite Code</span>
                    <span className="text-2xl font-mono text-purple-400 tracking-widest font-bold">{team.invite_code}</span>
                  </div>
                </div>
              </section>
            )}
          </div>
          
          <div className="col-span-1 space-y-6">
            <div className="bg-slate-900 rounded-xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-6 border-b border-white/10 pb-3">Event Schedule</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Starts At</p>
                  <p className="font-medium text-slate-200">{new Date(event.start_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Ends At</p>
                  <p className="font-medium text-slate-200">{new Date(event.end_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Max Participants</p>
                  <p className="font-medium text-slate-200">{event.max_participants ? `${event.max_participants} Limit` : 'Unlimited Space'}</p>
                </div>
              </div>
              <Link to={`/leaderboard/${event.id}`} className="mt-8 block w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-lg text-center transition-colors border border-white/5">
                View Global Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Modal Workflow */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-8 border border-blue-500/30">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-extrabold text-white">Join Event</h2>
              <button onClick={() => setShowJoinModal(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleRegistrationSubmit}>
              {/* Type Selection */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <button type="button" onClick={() => setJoinMode('solo')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${joinMode === 'solo' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  <Users className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Solo</span>
                </button>
                <button type="button" onClick={() => setJoinMode('create_team')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${joinMode === 'create_team' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  <Users className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">Create<br/>Team</span>
                </button>
                <button type="button" onClick={() => setJoinMode('join_team')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${joinMode === 'join_team' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  <KeyRound className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">Join<br/>Team</span>
                </button>
              </div>

              {/* Dynamic Inputs */}
              <div className="mb-8 min-h-[80px]">
                {joinMode === 'solo' && (
                  <p className="text-slate-300 text-center text-sm px-4">You will compete as an individual. Your score will be tracked under your own name globally.</p>
                )}
                {joinMode === 'create_team' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">Team Name</label>
                    <input autoFocus required placeholder="e.g. The Codebreakers" value={teamName} onChange={e=>setTeamName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors shadow-inner" />
                  </div>
                )}
                {joinMode === 'join_team' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">6-Digit Invite Code</label>
                    <input autoFocus required minLength={6} maxLength={6} placeholder="XXXXXX" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white uppercase text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-purple-500 transition-colors shadow-inner" />
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} className={`w-full py-4 rounded-xl text-white font-extrabold uppercase tracking-widest transition-all shadow-lg text-sm ${submitting ? 'opacity-50 cursor-not-allowed bg-slate-700' : joinMode === 'create_team' ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/25' : joinMode === 'join_team' ? 'bg-purple-600 hover:bg-purple-500 hover:shadow-purple-500/25' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25'}`}>
                {submitting ? 'Confirming...' : 'Confirm Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
