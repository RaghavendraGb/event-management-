import { useState, useEffect, useCallback } from 'react';
import { Flame } from 'lucide-react';

export function RapidFireMode({ questions, answers, answerQuestion, onSubmit, isSubmitting }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [streak, setStreak] = useState(0);
  
  const currentQ = questions[currentIndex];
  
  // Find out how many they have actually answered (as rapid fire locks out going back)
  // To restore state, fast forward index to first unanswered question
  useEffect(() => {
    let firstUnanswered = 0;
    while (firstUnanswered < questions.length && answers[questions[firstUnanswered].id]) {
      // Calculate streak based on past answers immediately if restored
      const pastQ = questions[firstUnanswered];
      if (answers[pastQ.id] === pastQ.question_bank.correct_answer) {
         // This is technically impure here but fine for simple streak
      }
      firstUnanswered++;
    }
    if (firstUnanswered < questions.length) {
      setCurrentIndex(firstUnanswered);
      setTimeLeft(questions[firstUnanswered].time_limit_seconds || 15);
    } else {
      // Completed all questions
      onSubmit();
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!currentQ) return;
    
    // Internal 15s timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return currentQ.time_limit_seconds || 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, currentQ, handleTimeout]);

  const advance = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setTimeLeft(questions[currentIndex + 1].time_limit_seconds || 15);
    } else {
      onSubmit();
    }
  }, [currentIndex, questions, onSubmit]);

  const handleTimeout = useCallback(() => {
    // Break streak
    setStreak(0);
    // Move to next
    advance();
  }, [advance]);

  const handleSelect = (option) => {
    answerQuestion(currentQ.id, option);
    
    // Check if correct for streak visual
    if (option === currentQ.question_bank.correct_answer) {
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
    
    advance();
  };

  if (!currentQ) return <div className="text-center p-20 text-xl font-bold">Calculating Results...</div>;

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

        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-mono font-black text-2xl border-4 ${timeLeft <= 5 ? 'text-red-500 border-red-500 animate-pulse' : 'text-blue-400 border-blue-500'}`}>
          {timeLeft}
        </div>
      </div>

      <div className="glass-card p-10 transform transition-all duration-300">
        <h2 className="text-3xl font-extrabold text-white text-center mb-10 leading-tight">
          {currentQ.question_bank.question}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQ.question_bank.options.map((opt, i) => (
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
      
      {/* Progress Bar overall */}
      <div className="w-full bg-slate-900 h-2 rounded-full mt-12 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" 
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        />
      </div>

    </div>
  );
}
