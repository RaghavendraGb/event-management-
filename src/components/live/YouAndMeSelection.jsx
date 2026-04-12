import { useState, useEffect } from 'react'

export default function YouAndMeSelection({
  availableQuestions,
  opponent,
  onSelectQuestion,
}) {
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [selectedQuestionId, setSelectedQuestionId] = useState(null)

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Auto-select random question
      if (availableQuestions.length > 0) {
        const randomQuestion =
          availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
        onSelectQuestion(randomQuestion.id)
      }
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, availableQuestions, onSelectQuestion])

  function handleSelectQuestion(questionId) {
    setSelectedQuestionId(questionId)
    onSelectQuestion(questionId)
  }

  const timerColor =
    timeRemaining <= 5 ? '#ef4444' : timeRemaining <= 10 ? '#f97316' : '#3b82f6'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Choose a Question for {opponent?.id}</h1>
        <div style={{ ...styles.timer, color: timerColor }}>
          {timeRemaining}s
        </div>
      </div>

      <div style={styles.questionsGrid}>
        {availableQuestions.map((question, idx) => (
          <div
            key={question.id}
            style={{
              ...styles.questionCard,
              opacity: selectedQuestionId ? 0.5 : 1,
              cursor: selectedQuestionId ? 'not-allowed' : 'pointer',
              backgroundColor:
                selectedQuestionId === question.id ? '#059669' : '#1e293b',
              borderColor:
                selectedQuestionId === question.id ? '#10b981' : '#475569',
            }}
            onClick={() => !selectedQuestionId && handleSelectQuestion(question.id)}
          >
            <div style={styles.questionNumber}>Q{idx + 1}</div>
            <p style={styles.questionText}>{question.text}</p>
            <span style={styles.difficulty}>{question.difficulty}</span>
          </div>
        ))}
      </div>

      {selectedQuestionId && (
        <div style={styles.confirming}>
          ✓ Question selected! Waiting for opponent to answer...
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  timer: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    minWidth: '80px',
    textAlign: 'right',
  },
  questionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1rem',
  },
  questionCard: {
    padding: '1.5rem',
    borderRadius: '0.5rem',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  questionNumber: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    opacity: 0.7,
  },
  questionText: {
    fontSize: '1rem',
    fontWeight: '600',
    margin: 0,
    lineHeight: '1.4',
  },
  difficulty: {
    fontSize: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
  },
  confirming: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#065f46',
    borderRadius: '0.5rem',
    fontSize: '1.125rem',
    fontWeight: '600',
  },
}
