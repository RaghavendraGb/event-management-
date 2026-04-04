import { useEffect, useRef, useState } from 'react';

const ANIMATION_LINES = [
  '> Initializing ECE Resource Hub...',
  '> Loading embedded systems core...',
  '> Connecting to knowledge base...',
  '> Booting modules: [████████░░] 80%...',
  '> Booting modules: [██████████] 100%',
  '> Faculty systems: OK',
  '> Student portal: READY',
  '>',
  '> East Point College of Engineering and Technology',
  '> Department of Electronics and Communication Engineering',
  '> Embedded Systems Resource Hub',
  '>',
  '> [ PRESS ENTER TO ACCESS ]',
];

const CHAR_DELAY = 30; // ms per character
const LINE_PAUSE = 120; // ms between lines

/**
 * Terminal boot-up animation component.
 * Shows once per browser (via localStorage). Skips on subsequent visits.
 * URL param ?reset=1 forces re-play.
 * Props:
 *  - onComplete: () => void — called when user clicks ENTER
 */
export function TerminalAnimation({ onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLine, setCurrentLine] = useState('');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showEnter, setShowEnter] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (currentLineIndex >= ANIMATION_LINES.length) {
      setShowEnter(true);
      return;
    }

    const targetLine = ANIMATION_LINES[currentLineIndex];

    if (currentCharIndex < targetLine.length) {
      const id = setTimeout(() => {
        setCurrentLine((prev) => prev + targetLine[currentCharIndex]);
        setCurrentCharIndex((i) => i + 1);
      }, CHAR_DELAY);
      return () => clearTimeout(id);
    } else {
      // Line complete — move to next
      const id = setTimeout(() => {
        setDisplayedLines((prev) => [...prev, targetLine]);
        setCurrentLine('');
        setCurrentCharIndex(0);
        setCurrentLineIndex((i) => i + 1);
      }, LINE_PAUSE);
      return () => clearTimeout(id);
    }
  }, [currentLineIndex, currentCharIndex]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLines, currentLine]);

  const skipAnimation = () => {
    if (done) return;
    // Jump all lines to displayed, show ENTER button immediately
    setDisplayedLines(ANIMATION_LINES);
    setCurrentLine('');
    setCurrentLineIndex(ANIMATION_LINES.length);
    setCurrentCharIndex(0);
    setShowEnter(true);
  };

  // Keyboard skip: Escape or Space
  useEffect(() => {
    const handleKey = (e) => {
      if (showEnter) return; // already at ENTER
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        skipAnimation();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showEnter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnter = () => {
    if (done) return;
    setDone(true);
    localStorage.setItem('ece-animation-done', '1');
    onComplete?.();
  };

  return (
    <div className="terminal-overlay">
      {/* Skip button — top right */}
      {!showEnter && (
        <button
          onClick={skipAnimation}
          className="absolute top-4 right-4 text-xs text-slate-600 hover:text-slate-400 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors z-10"
        >
          Skip ↩
        </button>
      )}
      <div className="terminal-screen custom-scrollbar">
        {displayedLines.map((line, i) => (
          <div key={i} className="terminal-line">{line}</div>
        ))}
        {currentLineIndex < ANIMATION_LINES.length && (
          <div className="terminal-line">
            {currentLine}
            <span className="terminal-cursor">█</span>
          </div>
        )}
        <div ref={bottomRef} />

        {showEnter && (
          <div className="terminal-enter-btn-wrap">
            <button
              onClick={handleEnter}
              className="terminal-enter-btn"
              autoFocus
            >
              [ PRESS ENTER TO ACCESS ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
