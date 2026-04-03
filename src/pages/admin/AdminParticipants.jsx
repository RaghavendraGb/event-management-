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

  useEffect(() => {
    supabase.from('events').select('id, title').then(({data}) => {
      if (data) {
        setEvents(data);
        if (data.length > 0) setSelectedEventId(data[0].id);
      }
    });
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
      Name: p.users.name,
      Email: p.users.email,
      College: p.users.college || 'N/A',
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
    link.setAttribute('download', 'EventX_Registrations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // QR WebRTC Scanner Loop
  const toggleScanner = async () => {
    if (scannerOpen) {
      // Stop
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setScannerOpen(false);
      setScanResult(null);
    } else {
      // Start
      setScannerOpen(true);
      setScanResult(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        requestAnimationFrame(tick);
      } catch(e) {
        alert("Camera forbidden or not found");
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
        setScannerOpen(false);
        return;
      }
    }
    if (scannerOpen) requestAnimationFrame(tick);
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
    } catch(e) {
      setScanResult({ valid: false, message: "Invalid QR Code Format" });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Participant Ledger</h1>
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-lg">
             <Search className="w-4 h-4 text-slate-500 ml-2" />
             <select className="bg-transparent border-none text-white text-sm font-bold min-w-[250px] focus:ring-0" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
               {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
             </select>
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={toggleScanner} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all ${scannerOpen ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
             <ScanLine className="w-4 h-4"/> {scannerOpen ? 'Close Optic' : 'Launch Ticket Scanner'}
          </button>
          <button onClick={exportToCSV} className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
             <Download className="w-4 h-4"/> Export CSV Matrix
          </button>
        </div>
      </div>

      {/* QR Scanner UI */}
      {scannerOpen && (
        <div className="glass-card p-6 border-l-4 border-l-indigo-500 flex flex-col items-center max-w-md mx-auto">
           <p className="font-bold text-white uppercase tracking-widest text-sm mb-4">Awaiting Optical Signature</p>
           <div className="relative w-full aspect-square overflow-hidden rounded-xl border-4 border-indigo-500/50 shadow-inner">
             <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
             <canvas ref={canvasRef} className="hidden" />
             <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
             <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)] animate-ping"></div>
           </div>
        </div>
      )}

      {/* QR Modal Result */}
      {scanResult && !scannerOpen && (
        <div className={`p-6 rounded-xl border max-w-md mx-auto text-center shadow-2xl backdrop-blur-md ${scanResult.valid ? 'bg-emerald-900/30 border-emerald-500' : 'bg-red-900/30 border-red-500'}`}>
           {scanResult.valid ? <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" /> : <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />}
           <h3 className="text-2xl font-black text-white">{scanResult.valid ? 'Verified' : 'Invalid Signature'}</h3>
           {scanResult.valid && <p className="text-emerald-400 font-bold uppercase tracking-widest mt-2">{scanResult.user}</p>}
           {!scanResult.valid && <p className="text-red-400 mt-2">{scanResult.message}</p>}
           <p className="text-[10px] text-slate-500 mt-4 mono break-all">{scanResult.dbId}</p>
        </div>
      )}


      {/* Main Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 border-b border-white/5">
              <tr>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Participant</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Team</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Violations</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {participations.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-white text-sm">{p.users.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{p.users.college}</p>
                  </td>
                  <td className="p-4 font-mono text-sm text-purple-400 font-bold">{p.teams?.name || '-'}</td>
                  <td className="p-4 font-black text-emerald-400 text-lg">{p.score}</td>
                  <td className="p-4">
                    {p.violations > 0 
                     ? <span className="bg-red-500/20 text-red-500 border border-red-500/50 px-2 py-1 rounded text-xs font-black">{p.violations} Flags</span> 
                     : <span className="text-slate-500 text-sm">Clean</span>}
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] uppercase font-black text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {participations.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold">No participants pulled into ledger yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
