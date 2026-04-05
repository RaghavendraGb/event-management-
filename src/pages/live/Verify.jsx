import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, ShieldAlert, Award, CalendarDays, ExternalLink } from 'lucide-react';

export function Verify() {
  const { cert_uid } = useParams();
  
  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function verifyDoc() {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id, type, rank, issued_at, cert_uid, pdf_url,
          users (name, college),
          events (title, start_at)
        `)
        .eq('cert_uid', cert_uid)
        .single();

      if (error || !data) {
        setError(true);
      } else {
        setCertData(data);
      }
      setLoading(false);
    }
    
    if (cert_uid) verifyDoc();
  }, [cert_uid]);

  if (loading) return <div className="text-center p-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase">Document Verification</h1>
          <p className="text-slate-400 mt-2">Checking the global Zentrix cryptographic registry</p>
        </div>

        {error ? (
          <div className="glass-card p-12 text-center border-red-500/30">
            <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-white mb-4">Invalid Document</h2>
            <p className="text-slate-400 bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-sm max-w-md mx-auto">
              ID: {cert_uid}
            </p>
            <p className="text-red-400 mt-6 font-bold">This certificate ID does not exist in our database. It may be forged or entered incorrectly.</p>
          </div>
        ) : (
          <div className="glass-card border-none ring-2 ring-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-bl-xl shadow-lg">
              Verified Authentic
            </div>
            
            <div className="p-10 md:p-12 text-center border-b border-white/5 bg-gradient-to-b from-emerald-950/20 to-transparent">
              <ShieldCheck className="w-24 h-24 text-emerald-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <h2 className="text-4xl font-black text-white mb-2">{certData.users.name}</h2>
              {certData.users.college && <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">{certData.users.college}</p>}
              
              <div className="bg-slate-950/50 border border-emerald-500/20 rounded-2xl p-6 inline-flex flex-col items-center">
                <Award className={`w-8 h-8 mb-2 ${certData.type === 'winner' ? 'text-yellow-500' : 'text-blue-500'}`} />
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-1">Awarded Title</p>
                <p className={`text-xl font-black ${certData.type === 'winner' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {certData.type === 'winner' ? 'Certificate of Excellence' : 'Certificate of Participation'}
                </p>
                {certData.rank > 0 && <p className="text-sm font-bold text-slate-300 mt-2">Global Rank: #{certData.rank}</p>}
              </div>
            </div>

            <div className="p-8 bg-slate-900/80 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Event Competed In</p>
                <p className="text-slate-200 font-bold flex items-center gap-2"><Award className="w-4 h-4 text-emerald-500"/> {certData.events.title}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Issuance Date</p>
                <p className="text-slate-200 font-bold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-emerald-500"/> {new Date(certData.issued_at).toLocaleDateString()}</p>
              </div>
              <div className="md:col-span-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Cryptographic Hash ID</p>
                <p className="text-emerald-400 font-mono text-sm break-all">{certData.cert_uid}</p>
              </div>
            </div>

            {certData.pdf_url && (
              <div className="border-t border-white/5 p-6 text-center">
                <a href={certData.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest">
                  View Source Document <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-8">
          <Link to="/" className="text-sm font-bold text-slate-500 hover:text-white transition-colors">Return to Zentrix</Link>
        </div>
      </div>
    </div>
  );
}
