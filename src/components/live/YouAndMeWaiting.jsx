export default function YouAndMeWaiting({
  playerState,
  leaderboard,
  session,
}) {
  return (
    <div style={styles.container}>
      <div style={styles.waitingBox}>
        <div style={styles.icon}>⏳</div>
        <h1>Waiting for Next Round</h1>
        <p>Your opponent is finishing their answer...</p>
      </div>

      <div style={styles.statsBox}>
        <h2>Your Progress</h2>
        <div style={styles.statRow}>
          <span>Correct Answers:</span>
          <span style={styles.statValue}>{playerState.correctAnswers}</span>
        </div>
        <div style={styles.statRow}>
          <span>Total Score:</span>
          <span style={styles.statValue}>{playerState.totalScore}</span>
        </div>
        <div style={styles.statRow}>
          <span>Questions Answered:</span>
          <span style={styles.statValue}>{playerState.answerCount}</span>
        </div>
      </div>

      <div style={styles.leaderboardBox}>
        <h2>Live Leaderboard</h2>
        <div style={styles.leaderboardList}>
          {leaderboard?.slice(0, 5).map((entry, idx) => (
            <div key={idx} style={styles.leaderboardRow}>
              <span style={styles.rank}>#{idx + 1}</span>
              <span style={styles.name}>
                {entry.users?.name || 'Unknown'}
              </span>
              <span style={styles.score}>
                {entry.correct_answers} correct
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.matchInfo}>
        <p>Questions Used: {session.questionsUsed} / {session.totalQuestions}</p>
        <p>Current Phase: {session.phase?.replace(/_/g, ' ').toUpperCase()}</p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '600px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  waitingBox: {
    textAlign: 'center',
    padding: '3rem 2rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.75rem',
    borderLeft: '4px solid #3b82f6',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    animation: 'pulse 1s infinite',
  },
  statsBox: {
    backgroundColor: '#1e293b',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #10b981',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
    borderBottom: '1px solid #0f172a',
  },
  statValue: {
    fontWeight: 'bold',
    fontSize: '1.125rem',
    color: '#10b981',
  },
  leaderboardBox: {
    backgroundColor: '#1e293b',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #f59e0b',
  },
  leaderboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  leaderboardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
  },
  rank: {
    fontWeight: 'bold',
    color: '#f59e0b',
    minWidth: '40px',
  },
  name: {
    flex: 1,
    paddingLeft: '1rem',
  },
  score: {
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  matchInfo: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    opacity: 0.8,
  },
}
