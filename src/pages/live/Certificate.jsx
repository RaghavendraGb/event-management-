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

      // Zentrix Header
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text("ZENTRIX PLATFORM", 400, 80, { align: 'center' });

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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div style={{ width: 40, height: 40, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
  if (!data) return <div style={{ textAlign: 'center', color: 'var(--red)', padding: '80px 16px', fontWeight: 600 }}>You did not participate in this event.</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Your Certificate</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cryptographic proof of participation for your portfolio.</p>
      </div>

      <div style={data.isWinner
        ? { background: 'var(--surface)', border: '1px solid rgba(245,158,11,0.35)', borderLeft: '4px solid #f59e0b', borderRadius: 8, overflow: 'hidden' }
        : { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }
      }>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: data.isWinner ? 'rgba(245,158,11,0.12)' : 'var(--elevated)', border: `1px solid ${data.isWinner ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={20} style={{ color: data.isWinner ? '#f59e0b' : 'var(--text-muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {data.isWinner ? 'Certificate of Excellence' : 'Certificate of Participation'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'var(--elevated)', color: 'var(--text-muted)' }}>Rank #{data.rank}</span>
                <span className="badge" style={{ background: 'var(--elevated)', color: 'var(--text-muted)' }}>Score {data.score}</span>
              </div>
            </div>
          </div>
          <button onClick={generatePDF} disabled={generating} className={generating ? 'btn-ghost' : 'btn-primary'} style={{ flexShrink: 0 }}>
            <DownloadCloud size={15} /> {generating ? 'Generating...' : 'Download Certificate'}
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ShieldCheck size={14} style={{ color: 'var(--green)' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cryptographically Verified</p>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 560, marginBottom: 16 }}>
            When generated, this document receives a unique hash stored in the Zentrix registry. Anyone can verify its authenticity using the certificate ID.
          </p>
          {existingCert && (
            <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'inline-flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Certificate ID</p>
                <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--green)', letterSpacing: '0.05em' }}>{existingCert.cert_uid.split('-').pop()}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/verify/${existingCert.cert_uid}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', minHeight: 'unset', ...(copied ? { color: 'var(--green)' } : {}) }}>
                  {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? 'Copied!' : 'Copy Link'}
                </button>
                {typeof navigator.share === 'function' && (
                  <button onClick={() => navigator.share({ title: `My Zentrix Certificate`, text: `Certificate from ${data?.event?.title}!`, url: `${window.location.origin}/verify/${existingCert.cert_uid}` })} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px', minHeight: 'unset' }}>
                    <Share2 size={13} /> Share
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
