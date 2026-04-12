import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import YouAndMeSelection from './YouAndMeSelection'
import YouAndMeAnswering from './YouAndMeAnswering'
import YouAndMeWaiting from './YouAndMeWaiting'
import YouAndMeTieBreak from './YouAndMeTieBreak'
import YouAndMeResults from './YouAndMeResults'

export default function YouAndMeMatch({
  eventId,
  userId,
  opponentId,
}) {
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const [gameState, setGameState] = useState('waiting')
  const [session, setSession] = useState(null)
  const [playerState, setPlayerState] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [availableQuestions, setAvailableQuestions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [opponent, setOpponent] = useState(null)
  const syncIntervalRef = useRef(null)
  const [error, setError] = useState(null)

  const getInvokeErrorMessage = (invokeError, data, fallback) => {
    const base = invokeError?.message || data?.error || fallback
    const parts = [base]
    if (data?.details) parts.push(`Details: ${data.details}`)
    if (data?.hint) parts.push(`Hint: ${data.hint}`)
    return parts.join(' | ')
  }

  // Bootstrap game state
  const bootstrapGame = useCallback(async (sessionId) => {
    try {
      const { data, error } = await supabase.functions.invoke('youandme-engine', {
        body: {
          action: 'bootstrap',
          sessionId,
          playerId: userId,
        },
      })

      if (error) throw error
      if (!data?.success) throw new Error(getInvokeErrorMessage(null, data, 'Unable to sync match state'))

      setSession(data.session)
      setPlayerState(data.playerState)
      setCurrentQuestion(data.currentQuestion)
      setAvailableQuestions(data.availableQuestions)
      setLeaderboard(data.leaderboard)
      setOpponent(data.opponent)

      // Determine game state
      if (data.session.status === 'ended' || data.session.phase === 'finished') {
        setGameState('finished')
      } else if (data.playerState.status === 'selecting') {
        setGameState('selection')
      } else if (data.playerState.status === 'answering') {
        setGameState('answering')
      } else if (data.playerState.status === 'tie_break') {
        setGameState('tie_break')
      } else {
        setGameState('waiting')
      }

      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [userId])

  // Initialize match
  useEffect(() => {
    async function initializeMatch() {
      try {
        setLoading(true)
        const { data, error } = await supabase.functions.invoke('youandme-engine', {
          body: {
            action: 'initMatch',
            eventId,
            player1Id: userId,
            player2Id: opponentId,
          },
        })

          if (error) throw error
          if (!data?.success || !data?.sessionId) {
            throw new Error(getInvokeErrorMessage(null, data, 'Unable to start You & Me match'))
          }

        setSessionId(data.sessionId)
        bootstrapGame(data.sessionId)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    initializeMatch()
  }, [eventId, userId, opponentId, bootstrapGame])

  // Sync game state every 1 second
  useEffect(() => {
    if (!sessionId) return

    function setupSync() {
      syncIntervalRef.current = setInterval(async () => {
        try {
          await bootstrapGame(sessionId)
        } catch (err) {
          console.error('Sync error:', err)
        }
      }, 1000)
    }

    setupSync()

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [sessionId, bootstrapGame])

  // Handle question selection
  async function handleSelectQuestion(questionId) {
    try {
      const { data, error } = await supabase.functions.invoke('youandme-engine', {
        body: {
          action: 'selectQuestion',
          sessionId,
          questionId,
          playerId: userId,
        },
      })

      if (error) throw error
      if (!data?.success) throw new Error(getInvokeErrorMessage(null, data, 'Unable to select question'))

      await bootstrapGame(sessionId)
    } catch (err) {
      setError(err.message)
    }
  }

  // Handle answer submission
  async function handleSubmitAnswer(answer, isCorrect, timeMs) {
    try {
      const { data, error } = await supabase.functions.invoke('youandme-engine', {
        body: {
          action: 'submitAnswer',
          sessionId,
          phase: session.phase,
          questionId: currentQuestion.id,
          playerId: userId,
          answer,
          isCorrect,
          timeMs,
        },
      })

      if (error) throw error
      if (!data?.success) throw new Error(getInvokeErrorMessage(null, data, 'Unable to submit answer'))

      await bootstrapGame(sessionId)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) {
    return (
      <div style={styles.error}>
        <h3>Error: {error}</h3>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}>Loading match...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {gameState === 'selection' && (
        <YouAndMeSelection
          availableQuestions={availableQuestions}
          opponent={opponent}
          onSelectQuestion={handleSelectQuestion}
          playerState={playerState}
        />
      )}

      {gameState === 'answering' && (
        <YouAndMeAnswering
          key={currentQuestion?.id || 'youandme-answering'}
          currentQuestion={currentQuestion}
          opponent={opponent}
          onSubmitAnswer={handleSubmitAnswer}
          playerState={playerState}
          session={session}
        />
      )}

      {gameState === 'waiting' && (
        <YouAndMeWaiting
          playerState={playerState}
          leaderboard={leaderboard}
          session={session}
        />
      )}

      {gameState === 'tie_break' && (
        <YouAndMeTieBreak
          sessionId={sessionId}
          playerId={userId}
          opponent={opponent}
          onSubmitAnswer={handleSubmitAnswer}
          playerState={playerState}
        />
      )}

      {gameState === 'finished' && (
        <YouAndMeResults
          session={session}
          playerState={playerState}
          opponent={opponent}
          leaderboard={leaderboard}
          winnerId={session.winnerId}
          currentPlayerId={userId}
          eventId={eventId}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    color: '#fff',
  },
  loadingSpinner: {
    fontSize: '2rem',
    fontWeight: 'bold',
    animation: 'pulse 2s infinite',
  },
  error: {
    padding: '2rem',
    backgroundColor: '#dc2626',
    borderRadius: '0.5rem',
    textAlign: 'center',
  },
}
