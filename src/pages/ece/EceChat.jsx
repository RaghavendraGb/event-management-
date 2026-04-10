import { ChatBox } from '../../components/ece/ChatBox';
import { MessageSquare } from 'lucide-react';

export function EceChat() {
  return (
    <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6 flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3" style={{ padding: '8px 4px' }}>
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center" style={{ border: '1px solid rgba(16,185,129,0.24)' }}>
          <MessageSquare className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Community Chat</h1>
          <p className="text-xs text-slate-500">Fast messaging for all ECE students</p>
        </div>
      </div>

      {/* Chat */}
      <ChatBox />
    </div>
  );
}
