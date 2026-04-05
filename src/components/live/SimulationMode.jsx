import { useState, useEffect } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadToCloudinary } from '../../lib/cloudinary';

export function SimulationMode({
  question,           // the full event_questions row with question_bank data joined
  user,               // user object from store { id, name, email }
  eventId,            // event UUID
  participationId,    // participation UUID
  onSimSubmitted,     // callback: called when screenshot is uploaded and submitted
  onNext,             // callback: called when user wants to move to next question
  isSubmitting,       // bool — prevents double submit
}) {
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [watermarkCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  });

  useEffect(() => {
    if (submitted) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'You are in an active simulation exam. Leaving will forfeit this question.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitted]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or WEBP image.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Screenshot must be under 5MB. Please compress or crop and try again.');
      return;
    }
    
    setScreenshotFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!screenshotFile || isUploading || submitted) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const { url: screenshotUrl, public_id: screenshotPublicId } = await uploadToCloudinary(
        screenshotFile,
        'simulation_screenshots',
        'image'
      );
      
      const { error } = await supabase.from('simulation_submissions').insert({
        event_id: eventId,
        user_id: user.id,
        question_id: question.question_bank.id,
        participation_id: participationId,
        screenshot_url: screenshotUrl,
        screenshot_public_id: screenshotPublicId,
        watermark_code: watermarkCode,
        status: 'pending',
        marks_awarded: 0,
      });
      
      if (error) {
        if (error.code === '23505') {
          setSubmitted(true);
          setIsUploading(false);
          onSimSubmitted?.();
          return;
        }
        throw new Error(error.message);
      }
      
      setSubmitted(true);
      setIsUploading(false);
      onSimSubmitted?.();
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      
    } catch (err) {
      setIsUploading(false);
      setUploadError(err.message || 'Upload failed. Please try again.');
      alert(err.message || 'Upload failed. Please try again.');
    }
  };

  return (
    <div className="px-4 pt-6 pb-32 max-w-5xl mx-auto">
      {/* Identity Overlay */}
      <div
        style={{
          position: 'fixed',
          top: '60px',
          right: '16px',
          zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(139, 92, 246, 0.5)',
          borderRadius: '8px',
          padding: '8px 12px',
          maxWidth: '260px',
          userSelect: 'none',
        }}
      >
        <p style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Identity Verified
        </p>
        <p style={{ fontSize: '12px', color: 'white', fontWeight: 600, marginBottom: '2px' }}>
          {user.name || user.email}
        </p>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>
          Code: <span style={{ fontFamily: 'monospace', color: '#c4b5fd', fontWeight: 700, letterSpacing: '0.1em' }}>{watermarkCode}</span>
        </p>
        <p style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
          Must appear in screenshot
        </p>
      </div>

      <div className="glass-card p-6 mb-6 border-l-4 border-l-violet-500">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-black text-violet-400 uppercase tracking-widest">Simulation Question</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
            {question.question_bank.sim_marks} marks
          </span>
        </div>
        <h2 className="text-xl font-black text-white mb-2">{question.question_bank.question}</h2>
      </div>

      <div className="glass-card p-5 mb-6 border border-amber-500/25 bg-amber-500/5">
        <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3">Read Before Starting</p>
        <ul className="space-y-2 text-sm text-slate-300 list-none">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0 mt-0.5">→</span>
            Do NOT leave this page. The simulation runs only inside this window.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0 mt-0.5">→</span>
            Your name and verification code must be visible in your screenshot.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0 mt-0.5">→</span>
            Cropped, blurred, or edited screenshots will be rejected.
          </li>
          {question.question_bank.sim_expected_output && (
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold shrink-0 mt-0.5">→</span>
              Your output must show exactly: <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded ml-1">{question.question_bank.sim_expected_output}</span>
            </li>
          )}
        </ul>
        
        {question.question_bank.sim_instructions && (
          <div className="mt-4 pt-4 border-t border-amber-500/15">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Task Instructions</p>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {question.question_bank.sim_instructions}
            </p>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Live Simulation</span>
          </div>
          <span className="text-[10px] text-slate-500">Powered by Wokwi — running inside this page</span>
        </div>
        <div className="relative" style={{ height: '520px' }}>
          <iframe
            src={question.question_bank.wokwi_url}
            width="100%"
            height="100%"
            style={{ border: 'none', display: 'block' }}
            title="Wokwi Circuit Simulator"
            allow="serial"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
          />
        </div>
      </div>

      <div className="glass-card p-6">
        <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Upload Screenshot</p>
        <p className="text-xs text-slate-400 mb-5">
          Take a full screenshot showing the simulation output AND the identity overlay in the top-right corner.
          Your verification code <span className="font-mono text-violet-400 font-bold">{watermarkCode}</span> must be visible.
        </p>
        
        {!screenshotFile && !isUploading && !submitted && (
          <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-300 font-medium">Click to select screenshot</p>
            <p className="text-xs text-slate-500">PNG, JPG, WEBP — max 5MB</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}
        
        {screenshotFile && !submitted && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              <img
                src={previewUrl}
                alt="Screenshot preview"
                className="w-full max-h-64 object-contain bg-slate-900"
              />
              {!isUploading && (
                <button
                  onClick={() => { setScreenshotFile(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            
            {isUploading && (
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                Uploading to secure server...
              </div>
            )}
            
            {!isUploading && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading || submitted}
                className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
              >
                Submit Screenshot for Review
              </button>
            )}
          </div>
        )}
        
        {submitted && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-lg font-black text-white">Screenshot Submitted!</p>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              Your screenshot has been received and is pending admin review. 
              Marks will be awarded once the admin approves your submission.
            </p>
            <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              Verification code: <span className="text-violet-400 font-bold">{watermarkCode}</span>
            </div>
            
            <button
              onClick={onNext}
              className="mt-6 px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all border border-slate-700"
            >
              Continue to Next Question →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
