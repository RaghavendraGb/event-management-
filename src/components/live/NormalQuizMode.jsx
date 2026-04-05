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
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px 120px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Review Your Answers</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {answeredCount}/{total} questions answered. Click any card to revisit.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map((q, i) => {
              const myAnswer = answers[q.id];
              const answered = !!myAnswer;
              return (
                <button
                  key={q.id}
                  onClick={() => setReviewJumpTo(i)}
                  className="card-hover"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    background: answered ? 'rgba(16,185,129,0.04)' : 'var(--elevated)',
                    border: `1px solid ${answered ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    background: answered ? 'var(--green)' : 'var(--surface)',
                    color: answered ? '#000' : 'var(--text-muted)',
                    border: answered ? 'none' : '1px solid var(--border)',
                    flexShrink: 0
                  }}>
                    {answered ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getQuestionText(q)}</p>
                    {answered
                      ? <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>✓ {myAnswer}</p>
                      : <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>Not answered</p>
                    }
                  </div>
                  <RotateCcw size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixed submit bar */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 20px', zIndex: 60 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{answeredCount}</span> of {total} questions answered
              {answeredCount < total && <span style={{ color: 'var(--amber)', marginLeft: 8 }}>( {total - answeredCount} remaining )</span>}
            </p>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || submitLockedRef.current}
              className="btn-primary"
              style={{ minWidth: 160, padding: '10px 24px' }}
            >
              {isSubmitting ? 'Submitting...' : 'Finish Event'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Single Question View ─────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 120px' }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, height: 4, marginBottom: 24, borderRadius: 2, overflow: 'hidden', background: 'var(--elevated)' }}>
        {questions.map((q, i) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = i === currentIndex;
          return (
            <div
              key={q.id}
              style={{
                flex: 1,
                background: isCurrent ? 'var(--blue)' : isAnswered ? 'var(--green)' : 'transparent',
                opacity: isCurrent || isAnswered ? 1 : 0.2,
                transition: 'all 0.3s'
              }}
            />
          );
        })}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 24px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Part {currentIndex + 1} of {total}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Progress: {Math.round((answeredCount / total) * 100)}%
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
            {currentIndex + 1}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, paddingTop: 4 }}>
            {getQuestionText(currentQ) || <span style={{ color: 'var(--amber)', fontStyle: 'italic' }}>Question content unavailable</span>}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {getOptions(currentQ).length === 0 ? (
            <div style={{ padding: 16, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: 'var(--amber)', fontSize: 13, fontWeight: 600 }}>
              ⚠ No selectable options found for this question
            </div>
          ) : (
            getOptions(currentQ).map((opt, i) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={i}
                  onClick={() => handleOptionClick(opt)}
                  disabled={advancing}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--elevated)',
                    border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: 8,
                    cursor: advancing ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  className="card-hover"
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--blue)' : 'var(--text-muted)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}>
                    {isSelected && <div style={{ width: 8, height: 8, background: 'var(--blue)', borderRadius: '50%' }} />}
                  </div>
                  <span style={{ fontSize: 14, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400 }}>{opt}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 20px', zIndex: 60 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="btn-ghost"
            style={{ minWidth: 100, padding: '8px 16px' }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div style={{ textAlign: 'center', display: 'none' }} id="quiz-mobile-hide">
            <style>{`@media (min-width: 640px) { #quiz-mobile-hide { display: block; } }`}</style>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{answeredCount} of {total} answered</p>
          </div>

          <button
            onClick={handleNext}
            disabled={!selectedOption && !answers[currentQ?.id]}
            className={isLast ? 'btn-primary' : 'btn-ghost'}
            style={{ minWidth: 140, padding: '8px 20px', ...(isLast ? { background: 'var(--green)', color: '#000', borderColor: 'transparent' } : {}) }}
          >
            {isLast ? 'Review & Submit' : 'Next Question'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
