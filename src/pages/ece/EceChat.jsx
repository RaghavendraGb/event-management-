import { ChatBox } from '../../components/ece/ChatBox';
import { MessageSquare } from 'lucide-react';

export function EceChat() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Community Chat</h1>
          <p className="text-xs text-slate-500">Real-time group chat for all students</p>
        </div>
      </div>

      {/* Chat */}
      <ChatBox />
    </div>
  );
}
