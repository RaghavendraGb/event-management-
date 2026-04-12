import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function YouAndMeTieBreak({
  sessionId,
  opponent,
  onSubmitAnswer,
  playerState,
}) {
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(20)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [round, setRound] = useState(1)
  const [loading, setLoading] = useState(true)

  // Load tie-break questions
  useEffect(() => {
    async function loadTieBreakQuestion() {
      try {
        const { data, error } = await supabase.functions.invoke('youandme-engine', {
          body: {
            action: 'getTieBreakQuestions',
            sessionId,
            round,
          },
        })

        if (error) throw error

        if (data.questions.length > 0) {
          setCurrentQuestion(data.questions[0])
          setLoading(false)
        }
      } catch (err) {
        console.error('Error loading tie-break question:', err)
      }
    }

    loadTieBreakQuestion()
  }, [sessionId, round])

  // Countdown timer (varies by round)
  useEffect(() => {
    if (timeRemaining <= 0) {
      if (!submitted && selectedOption !== null) {
        handleSubmitAnswer(selectedOption)
      } else if (!submitted) {
        setFeedback('⏰ Time up! Auto-submit as wrong.')
      }
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, selectedOption, submitted, handleSubmitAnswer])

  const handleSubmitAnswer = useCallback((optionIndex) => {
    if (submitted) return

    const isCorrect = currentQuestion.options[optionIndex].is_correct === true
    setSelectedOption(optionIndex)
    setSubmitted(true)
    setFeedback(isCorrect ? '✓ Correct!' : '✗ Incorrect')

    const timeTaken = (20 - timeRemaining) * 1000
    onSubmitAnswer(
      currentQuestion.options[optionIndex].text,
      isCorrect,
      timeTaken
    )

    // Auto-advance after 2 seconds
    setTimeout(() => {
      if (round === 2) {
        // Go to sudden death
        setRound(3)
      } else if (round === 1) {
        setRound(2)
      }
      setSelectedOption(null)
      setSubmitted(false)
      setFeedback('')
      setTimeRemaining(round === 1 ? 15 : 10)
    }, 2000)
  }, [submitted, timeRemaining, currentQuestion, onSubmitAnswer, round])

  if (loading) {
    return (
      <div style={styles.container}>
        <div>Loading tie-break question...</div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div style={styles.container}>
        <div>Loading...</div>
      </div>
    )
  }

  const timerColor =
    timeRemaining <= 5 ? '#ef4444' : timeRemaining <= 10 ? '#f97316' : '#3b82f6'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>⚡ Tie-Break Round {round}</h1>
        <div style={{ ...styles.timer, color: timerColor }}>
          {timeRemaining}s
        </div>
      </div>

      <div style={styles.roundInfo}>
        {round === 1 && <p>3 questions - First to get more correct wins!</p>}
        {round === 2 && <p>1 question - Get it right to win!</p>}
        {round === 3 && <p>Sudden Death - Keep answering until someone wins!</p>}
      </div>

      <div style={styles.questionContainer}>
        <h2 style={styles.questionText}>{currentQuestion.question_text}</h2>
        <span style={styles.difficulty}>{currentQuestion.difficulty}</span>
      </div>

      <div style={styles.optionsGrid}>
        {currentQuestion.options?.map((option, idx) => (
          <button
            key={idx}
            style={{
              ...styles.optionButton,
              backgroundColor:
                selectedOption === idx
                  ? feedback.includes('Correct')
                    ? '#059669'
                    : '#dc2626'
                  : '#1e293b',
              borderColor:
                selectedOption === idx
                  ? feedback.includes('Correct')
                    ? '#10b981'
                    : '#ef4444'
                  : '#475569',
              cursor: submitted ? 'not-allowed' : 'pointer',
            }}
            onClick={() => !submitted && handleSubmitAnswer(idx)}
            disabled={submitted}
          >
            <span style={styles.optionLabel}>
              {String.fromCharCode(65 + idx)}.
            </span>
            <span>{option.text}</span>
          </button>
        ))}
      </div>

      {submitted && (
        <div
          style={{
            ...styles.feedback,
            backgroundColor: feedback.includes('Correct')
              ? '#065f46'
              : '#7f1d1d',
          }}
        >
          {feedback}
        </div>
      )}

      <div style={styles.versusBox}>
        <div style={styles.versusPlayer}>
          <h3>You</h3>
          <p>{playerState.correctAnswers} correct</p>
        </div>
        <div style={styles.vs}>VS</div>
        <div style={styles.versusPlayer}>
          <h3>Opponent</h3>
          <p>{opponent?.correctAnswers} correct</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '900px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '1rem',
    borderBottom: '2px solid #f59e0b',
  },
  timer: {
    fontSize: '3rem',
    fontWeight: 'bold',
    minWidth: '100px',
    textAlign: 'right',
  },
  roundInfo: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #f59e0b',
  },
  questionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  questionText: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: 0,
  },
  difficulty: {
    fontSize: '0.875rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    width: 'fit-content',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  optionButton: {
    padding: '1.5rem',
    borderRadius: '0.5rem',
    border: '2px solid',
    backgroundColor: '#1e293b',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'left',
  },
  optionLabel: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    minWidth: '30px',
  },
  feedback: {
    textAlign: 'center',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  versusBox: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: '1rem',
    alignItems: 'center',
    padding: '1.5rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
  },
  versusPlayer: {
    textAlign: 'center',
  },
  vs: {
    fontWeight: 'bold',
    fontSize: '1.5rem',
    opacity: 0.7,
  },
}
