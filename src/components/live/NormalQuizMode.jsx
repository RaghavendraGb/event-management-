import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ChevronRight, ChevronLeft, RotateCcw, CheckCircle2 } from 'lucide-react';

/**
 * NormalQuizMode — Feature 13
 * One question at a time with progress bar, review screen, then submit.
 * Props:
 *   - questions, answers, answerQuestion, onSubmit, isSubmitting
 *   - onQuestionChange(index) — called on advance so LiveBanner stays current
 */
export function NormalQuizMode({ questions, answers, answerQuestion, onSubmit, isSubmitting, onQuestionChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [advancing, setAdvancing] = useState(false);  // brief lock after selection
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewJumpTo, setReviewJumpTo] = useState(null); // null = no jump

  // F: Internal submit lock — prevents double-click between state re-renders
  const submitLockedRef = useRef(false);

  // Reset lock when isSubmitting resets (e.g. on unmount/retry)
  useEffect(() => {
    if (!isSubmitting) submitLockedRef.current = false;
  }, [isSubmitting]);

  // Sync displayed selection from answers when index changes
  useEffect(() => {
    const q = questions[currentIndex];
    setSelectedOption(q ? (answers[q.id] || null) : null);
  }, [currentIndex, questions, answers]);

  // Stable ref for onQuestionChange — avoids adding it to useEffect deps
  // (inline arrow props recreate on every parent render, causing infinite loops)
  const onQuestionChangeRef = useRef(onQuestionChange);
  useEffect(() => { onQuestionChangeRef.current = onQuestionChange; }); // sync ref without triggering effect

  // Notify parent of question advances for LiveBanner
  useEffect(() => {
    onQuestionChangeRef.current?.(currentIndex);
  }, [currentIndex]); // intentionally ONLY depends on currentIndex

  // After jumping from review screen
  useEffect(() => {
    if (reviewJumpTo !== null) {
      setCurrentIndex(reviewJumpTo);
      setReviewMode(false);
      setReviewJumpTo(null);
    }
  }, [reviewJumpTo]);

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

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === total - 1;
  const currentQ = questions[currentIndex];

  // Defensive data accessors — handle both data shapes:
  // Shape A (from event_questions join): { id, question_bank: { question, options, ... } }
  // Shape B (flat, from some query paths): { id, question, options, ... }
  const getQuestionText = (q) =>
    q?.question_bank?.question ?? q?.question ?? '';
  const getOptions = (q) => {
    const opts = q?.question_bank?.options ?? q?.options;
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try { return JSON.parse(opts); } catch { return []; }
    }
    return [];
  };

  const handleOptionClick = (opt) => {
    if (advancing) return;
    setSelectedOption(opt);
    answerQuestion(currentQ.id, opt);
    // No auto-advance: user sees their selection and clicks Next themselves
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex(idx => idx - 1);
  };

  const handleNext = () => {
    if (isLast) {
      setReviewMode(true);
    } else {
      setCurrentIndex(idx => idx + 1);
    }
  };

  const handleSubmit = () => {
    if (submitLockedRef.current || isSubmitting) return;
    submitLockedRef.current = true;
    onSubmit();
  };

  // ── Review Screen ────────────────────────────────────────────
  if (reviewMode) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-32 space-y-4">
        <div className="glass-card p-6 border-blue-500/30 border">
          <h2 className="text-xl font-black text-white mb-1">Review Your Answers</h2>
          <p className="text-sm text-slate-400 mb-6">
            {answeredCount}/{total} answered. Click any question to change your answer.
          </p>

          <div className="space-y-2">
            {questions.map((q, i) => {
              const myAnswer = answers[q.id];
              const answered = !!myAnswer;
              return (
                <button
                  key={q.id}
                  onClick={() => setReviewJumpTo(i)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    answered
                      ? 'bg-emerald-900/10 border-emerald-500/20 hover:border-emerald-500/40'
                      : 'bg-amber-900/10 border-amber-500/20 hover:border-amber-500/40'
                  }`}
                >
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${
                    answered ? 'bg-emerald-600 text-white' : 'bg-amber-600/30 text-amber-400 border border-amber-500/40'
                  }`}>
                    {answered ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{getQuestionText(q)}</p>
                    {answered
                      ? <p className="text-xs text-emerald-400 truncate mt-0.5">→ {myAnswer}</p>
                      : <p className="text-xs text-amber-400 mt-0.5">Not answered — click to answer</p>
                    }
                  </div>
                  <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixed submit bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 p-4 z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4">
            <div className="text-slate-400 text-sm">
              <span className="text-white font-bold">{answeredCount}</span> of {total} answered
              {answeredCount < total && (
                <span className="text-amber-400 ml-2 font-bold">({total - answeredCount} unanswered)</span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || submitLockedRef.current}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:shadow-none uppercase tracking-widest text-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Single Question View ─────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-32">

      {/* Progress bar */}
      <div className="quiz-progress-bar">
        {questions.map((q, i) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = i === currentIndex;
          const cls = isAnswered
            ? 'quiz-progress-segment quiz-progress-segment--answered'
            : isCurrent
            ? 'quiz-progress-segment quiz-progress-segment--current'
            : 'quiz-progress-segment';
          return <div key={q.id} className={cls} />;
        })}
      </div>

      {/* Q counter */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
          Question {currentIndex + 1} of {total}
        </span>
        <span className="text-xs text-slate-500">
          {answeredCount} answered
        </span>
      </div>

      {/* Question card */}
      <div className="px-4">
        <div className="glass-card p-8">
          <div className="flex gap-4 mb-8">
            <div className="w-10 h-10 shrink-0 bg-blue-600 rounded-full flex items-center justify-center font-black text-lg text-white">
              {currentIndex + 1}
            </div>
            <h2 className="text-xl font-medium text-white pt-1 leading-relaxed">
              {getQuestionText(currentQ) || (
                <span className="text-amber-400 italic">
                  Question text not found — check event_questions data shape in console.
                </span>
              )}
            </h2>
          </div>

          <div className="space-y-3">
            {getOptions(currentQ).length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-bold">
                ⚠ No options found for this question. Check the question bank data.
              </div>
            ) : (
              getOptions(currentQ).map((opt, i) => {
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(opt)}
                    disabled={advancing}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all text-left ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)] scale-[1.01]'
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60'
                    } disabled:cursor-wait`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-blue-500' : 'border-slate-500'
                    }`}>
                      {isSelected && <div className="w-2.5 h-2.5 bg-blue-400 rounded-full" />}
                    </div>
                    <span className="text-slate-200">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 p-4 pb-safe z-[60]">
        <div className="max-w-3xl mx-auto flex justify-between items-center px-4 gap-3">

          {/* Back button */}
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 font-bold rounded-lg transition-all text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {/* Centre: answered count */}
          <div className="text-slate-400 font-medium text-sm text-center">
            Answered: <span className="text-white font-bold">{answeredCount}</span> / {total}
          </div>

          {/* Next / Review */}
          <button
            onClick={handleNext}
            disabled={!selectedOption && !answers[currentQ?.id]}
            className={`flex items-center gap-2 px-6 py-2.5 font-black rounded-lg transition-all uppercase tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              isLast
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isLast ? 'Review & Submit' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
