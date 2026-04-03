import { useState, useEffect, useCallback, useRef } from 'react';
import { Flame, AlertTriangle } from 'lucide-react';
import { serverNow } from '../../lib/supabase';

// Fix #2: Key includes userId + eventId + index + version suffix
// This prevents cross-event and cross-user timer restores.
// 'v2' suffix busts any pre-existing plain keys from earlier sessions.
const rfqKey = (userId, eventId, idx) =>
  `rfq_${userId ?? 'anon'}_${eventId}_${idx}_v2`;

export function RapidFireMode({ questions, answers, answerQuestion, onSubmit, isSubmitting, eventId, userId }) {
  // FIX #7: ALL hooks defined before any conditional return
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [streak, setStreak] = useState(0);

  // Fix #1+#2: Restore uses serverNow() and namespaced key
  const getRestoredTimeLeft = useCallback((idx, limit) => {
    if (!eventId) return limit;
    const startedAt = localStorage.getItem(rfqKey(userId, eventId, idx));
    if (!startedAt) return limit;
    // Fix #1: Use serverNow() so elapsed is server-adjusted, not raw client time
    const elapsed = Math.floor((serverNow() - parseInt(startedAt, 10)) / 1000);
    return Math.max(0, limit - elapsed);
  }, [eventId, userId]);

  // Fix #2: Persist with namespaced key (userId + eventId) + Fix #1: use serverNow()
  const persistQuestionStart = useCallback((idx) => {
    if (eventId) {
      localStorage.setItem(rfqKey(userId, eventId, idx), serverNow().toString());
    }
  }, [eventId, userId]);

  // FIX #9: Reset timeLeft inside advance() — with server-start persistence
  const advance = useCallback((idx, qs) => {
    if (idx + 1 < qs.length) {
      const nextIdx = idx + 1;
      const limit = qs[nextIdx].time_limit_seconds || 15;
      persistQuestionStart(nextIdx);
      setCurrentIndex(nextIdx);
      setTimeLeft(limit); // new question → full time
    } else {
      setTimeout(() => onSubmit(), 0);
    }
  }, [onSubmit, persistQuestionStart]);

  // Restore state to first unanswered question on mount
  useEffect(() => {
    if (!questions || questions.length === 0) return;

    let firstUnanswered = 0;
    while (firstUnanswered < questions.length && answers[questions[firstUnanswered]?.id]) {
      firstUnanswered++;
    }
    if (firstUnanswered < questions.length) {
      const limit = questions[firstUnanswered].time_limit_seconds || 15;
      // Fix #2: check namespaced key
      const restored = getRestoredTimeLeft(firstUnanswered, limit);
      setCurrentIndex(firstUnanswered);
      setTimeLeft(restored > 0 ? restored : limit);
      if (eventId && !localStorage.getItem(rfqKey(userId, eventId, firstUnanswered))) {
        persistQuestionStart(firstUnanswered);
      }
    } else {
      // FIX #8: All answered — defer submit past render cycle
      setTimeout(() => onSubmit(), 0);
    }
    // eslint-disable-next-line
  }, []);

  const handleTimeout = useCallback(() => {
    setStreak(0);
    setCurrentIndex(prev => {
      advance(prev, questions);
      return prev;
    });
  }, [advance, questions]);

  // Timer effect — reads timeLeft, triggers handleTimeout at 0
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, questions, handleTimeout]);

  // FIX #7: Guard moved below all hooks
  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 animate-pulse" />
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">No Questions Yet</h2>
        <p className="text-slate-400 max-w-md">The admin hasn't assigned any questions to this event.</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const handleSelect = (option) => {
    if (!currentQ?.question_bank) return;
    answerQuestion(currentQ.id, option);

    if (option === currentQ.question_bank.correct_answer) {
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }

    advance(currentIndex, questions);
  };

  if (!currentQ || !currentQ.question_bank) {
    return <div className="text-center p-20 text-xl font-bold text-white animate-pulse">Calculating Results...</div>;
  }

  const timeLimit = currentQ.time_limit_seconds || 15;
  const timeFraction = timeLeft / timeLimit;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 pt-16">
      
      {/* Header HUD */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
          <span className="text-slate-400 font-bold">Q {currentIndex + 1}</span>
          <span className="text-slate-600">/ {questions.length}</span>
        </div>
        
        {streak > 1 && (
          <div className="flex items-center gap-2 bg-orange-500/20 text-orange-500 px-4 py-1.5 rounded-full border border-orange-500/50 animate-pulse">
            <Flame className="w-5 h-5"/>
            <span className="font-bold">{streak} Streak!</span>
          </div>
        )}

        {/* B/D: Timer ring — colour reflects urgency */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-mono font-black text-2xl border-4 transition-colors ${
          timeLeft <= 5 ? 'text-red-500 border-red-500 animate-pulse' :
          timeLeft <= 10 ? 'text-amber-400 border-amber-400' :
          'text-blue-400 border-blue-500'
        }`}>
          {timeLeft}
        </div>
      </div>

      {/* B: Server-derived time progress bar */}
      <div className="w-full bg-slate-900 h-1 rounded-full mb-6 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${timeFraction * 100}%` }}
        />
      </div>

      <div className="glass-card p-10 transform transition-all duration-300">
        <h2 className="text-3xl font-extrabold text-white text-center mb-10 leading-tight">
          {currentQ.question_bank?.question}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(currentQ.question_bank?.options || []).map((opt, i) => (
            <button 
              key={i} 
              onClick={() => handleSelect(opt)}
              className="p-6 rounded-xl bg-slate-800/80 hover:bg-blue-600 border border-slate-700 hover:border-blue-400 text-left font-semibold text-slate-200 text-lg transition-all active:scale-95"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      
      {/* Overall Progress Bar */}
      <div className="w-full bg-slate-900 h-2 rounded-full mt-12 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" 
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        />
      </div>

    </div>
  );
}
