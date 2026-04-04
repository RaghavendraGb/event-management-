import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import jsPDF from 'jspdf';
import { DownloadCloud, ShieldCheck, Award, Link2, Share2, Check } from 'lucide-react';

export function Certificate() {
  const { id } = useParams();
  const user = useStore((state) => state.user);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [existingCert, setExistingCert] = useState(null);
  // Feature 7
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      if (!user) return;
      
      const { data: eData } = await supabase.from('events').select('*').eq('id', id).single();
      
      const { data: participations } = await supabase
        .from('participation')
        .select('user_id, score, status')
        .eq('event_id', id)
        .order('score', { ascending: false });

      const index = participations?.findIndex(p => p.user_id === user.id);
      
      if (eData && index !== -1) {
         const myData = participations[index];
         const rank = index + 1;
         const isWinner = rank <= 3;
         
         setData({
           event: eData,
           rank,
           score: myData.score,
           isWinner
         });
      }

      // Check if we already minted one
      const { data: certData } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', id)
        .single();
        
      if (certData) setExistingCert(certData);
      
      setLoading(false);
    }
    init();
  }, [id, user]);

  const generatePDF = async () => {
    if (generating) return;
    setGenerating(true);

    try {
      let certRecord = existingCert;
      
      // 1. If not minted, Mint the record in Postgres to get a unique cert_uid
      if (!certRecord) {
        const { data: newCert, error } = await supabase.from('certificates').insert([{
           user_id: user.id,
           event_id: id,
           type: data.isWinner ? 'winner' : 'participation',
           rank: data.rank
        }]).select().single();
        
        if (error) throw error;
        certRecord = newCert;
        setExistingCert(newCert);
      }

      // 2. Generate PDF via jsPDF natively
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [800, 600]
      });

      // Background / Border
      doc.setFillColor(15, 23, 42); // slate-900 equivalent
      doc.rect(0, 0, 800, 600, 'F');
      
      doc.setDrawColor(
        data.isWinner ? 234 : 59,
        data.isWinner ? 179 : 130,
        data.isWinner ? 8 : 246
      ); // Gold for winner, Blue for participation
      doc.setLineWidth(10);
      doc.rect(20, 20, 760, 560);
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1);
      doc.rect(30, 30, 740, 540);

      // EventX Header
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text("EVENTX PLATFORM", 400, 80, { align: 'center' });

      // Title
      doc.setFontSize(48);
      doc.setTextColor(
        data.isWinner ? 234 : 96,
        data.isWinner ? 179 : 165,
        data.isWinner ? 8 : 250
      ); // Gold for winner, Purple-blue for participation
      doc.text(data.isWinner ? "CERTIFICATE OF EXCELLENCE" : "CERTIFICATE OF PARTICIPATION", 400, 150, { align: 'center' });
      
      // Body Body
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(200, 200, 200);
      doc.text("This certificate represents that", 400, 220, { align: 'center' });

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(40);
      doc.setTextColor(255, 255, 255);
      doc.text(user.name.toUpperCase(), 400, 270, { align: 'center' });

      // Context
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(200, 200, 200);
      
      let contextualText = '';
      if (data.isWinner) {
        contextualText = `achieved outstanding performance at Rank ${data.rank} in`;
      } else {
        contextualText = `has successfully participated in the event`;
      }

      doc.text(contextualText, 400, 320, { align: 'center' });
      
      // Event Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(59, 130, 246);
      doc.text(data.event.title.toUpperCase(), 400, 370, { align: 'center' });

      // Info Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(150, 150, 150);
      doc.text(`Score Achieved: ${data.score}`, 400, 410, { align: 'center' });
      doc.text(`Issued On: ${new Date().toLocaleDateString()}`, 400, 430, { align: 'center' });

      // Verification Tag
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.text(`Verify Authenticity at: ${window.location.origin}/verify/${certRecord.cert_uid}`, 400, 550, { align: 'center' });

      // 3. Save locally
      // FIX #18: use regex to replace ALL spaces (not just first) in filename
      doc.save(`${user.name.replace(/\s+/g, '_')}_Certificate.pdf`);

      // 4. Upload to Cloud (Best effort, fail silently if bucket misconfigured)
      try {
        const pdfBlob = doc.output('blob');
        const fileName = `${certRecord.cert_uid}.pdf`;
        
        await supabase.storage
          .from('certificates')
          .upload(fileName, pdfBlob, { upsert: true, contentType: 'application/pdf' });
          
        const { data: publicUrlData } = supabase.storage.from('certificates').getPublicUrl(fileName);
        
        if (publicUrlData?.publicUrl) {
           await supabase.from('certificates').update({ pdf_url: publicUrlData.publicUrl }).eq('id', certRecord.id);
        }
      } catch (err) {
        console.log("Storage upload failed - bucket 'certificates' might not exist or lacks public privileges.", err);
      }

    } catch (e) {
      alert("Error generating certificate: " + e.message);
    }
    setGenerating(false);
  };

  if (loading) return <div className="text-center p-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin mx-auto"></div></div>;
  if (!data) return <div className="text-center text-red-400 p-20 font-bold">You did not legally complete this event.</div>;

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-white mb-4">Your Accolades</h1>
        <p className="text-slate-400">Claim your cryptographic proof of participation for your portfolio.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className={`p-10 border-b border-white/10 ${data.isWinner ? 'bg-gradient-to-r from-yellow-900/30 to-slate-900' : 'bg-slate-900'}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-4 shadow-2xl ${
                data.isWinner ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <Award className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-1">{data.isWinner ? 'Certificate of Excellence' : 'Certificate of Participation'}</h2>
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <span className="text-sm font-bold text-slate-400">Rank #{data.rank}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="text-sm font-bold text-slate-400">Score {data.score}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={generatePDF}
              disabled={generating}
              className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all shadow-lg ${
                generating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 
                data.isWinner ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-950 shadow-yellow-500/25 block' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
              }`}
            >
              <DownloadCloud className="w-5 h-5"/> {generating ? 'Minting PDF...' : 'Download Document'}
            </button>

          </div>
        </div>

        <div className="p-10 bg-slate-950/50 flex flex-col md:flex-row items-start lg:items-center gap-6 justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500"/> Cryptographically Verified
            </h3>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              When generated, this document receives a unique hash injected into the EventX Postgres registry. Anyone can visit the verification portal and input your ID to mathematically prove its authenticity.
            </p>
          </div>
          
          {existingCert && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shrink-0 w-full md:w-auto text-center">
               <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-1">Your Certificate ID</p>
               <p className="font-mono text-emerald-400 text-sm tracking-wider">{existingCert.cert_uid.split('-').pop()}</p>

               {/* Feature 7: Copy Link + Share */}
               <div className="flex gap-2 mt-3 justify-center">
                 <button
                   onClick={async () => {
                     await navigator.clipboard.writeText(
                       `${window.location.origin}/verify/${existingCert.cert_uid}`
                     );
                     setCopied(true);
                     setTimeout(() => setCopied(false), 2000);
                   }}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-700"
                 >
                   {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
                   {copied ? 'Copied!' : 'Copy Link'}
                 </button>
                 {typeof navigator.share === 'function' && (
                   <button
                     onClick={() => navigator.share({
                       title: `My EventX Certificate — ${data?.event?.title}`,
                       text: `Check out my verified certificate from ${data?.event?.title}!`,
                       url: `${window.location.origin}/verify/${existingCert.cert_uid}`,
                     })}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
                   >
                     <Share2 className="w-3.5 h-3.5" /> Share
                   </button>
                 )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
