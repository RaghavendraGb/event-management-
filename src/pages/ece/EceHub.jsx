import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TerminalAnimation } from '../../components/ece/TerminalAnimation';
import { MindMap } from '../../components/ece/MindMap';
import { QuoteDisplay } from '../../components/ece/QuoteDisplay';
import { Link } from 'react-router-dom';
import { BookOpen, Image, Bell, MessageSquare, HelpCircle, Building2, ChevronRight } from 'lucide-react';

const quickLinks = [
  { label: 'Gallery', path: '/ece/gallery', icon: Image, color: '#8b5cf6' },
  { label: 'Notices', path: '/ece/notices', icon: Bell, color: '#f59e0b' },
  { label: 'Community Chat', path: '/ece/chat', icon: MessageSquare, color: '#10b981' },
  { label: 'Ask a Doubt', path: '/ece/doubts', icon: HelpCircle, color: '#3b82f6' },
  { label: 'Organisation', path: '/ece/organisation', icon: Building2, color: '#ec4899' },
];

export function EceHub() {
  const [showHub, setShowHub] = useState(false);
  const [topics, setTopics] = useState([]);
  const [fadeIn, setFadeIn] = useState(false);

  // Check if animation was already played
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceReset = params.get('reset') === '1';
    if (forceReset) {
      localStorage.removeItem('ece-animation-done');
    }
    const done = localStorage.getItem('ece-animation-done');
    if (done && !forceReset) {
      setShowHub(true);
      setFadeIn(true);
    }
  }, []);

  // Pre-fetch topics immediately (runs during animation, data ready by ENTER)
  useEffect(() => {
    supabase
      .from('ece_topics')
      .select('*')
      .order('order_num')
      .then(({ data }) => setTopics(data || []));
  }, []); // Empty dependency — runs once on mount, before animation ends

  const handleAnimationComplete = () => {
    setShowHub(true);
    setTimeout(() => setFadeIn(true), 50);
  };

  if (!showHub) {
    return <TerminalAnimation onComplete={handleAnimationComplete} />;
  }

  return (
    <div
      className="ece-hub-page"
      style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.6s ease' }}
    >
      {/* Hero header */}
      <div className="ece-hub-hero">
        <div className="ece-hub-badge">
          <span className="ece-hub-badge-dot" />
          Embedded Systems Resource Hub
        </div>
        <h1 className="ece-hub-title">
          ECE <span className="text-blue-400">Hub</span>
        </h1>
        <p className="ece-hub-subtitle">
          East Point College of Engineering and Technology
          <br />
          <span className="text-slate-500">Department of Electronics and Communication Engineering</span>
        </p>
      </div>

      {/* Quote display */}
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <QuoteDisplay />
      </div>

      {/* Mind Map */}
      <div className="max-w-4xl mx-auto px-4 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center mb-4">
          Explore Topics
        </h2>
        <div className="bg-slate-900/60 border border-white/8 rounded-3xl p-4 backdrop-blur-sm">
          <MindMap topics={topics} />
        </div>
      </div>

      {/* Quick links */}
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/8 bg-slate-900/60 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${link.color}22` }}
                >
                  <Icon className="w-5 h-5" style={{ color: link.color }} />
                </div>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors text-center">
                  {link.label}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
