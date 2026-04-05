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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ECE Hub Master</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Central management for all electronics engineering resources.</p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  to={card.path}
                  style={{
                    padding: 24,
                    background: 'var(--surface)',
                    border: card.alert ? '1px solid var(--red)' : '1px solid var(--border)',
                    borderRadius: 12,
                    textDecoration: 'none',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = card.alert ? 'var(--red)' : 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} style={{ color: card.color }} />
                    </div>
                    {card.alert && (
                      <AlertCircle size={16} style={{ color: 'var(--red)', animation: 'pulse 2s infinite' }} />
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{card.value}</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{card.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Quick Actions
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.path}
                    className="btn-ghost"
                    style={{ background: 'var(--elevated)', justifyContent: 'flex-start', padding: '12px 16px' }}
                  >
                    <Icon size={16} style={{ color: action.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Management Suite */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Management Suite
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[
                { label: 'Topics & Mind Map', path: '/admin/ece/topics', icon: Cpu },
                { label: 'Resources (PDFs/Videos)', path: '/admin/ece/resources', icon: BookOpen },
                { label: 'Photo Gallery', path: '/admin/ece/gallery', icon: Image },
                { label: 'Notices System', path: '/admin/ece/notices', icon: Bell },
                { label: 'Doubt Resolution', path: '/admin/ece/doubts', icon: HelpCircle },
                { label: 'Live Chat Monitor', path: '/admin/ece/chat', icon: MessageSquare },
                { label: 'Motivational Quotes', path: '/admin/ece/quotes', icon: Quote },
                { label: 'ECE Organisation', path: '/admin/ece/organisation', icon: Building2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="btn-ghost"
                    style={{ 
                      justifyContent: 'flex-start', 
                      padding: '16px 20px', 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)' 
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <Icon size={18} style={{ color: 'var(--blue)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
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
