import { useParams, Link } from 'react-router-dom';
import { LiveLeaderboard } from '../components/live/LiveLeaderboard';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function Leaderboard() {
  const { id } = useParams();
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    supabase.from('events').select('title, type, status, sponsor_logo_url').eq('id', id).single().then(({ data }) => {
      setEventData(data);
    });
  }, [id]);

  if (!eventData) return <div className="text-center p-20 text-white font-bold animate-pulse">Initializing Board...</div>;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Background Visuals for Projector Scale */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      
      {/* Cinematic Header */}
      <div className="p-8 border-b border-white/10 bg-slate-900/50 backdrop-blur-md flex justify-between items-center z-10 shrink-0 shadow-2xl">
        <div>
          <Link to={`/events/${id}`} className="text-blue-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-4 transition-colors">
             <ArrowLeft className="w-4 h-4" /> Back to Event Info
          </Link>
          <div className="flex items-center gap-4">
             <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
               {eventData.title}
             </h1>
             <span className={`px-4 py-2 text-sm rounded-full font-black uppercase tracking-widest border shadow-lg ${
                eventData.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 animate-pulse' : 
                eventData.status === 'ended' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
             }`}>
               {eventData.status}
             </span>
          </div>
        </div>
        
        {eventData.sponsor_logo_url && (
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs text-slate-500 uppercase tracking-[0.2em] font-black mb-2">Powered By</span>
            <img src={eventData.sponsor_logo_url} alt="Sponsor" className="h-16 object-contain" />
          </div>
        )}
      </div>

      {/* Main Board Space */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 z-10">
        <div className="bg-slate-950/80 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] h-full overflow-hidden">
           <LiveLeaderboard eventId={id} currentUserId={null} limit={20} isProjector={true} />
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="text-center py-4 text-slate-600 font-bold tracking-widest uppercase text-xs">
        Powered by EventX Engine
      </div>
    </div>
  );
}
