import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { NoticeCard } from '../../components/ece/NoticeCard';
import { Loader2, Bell, AlertTriangle } from 'lucide-react';

export function EceNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    supabase
      .from('ece_notices')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setNotices(data || []);
        setLoading(false);
      });
  }, []);

  // Urgent notices pinned to top
  const urgent = notices.filter((n) => n.type === 'urgent');
  const nonUrgent = notices.filter((n) => n.type !== 'urgent');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Notice Board</h1>
          <p className="text-xs text-slate-500">Important announcements from the department</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active notices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Urgent at top */}
          {urgent.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Urgent</span>
              </div>
              {urgent.map((notice) => (
                <NoticeCard key={notice.id} notice={notice} />
              ))}
            </div>
          )}
          {/* Other notices */}
          {nonUrgent.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}
