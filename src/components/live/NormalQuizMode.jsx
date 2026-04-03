import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export function NormalQuizMode({ questions, answers, answerQuestion, onSubmit, isSubmitting }) {
  const isReadyToSubmit = Object.keys(answers).length > 0;

  // F: Internal submit lock — prevents double-click between state re-renders
  const submitLockedRef = useRef(false);

  // Reset lock when isSubmitting resets (e.g. on unmount/retry)
  useEffect(() => {
    if (!isSubmitting) submitLockedRef.current = false;
  }, [isSubmitting]);

  const handleSubmit = () => {
    // F: Ref-based lock catches clicks that slip in before React re-render
    if (submitLockedRef.current || isSubmitting) return;
    submitLockedRef.current = true;
    onSubmit();
  };

  // Guard: no questions assigned
  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 animate-pulse" />
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">No Questions Yet</h2>
        <p className="text-slate-400 max-w-md">The admin hasn't assigned any questions to this event. Please wait or contact the organizer.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 pt-8 px-4">
      {questions.map((q, index) => {
        if (!q.question_bank) return null;

        const selectedOption = answers[q.id];
        return (
          <div key={q.id} className="glass-card p-8">
            <div className="flex gap-4 mb-6">
              <div className="w-10 h-10 shrink-0 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                {index + 1}
              </div>
              <h2 className="text-xl font-medium text-white pt-1">{q.question_bank?.question}</h2>
            </div>

            <div className="space-y-3 pl-14">
              {(q.question_bank?.options || []).map((opt, i) => (
                <label 
                  key={i} 
                  onClick={() => answerQuestion(q.id, opt)}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedOption === opt 
                      ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]' 
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === opt ? 'border-blue-500' : 'border-slate-500'
                  }`}>
                    {selectedOption === opt && <div className="w-2.5 h-2.5 bg-blue-400 rounded-full"></div>}
                  </div>
                  <span className="text-slate-200">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 p-4 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-4">
          <div className="text-slate-400 font-medium">
            Answered: <span className="text-white font-bold">{Object.keys(answers).length}</span> / {questions.length}
          </div>
          {/* F: onClick uses handleSubmit with ref-lock, disabled still applies for UX */}
          <button 
            disabled={!isReadyToSubmit || isSubmitting || submitLockedRef.current}
            onClick={handleSubmit}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:shadow-none"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
