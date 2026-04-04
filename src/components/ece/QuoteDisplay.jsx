import { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const FALLBACK_QUOTES = [
  { text: 'The real grade is what you know, not what you copied.', author: 'Inspiration', category: 'cheat' },
  { text: 'Shortcuts skip the learning, not the exam.', author: 'Wisdom', category: 'exam' },
  { text: 'Failure is just the first attempt in learning.', author: 'Inspiration', category: 'failure' },
  { text: 'Every expert was once a beginner.', author: 'Motivation', category: 'motivation' },
  { text: 'Your consistency today is your certificate tomorrow.', author: 'Motivation', category: 'motivation' },
  { text: 'One loss doesn\'t define your journey.', author: 'Inspiration', category: 'failure' },
  { text: 'Study not to pass but to know.', author: 'Wisdom', category: 'exam' },
];

/**
 * Auto-rotating motivational quote display.
 * Pulls from ece_quotes table, falls back to static list.
 * Changes every 8 seconds with fade transition.
 */
export function QuoteDisplay({ showIcon = true }) {
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    supabase
      .from('ece_quotes')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setQuotes(data);
          setIndex(0); // Reset index to 0 when quotes array changes
        }
      });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % quotes.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(id);
  }, [quotes.length]);

  const quote = quotes[index];

  return (
    <div
      className="quote-display"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      {showIcon && <Quote className="w-5 h-5 text-blue-400 shrink-0 mt-1" />}
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm leading-relaxed italic">"{quote?.text}"</p>
        <p className="text-xs text-slate-500 mt-1">— {quote?.author || 'Anonymous'}</p>
      </div>
    </div>
  );
}
