import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import jsQR from 'jsqr';
import Papa from 'papaparse';
import { Download, ScanLine, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

export function AdminParticipants() {
  const [participations, setParticipations] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // FIX #19: mirror scannerOpen state in a ref so the rAF tick closure reads current value
  const scannerOpenRef = useRef(false);

  useEffect(() => {
    supabase.from('events').select('id, title').then(({data}) => {
      if (data) {
        setEvents(data);
        if (data.length > 0) setSelectedEventId(data[0].id);
      }
    });
  }, []);

  // FIX #20: cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      supabase.from('participation')
        .select(`
          id, score, status, violations, registered_at,
          users (name, email, college),
          teams (name)
        `)
        .eq('event_id', selectedEventId)
        .order('score', { ascending: false })
        .then(({ data }) => setParticipations(data || []));
    }
  }, [selectedEventId]);

  // CSV Export Native Blob Generation
  const exportToCSV = () => {
    if (participations.length === 0) return alert("Nothing to export");
    const formatted = participations.map(p => ({
      ID: p.id,
      // FIX #21: null-safe — p.users might be null for deleted users
      Name: p.users?.name ?? 'Unknown',
      Email: p.users?.email ?? 'Unknown',
      College: p.users?.college || 'N/A',
      Team: p.teams?.name || 'Solo',
      Score: p.score,
      AntiCheat_Violations: p.violations,
      Status: p.status,
      RegisteredAt: new Date(p.registered_at).toISOString()
    }));

    const csv = Papa.unparse(formatted);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Zentrix_Registrations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // QR WebRTC Scanner Loop
  const toggleScanner = async () => {
    if (scannerOpen) {
      // Stop
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      // FIX #19: update ref alongside state
      scannerOpenRef.current = false;
      setScannerOpen(false);
      setScanResult(null);
    } else {
      // Start
      // FIX #19: update ref alongside state
      scannerOpenRef.current = true;
      setScannerOpen(true);
      setScanResult(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        requestAnimationFrame(tick);
      } catch {
        alert("Camera forbidden or not found");
        scannerOpenRef.current = false;
        setScannerOpen(false);
      }
    }
  };

  const tick = () => {
    if (!videoRef.current) return;
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.height = videoRef.current.videoHeight;
      canvas.width = videoRef.current.videoWidth;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      
      if (code) {
        verifyQR(code.data);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        // FIX #19: update ref before state to stop rAF loop immediately
        scannerOpenRef.current = false;
        setScannerOpen(false);
        return;
      }
    }
    // FIX #19: read from ref (not stale state closure) to decide if loop continues
    if (scannerOpenRef.current) requestAnimationFrame(tick);
  };

  const verifyQR = (qrData) => {
    // Expected format: JSON string { pid: participationId, uid: userId }
    // (matching the QRCodeSVG value in Lobby.jsx)
    try {
      const parsed = JSON.parse(qrData);
      const { pid, uid } = parsed;
      if (!pid || !uid) throw new Error('Missing fields');

      const match = participations.find(p => p.id === pid);
      if (match) {
        // Double-check the uid matches the participation record
        setScanResult({ valid: true, user: match.users.name, dbId: match.id });
      } else {
        setScanResult({ valid: false, message: "Ticket ID not found in this event's ledger" });
      }
    } catch {
      setScanResult({ valid: false, message: "Invalid QR Code Format" });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Personnel Ledger</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Audit registrations, verify digital signatures, and export final participation matrices.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleScanner} className="btn-ghost" style={{ padding: '10px 20px', background: scannerOpen ? 'var(--blue)' : 'var(--elevated)', color: scannerOpen ? '#000' : 'var(--text-primary)' }}>
            <ScanLine size={16} /> {scannerOpen ? 'Disable Optic' : 'Ticket Scanner'}
          </button>
          <button onClick={exportToCSV} className="btn-primary" style={{ padding: '10px 20px', background: 'var(--green)', color: '#000' }}>
            <Download size={16} /> Export Matrix
          </button>
        </div>
      </div>

      {/* Event Selection & Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Select Deployment</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, padding: 0, width: '100%', outline: 'none' }}
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
            >
              {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{participations.length}</p>
          <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Records</p>
        </div>
      </div>

      {/* QR Scanner UI */}
      {scannerOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--blue)', borderRadius: 12, padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
           <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>Awaiting Digital Signature</p>
           <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: '#000' }}>
             <video ref={videoRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectCover: 'cover' }} />
             <canvas ref={canvasRef} style={{ display: 'none' }} />
             <div style={{ position: 'absolute', inset: 0, border: '40px solid rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
             <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--blue)', boxShadow: '0 0 10px var(--blue)', animation: 'scan 2s ease-in-out infinite' }} />
           </div>
           <style>{`
             @keyframes scan {
               0%, 100% { transform: translateY(-100px); opacity: 0; }
               50% { transform: translateY(100px); opacity: 1; }
             }
           `}</style>
        </div>
      )}

      {/* QR Modal Result */}
      {scanResult && !scannerOpen && (
        <div style={{
          background: scanResult.valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${scanResult.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 12, padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center'
        }}>
           <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
             {scanResult.valid ? <CheckCircle2 size={32} style={{ color: 'var(--green)' }} /> : <AlertCircle size={32} style={{ color: 'var(--red)' }} />}
           </div>
           <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
             {scanResult.valid ? 'Identity Verified' : 'Invalid Signature'}
           </h3>
           <p style={{ fontSize: 14, color: scanResult.valid ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: 8 }}>{scanResult.valid ? scanResult.user : scanResult.message}</p>
           <button onClick={() => setScanResult(null)} className="btn-ghost" style={{ marginTop: 24, fontSize: 11, padding: '8px 16px' }}>Acknowledge</button>
        </div>
      )}

      {/* Main Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Participant</th>
                <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entity / Team</th>
                <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Performance</th>
                <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security Flags</th>
                <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 13 }}>
              {participations.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.users?.name || 'Anonymous'}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.users?.email}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>{p.users?.college}</p>
                    <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', marginTop: 2 }}>{p.teams?.name || 'Individual'}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{p.score}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {p.violations > 0 ? (
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                        {p.violations} Security Violations
                      </span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verified Clean</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--elevated)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4 }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {participations.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No participant data synchronized for this deployment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
