import { AlertTriangle, Info, BookOpen, FlaskConical, Calendar } from 'lucide-react';

const typeConfig = {
  urgent: { icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Urgent' },
  exam:   { icon: BookOpen,     color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Exam' },
  lab:    { icon: FlaskConical, color: '#8b5cf6', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Lab' },
  event:  { icon: Calendar,     color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Event' },
  info:   { icon: Info,         color: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Info' },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Single notice display card.
 * Props:
 *  - notice: { id, title, content, type, created_at, expires_at }
 */
export function NoticeCard({ notice }) {
  const config = typeConfig[notice.type] || typeConfig.info;
  const Icon = config.icon;
  const isUrgent = notice.type === 'urgent';

  return (
    <div
      className={`
        p-4 rounded-2xl border ${config.bg} ${config.border} transition-all
        ${isUrgent ? 'notice-urgent-pulse' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${config.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: `${config.color}22`, color: config.color }}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-slate-500">{formatDate(notice.created_at)}</span>
            {notice.expires_at && (
              <span className="text-[10px] text-slate-500">
                Expires: {formatDate(notice.expires_at)}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-100 leading-tight">{notice.title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
        </div>
      </div>
    </div>
  );
}
