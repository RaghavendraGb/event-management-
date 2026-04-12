import { useState, useEffect, useRef, useCallback } from 'react'

export default function YouAndMeAnswering({
  currentQuestion,
  opponent,
  onSubmitAnswer,
  playerState,
}) {
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState('')
  const timeoutHandledRef = useRef(false)
  const submitLockedRef = useRef(false)

  const handleSubmitAnswer = useCallback((optionIndex) => {
    if (submitted || submitLockedRef.current) return
    submitLockedRef.current = true

    const isCorrect =
      currentQuestion.options[optionIndex].is_correct === true

    setSelectedOption(optionIndex)
    setSubmitted(true)
    setFeedback(isCorrect ? '✓ Correct!' : '✗ Incorrect')

    const timeTaken = (30 - timeRemaining) * 1000
    Promise.resolve(onSubmitAnswer(
      currentQuestion.options[optionIndex].text,
      isCorrect,
      timeTaken
    )).finally(() => {
      submitLockedRef.current = false
    })

    timeoutHandledRef.current = true
  }, [submitted, currentQuestion, timeRemaining, onSubmitAnswer])

  // Countdown timer
  useEffect(() => {
    if (submitted || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, submitted])

  useEffect(() => {
    if (submitted || timeRemaining > 0 || timeoutHandledRef.current) return

    const timeoutAction = setTimeout(() => {
      if (selectedOption !== null) {
        handleSubmitAnswer(selectedOption)
        return
      }

      timeoutHandledRef.current = true
      setSubmitted(true)
      setFeedback('⏰ Time up! Auto-submit as wrong.')
      onSubmitAnswer('', false, 30000)
    }, 0)

    return () => clearTimeout(timeoutAction)
  }, [timeRemaining, submitted, selectedOption, onSubmitAnswer, handleSubmitAnswer])

  const timerColor =
    timeRemaining <= 5 ? '#ef4444' : timeRemaining <= 10 ? '#f97316' : '#3b82f6'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2>Opponent: {opponent?.id}</h2>
          <p>Correct answers: {opponent?.correctAnswers}</p>
        </div>
        <div style={{ ...styles.timer, color: timerColor }}>
          {timeRemaining}s
        </div>
      </div>

      <div style={styles.questionContainer}>
        <h1 style={styles.questionText}>{currentQuestion.question_text}</h1>
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
                  ? feedback === '✓ Correct!'
                    ? '#059669'
                    : '#dc2626'
                  : '#1e293b',
              borderColor:
                selectedOption === idx
                  ? feedback === '✓ Correct!'
                    ? '#10b981'
                    : '#ef4444'
                  : '#475569',
              cursor: submitted ? 'not-allowed' : 'pointer',
              opacity: submitted && selectedOption !== idx ? 0.5 : 1,
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
          {feedback} ({timeRemaining}s spent)
        </div>
      )}

      <div style={styles.stats}>
        <div>Your Score: {playerState.totalScore}</div>
        <div>Questions Answered: {playerState.answerCount}</div>
        <div>Correct: {playerState.correctAnswers}</div>
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
    alignItems: 'flex-start',
    paddingBottom: '1rem',
    borderBottom: '1px solid #475569',
  },
  timer: {
    fontSize: '3rem',
    fontWeight: 'bold',
    minWidth: '100px',
    textAlign: 'right',
  },
  questionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  questionText: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    margin: 0,
    lineHeight: '1.4',
  },
  difficulty: {
    fontSize: '0.875rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    width: 'fit-content',
    textTransform: 'uppercase',
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
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    textAlign: 'center',
  },
}
