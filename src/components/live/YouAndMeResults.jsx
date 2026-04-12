import { useMemo } from 'react'

export default function YouAndMeResults({
  session,
  playerState,
  opponent,
  leaderboard,
  winnerId,
  currentPlayerId,
}) {
  const eventStatus = session?.status || 'active'
  const myRow = leaderboard?.find((entry) => entry.player_id === currentPlayerId)
  const opponentRow = leaderboard?.find((entry) => entry.player_id !== currentPlayerId)
  const myScore = Number(myRow?.total_score ?? playerState?.totalScore ?? 0)
  const opponentScore = Number(opponentRow?.total_score ?? opponent?.totalScore ?? 0)
  const isTie = myScore === opponentScore
  const isWinner = useMemo(
    () => eventStatus === 'ended' && winnerId === currentPlayerId,
    [eventStatus, winnerId, currentPlayerId]
  )

  if (eventStatus !== 'ended') {
    return (
      <div style={styles.container}>
        <div style={styles.loserBox}>
          <h1>Waiting for results...</h1>
          <p>The event is still in progress. Final rankings will appear once the admin ends it.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {isWinner ? (
        <div style={styles.winnerBox}>
          <div style={styles.trophy}>🏆</div>
          <h1>YOU WON! 🎉</h1>
          <p>Congratulations on your victory!</p>
        </div>
      ) : (
        <div style={styles.loserBox}>
          <h1>Match Ended</h1>
          <p>Final Score</p>
        </div>
      )}

      <div style={styles.scoreComparison}>
        <div style={styles.scoreCard}>
          <h3>Your Score</h3>
          <div style={styles.finalScore}>{isTie ? 'TIE' : myScore}</div>
          <p>{playerState.correctAnswers} correct answers</p>
        </div>

        <div style={styles.vs}>VS</div>

        <div style={styles.scoreCard}>
          <h3>Opponent Score</h3>
          <div style={styles.finalScore}>{isTie ? 'TIE' : opponentScore}</div>
          <p>{opponent?.correctAnswers} correct answers</p>
        </div>
      </div>

      <div style={styles.statisticsBox}>
        <h2>Match Statistics</h2>
        <div style={styles.stat}>
          <span>Questions Answered:</span>
          <span>{playerState.answerCount}</span>
        </div>
        <div style={styles.stat}>
          <span>Correct Answers:</span>
          <span>{playerState.correctAnswers}</span>
        </div>
        <div style={styles.stat}>
          <span>Total Score:</span>
          <span>{playerState.totalScore}</span>
        </div>
      </div>

      <div style={styles.leaderboardBox}>
        <h2>Final Rankings</h2>
        <div style={styles.leaderboardList}>
          {leaderboard?.slice(0, 5).map((entry, idx) => (
            <div
              key={idx}
              style={{
                ...styles.leaderboardRow,
                backgroundColor:
                  entry.player_id === currentPlayerId
                    ? 'rgba(16, 185, 129, 0.1)'
                    : '#0f172a',
              }}
            >
              <span style={styles.medal}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''}
              </span>
              <span style={styles.rank}>#{idx + 1}</span>
              <span style={styles.name}>
                {entry.users?.name || 'Unknown'}
                {entry.player_id === currentPlayerId && ' (You)'}
              </span>
              <span style={styles.score}>{entry.correct_answers} correct</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.actionButtons}>
        <button style={styles.button}>Share Result</button>
        <button style={styles.button}>Download Certificate</button>
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
  winnerBox: {
    textAlign: 'center',
    padding: '3rem 2rem',
    backgroundColor: '#1e3a1f',
    borderRadius: '0.75rem',
    borderLeft: '4px solid #10b981',
  },
  trophy: {
    fontSize: '4rem',
    marginBottom: '1rem',
    animation: 'bounce 1s infinite',
  },
  loserBox: {
    textAlign: 'center',
    padding: '3rem 2rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.75rem',
  },
  scoreComparison: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: '1.5rem',
    alignItems: 'center',
  },
  scoreCard: {
    padding: '2rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    textAlign: 'center',
    borderLeft: '4px solid #3b82f6',
  },
  finalScore: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: '#10b981',
    margin: '1rem 0',
  },
  vs: {
    fontWeight: 'bold',
    fontSize: '1.5rem',
    opacity: 0.7,
  },
  statisticsBox: {
    padding: '1.5rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #f59e0b',
  },
  stat: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderBottom: '1px solid #0f172a',
  },
  leaderboardBox: {
    padding: '1.5rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #8b5cf6',
  },
  leaderboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  leaderboardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
  },
  medal: {
    fontSize: '1.5rem',
    minWidth: '30px',
  },
  rank: {
    fontWeight: 'bold',
    color: '#8b5cf6',
    minWidth: '40px',
  },
  name: {
    flex: 1,
  },
  score: {
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  actionButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  button: {
    padding: '1rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
}
