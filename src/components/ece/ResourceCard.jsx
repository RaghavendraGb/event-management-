import { FileText, Video, Briefcase, ExternalLink, Play } from 'lucide-react';
import { YouTubePlayer } from './YouTubePlayer';

const typeConfig = {
  pdf: { icon: FileText, color: '#ef4444', label: 'PDF', bg: 'bg-red-500/10' },
  video: { icon: Video, color: '#8b5cf6', label: 'Video', bg: 'bg-purple-500/10' },
  career: { icon: Briefcase, color: '#f59e0b', label: 'Career Path', bg: 'bg-amber-500/10' },
  image: { icon: FileText, color: '#3b82f6', label: 'Image', bg: 'bg-blue-500/10' },
};

/**
 * Individual resource card for PDF/Video/Career Path.
 * Props:
 *  - resource: { id, type, title, description, url, youtube_id }
 */
export function ResourceCard({ resource }) {
  const config = typeConfig[resource.type] || typeConfig.pdf;
  const Icon = config.icon;

  if (resource.type === 'video' && resource.youtube_id) {
    return (
      <div className="resource-card">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
              style={{ background: `${config.color}22`, color: config.color }}
            >
              {config.label}
            </span>
            <h3 className="text-sm font-semibold text-slate-200 leading-tight">{resource.title}</h3>
            {resource.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{resource.description}</p>
            )}
          </div>
        </div>
        <YouTubePlayer youtubeId={resource.youtube_id} title={resource.title} />
      </div>
    );
  }

  if (resource.type === 'career') {
    return (
      <div className="resource-card">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
              style={{ background: `${config.color}22`, color: config.color }}
            >
              {config.label}
            </span>
            <h3 className="text-sm font-semibold text-slate-200">{resource.title}</h3>
            {resource.description && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{resource.description}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PDF / default
  return (
    <div className="resource-card">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
            style={{ background: `${config.color}22`, color: config.color }}
          >
            {config.label}
          </span>
          <h3 className="text-sm font-semibold text-slate-200">{resource.title}</h3>
          {resource.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{resource.description}</p>
          )}
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: `${config.color}22`,
                color: config.color,
                border: `1px solid ${config.color}44`,
              }}
            >
              <ExternalLink className="w-3 h-3" />
              View / Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
