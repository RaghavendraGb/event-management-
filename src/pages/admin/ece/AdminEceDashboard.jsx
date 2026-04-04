import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Link } from 'react-router-dom';
import {
  Cpu, Image, Bell, HelpCircle, MessageSquare, Quote, Building2,
  BookOpen, LayoutDashboard, AlertCircle, Loader2, Plus
} from 'lucide-react';

export function AdminEceDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from('ece_topics').select('id', { count: 'exact', head: true }),
      supabase.from('ece_resources').select('id', { count: 'exact', head: true }),
      supabase.from('ece_gallery').select('id', { count: 'exact', head: true }),
      supabase.from('ece_notices').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('ece_doubts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
      supabase.from('ece_chat').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('ece_quotes').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]).then(([topics, resources, gallery, notices, doubts, chat, quotes]) => {
      setStats({
        topics: topics.count || 0,
        resources: resources.count || 0,
        gallery: gallery.count || 0,
        notices: notices.count || 0,
        doubts: doubts.count || 0,
        chatToday: chat.count || 0,
        quotes: quotes.count || 0,
      });
      setLoading(false);
    });
  }, []);

  const statCards = stats ? [
    { label: 'Topics', value: stats.topics, icon: Cpu, color: '#3b82f6', path: '/admin/ece/topics' },
    { label: 'Resources', value: stats.resources, icon: BookOpen, color: '#8b5cf6', path: '/admin/ece/resources' },
    { label: 'Gallery Photos', value: stats.gallery, icon: Image, color: '#ec4899', path: '/admin/ece/gallery' },
    { label: 'Active Notices', value: stats.notices, icon: Bell, color: '#f59e0b', path: '/admin/ece/notices' },
    { label: 'Unresolved Doubts', value: stats.doubts, icon: HelpCircle, color: stats.doubts > 0 ? '#ef4444' : '#10b981', path: '/admin/ece/doubts', alert: stats.doubts > 0 },
    { label: 'Chat Today', value: stats.chatToday, icon: MessageSquare, color: '#10b981', path: '/admin/ece/chat' },
    { label: 'Active Quotes', value: stats.quotes, icon: Quote, color: '#6366f1', path: '/admin/ece/quotes' },
  ] : [];

  const quickActions = [
    { label: 'Add Topic', path: '/admin/ece/topics', icon: Plus, color: '#3b82f6' },
    { label: 'Upload Photo', path: '/admin/ece/gallery', icon: Image, color: '#ec4899' },
    { label: 'Post Notice', path: '/admin/ece/notices', icon: Bell, color: '#f59e0b' },
    { label: 'View Doubts', path: '/admin/ece/doubts', icon: HelpCircle, color: stats?.doubts > 0 ? '#ef4444' : '#10b981' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">ECE Admin Dashboard</h1>
          <p className="text-xs text-slate-500">Overview of all ECE Hub statistics</p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  to={card.path}
                  className={`
                    p-4 rounded-2xl border transition-all hover:scale-[1.02]
                    ${card.alert ? 'border-red-500/30 bg-red-500/5' : 'border-white/8 bg-slate-900/60'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${card.color}22` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: card.color }} />
                    </div>
                    {card.alert && (
                      <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-2xl font-black text-white">{card.value}</p>
                  <p className="text-xs text-slate-500">{card.label}</p>
                </Link>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.path}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 bg-slate-900/60 hover:bg-slate-800 transition-all"
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: action.color }} />
                    <span className="text-sm font-semibold text-slate-200">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Admin nav links */}
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Manage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Topics & Mind Map', path: '/admin/ece/topics', icon: Cpu },
                { label: 'Resources (PDFs/Videos)', path: '/admin/ece/resources', icon: BookOpen },
                { label: 'Photo Gallery', path: '/admin/ece/gallery', icon: Image },
                { label: 'Notices', path: '/admin/ece/notices', icon: Bell },
                { label: 'Doubts', path: '/admin/ece/doubts', icon: HelpCircle },
                { label: 'Chat Monitor', path: '/admin/ece/chat', icon: MessageSquare },
                { label: 'Motivational Quotes', path: '/admin/ece/quotes', icon: Quote },
                { label: 'Organisation', path: '/admin/ece/organisation', icon: Building2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-slate-900/40 hover:bg-slate-800 hover:border-purple-500/30 transition-all"
                  >
                    <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
