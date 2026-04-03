import { useState, useEffect, useRef } from 'react';
import { Map, AlertCircle, Key } from 'lucide-react';

export function TreasureHuntMode({ questions, answers, answerQuestion, onSubmit, isSubmitting }) {
  const [level, setLevel] = useState(0);
  const [wrongTries, setWrongTries] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const autoAdvanceRef = useRef(null);
  
  // Restore level from saved answers
  useEffect(() => {
    let solved = 0;
    for (const q of questions) {
      if (answers[q.id] === q.question_bank.correct_answer) {
        solved++;
      }
    }
    setLevel(solved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance to next level after 3 wrong tries
  useEffect(() => {
    if (wrongTries >= 3) {
      autoAdvanceRef.current = setTimeout(() => {
        setWrongTries(0);
        setSelectedOption('');
        setLevel(l => {
          const next = l + 1;
          if (next >= questions.length) {
            onSubmit();
          }
          return next;
        });
      }, 3000);
    }
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [wrongTries, questions.length, onSubmit]);

  const currentQ = questions[level];

  const handleCheck = () => {
    if (!selectedOption) return;

    if (selectedOption === currentQ.question_bank.correct_answer) {
      // Correct!
      answerQuestion(currentQ.id, selectedOption);
      setWrongTries(0);
      setSelectedOption('');
      
      if (level + 1 >= questions.length) {
        onSubmit();
      } else {
        setLevel(l => l + 1);
      }
    } else {
      // Wrong!
      setWrongTries(t => t + 1);
    }
  };

  if (!currentQ) return <div className="text-center p-20 text-white font-bold text-2xl animate-pulse">You discovered all secrets! Saving...</div>;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      
      {/* Map Header */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-full flex items-center justify-between mb-4">
          <span className="text-emerald-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <Map className="w-5 h-5"/> Area {level + 1}
          </span>
          <span className="text-slate-500 font-mono text-sm">{level} / {questions.length} Keys Found</span>
        </div>
        
        {/* Visual node progress */}
        <div className="w-full h-1 bg-slate-800 rounded flex justify-between items-center">
          {questions.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${
              i < level ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 
              i === level ? 'bg-blue-500 animate-ping' : 'bg-slate-700'
            }`} />
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden border border-emerald-500/20">
        
        <div className="bg-slate-900/50 p-8 border-b border-white/5">
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-4">Clue Found</p>
          <h2 className="text-2xl md:text-3xl font-serif italic text-white leading-relaxed">
            "{currentQ.question_bank.question}"
          </h2>
        </div>

        {wrongTries > 0 && currentQ.question_bank.explanation && (
          <div className="bg-amber-500/10 p-4 flex items-start gap-3 border-b border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-500 font-bold text-sm uppercase tracking-wider mb-1">Hint Unlocked</p>
              <p className="text-amber-200/80 text-sm">{currentQ.question_bank.explanation}</p>
            </div>
          </div>
        )}

        <div className="p-8 space-y-4">
          <p className="text-slate-400 text-sm mb-4">Choose your path carefully (Tries: {wrongTries}/3)</p>
          
          <div className="grid grid-cols-1 gap-3">
            {currentQ.question_bank.options.map((opt, i) => (
              <label 
                key={i} 
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedOption === opt 
                    ? 'bg-emerald-600/20 border-emerald-500' 
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                }`}
              >
                <input 
                  type="radio" 
                  name="treasure_opt" 
                  className="hidden" 
                  checked={selectedOption === opt}
                  onChange={() => setSelectedOption(opt)}
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedOption === opt ? 'border-emerald-500' : 'border-slate-500'
                }`}>
                  {selectedOption === opt && <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></div>}
                </div>
                <span className="text-slate-200">{opt}</span>
              </label>
            ))}
          </div>

          <button 
            onClick={handleCheck}
            disabled={!selectedOption || wrongTries >= 3}
            className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg uppercase tracking-widest rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2"
          >
             <Key className="w-5 h-5" /> Unleash Key 
          </button>
          
          {wrongTries >= 3 && (
             <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-center text-sm font-bold">
               You failed to unlock this path! (Max Tries Reached). Moving to next zone...
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
