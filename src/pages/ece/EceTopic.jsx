import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ResourceCard } from '../../components/ece/ResourceCard';
import { QuoteDisplay } from '../../components/ece/QuoteDisplay';
import { ArrowLeft, Loader2, BookOpen, Video, Briefcase, LayoutGrid } from 'lucide-react';

const TABS = [
  { key: 'all',    label: 'All',          icon: LayoutGrid },
  { key: 'pdf',    label: 'Notes / PDFs', icon: BookOpen },
  { key: 'video',  label: 'Videos',       icon: Video },
  { key: 'career', label: 'Career Paths', icon: Briefcase },
];

export function EceTopic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    Promise.all([
      supabase.from('ece_topics').select('*').eq('id', id).single(),
      supabase.from('ece_resources').select('*').eq('topic_id', id).order('order_num'),
    ]).then(([topicRes, resRes]) => {
      setTopic(topicRes.data);
      setResources(resRes.data || []);
      setLoading(false);
    });
  }, [id]);

  const filtered = activeTab === 'all'
    ? resources
    : resources.filter((r) => r.type === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Topic not found.</p>
        <button onClick={() => navigate('/ece')} className="mt-4 ece-btn-secondary">
          Back to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/ece')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to ECE Hub
      </button>

      {/* Topic header */}
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: `${topic.color || '#3b82f6'}12`,
          borderColor: `${topic.color || '#3b82f6'}33`,
        }}
      >
        <div className="flex items-center gap-4">
          {topic.icon_url ? (
            <img src={topic.icon_url} alt={topic.name} className="w-16 h-16 rounded-2xl object-contain" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
              style={{ background: topic.color || '#3b82f6' }}
            >
              {topic.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-white">{topic.name}</h1>
            {topic.description && (
              <p className="text-sm text-slate-400 mt-1">{topic.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">{resources.length} resources</p>
          </div>
        </div>
      </div>

      {/* Quote */}
      <QuoteDisplay showIcon={false} />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === 'all' ? resources.length : resources.filter((r) => r.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all
                ${activeTab === tab.key
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 border border-white/8 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Resources */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-400">
            {activeTab === 'all'
              ? 'Resources coming soon'
              : `No ${activeTab} resources yet`}
          </p>
          <p className="text-xs text-slate-600">
            {activeTab === 'all'
              ? 'Admin is preparing study materials for this topic.'
              : `Switch to "All" to see available resources.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}
