import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TournamentAction {
  action: string;
  tournament_id: string;
  event_id: string;
  user_id: string;
  [key: string]: unknown;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function query(sql: string, params: unknown[] = []) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database error: ${error}`);
  }

  return response.json();
}

// ============================================
// ACTION: init_tournament
// Initialize bracket and create round 1 matches
// ============================================
async function initTournament(payload: TournamentAction) {
  const { event_id, user_id } = payload;

  try {
    // Verify user is event admin
    const adminCheck = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${event_id}&select=created_by`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const events = await adminCheck.json();
    if (!events?.[0] || events[0].created_by !== user_id) {
      return {
        success: false,
        error: "Unauthorized: Only event admin can initialize tournament",
      };
    }

    // Get all registered participants
    const participantsReq = await fetch(
      `${supabaseUrl}/rest/v1/participation?event_id=eq.${event_id}&status=eq.registered&select=user_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const participants = await participantsReq.json();
    const participantIds = participants.map((p: {user_id: string}) => p.user_id);

    if (participantIds.length < 2) {
      return {
        success: false,
        error: "Need at least 2 participants to start tournament",
      };
    }

    // Create tournament session
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id,
          status: "live",
          current_round: 1,
          total_participants: participantIds.length,
          started_at: new Date().toISOString(),
        }),
      }
    );

    const session = await sessionRes.json();
    const tournamentId = session[0]?.id;

    if (!tournamentId) {
      throw new Error("Failed to create tournament session");
    }

    // Initialize all players in tournament_player_state
    for (const userId of participantIds) {
      await fetch(`${supabaseUrl}/rest/v1/tournament_player_state`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournament_id: tournamentId,
          user_id: userId,
          status: "registered",
          current_round: 1,
        }),
      });
    }

    // Call pairing function for round 1
    const pairingRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/tournament_pair_players_for_round`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_tournament_id: tournamentId,
          p_round_number: 1,
        }),
      }
    );

    const pairingResult = await pairingRes.json();

    // Get the first pending match to assign a question
    const matchesRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_matches?tournament_id=eq.${tournamentId}&round_number=eq.1&select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const matches = await matchesRes.json();

    // Get a random question from the event
    const questionsRes = await fetch(
      `${supabaseUrl}/rest/v1/event_questions?event_id=eq.${event_id}&select=question_id&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const questions = await questionsRes.json();
    const questionId = questions?.[0]?.question_id;

    // Assign same question to all matches in round 1
    if (questionId) {
      for (const match of matches) {
        await fetch(`${supabaseUrl}/rest/v1/tournament_matches?id=eq.${match.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question_id: questionId,
            status: "active",
            started_at: new Date().toISOString(),
          }),
        });
      }
    }

    return {
      success: true,
      tournament_id: tournamentId,
      total_participants: participantIds.length,
      round_1_matches: matches.length,
      bye_player: pairingResult.bye_player_id || null,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============================================
// ACTION: bootstrap
// Get current tournament state, player match, and question
// ============================================
async function bootstrap(payload: TournamentAction) {
  const { tournament_id, user_id } = payload;

  try {
    // Get tournament session
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_sessions?id=eq.${tournament_id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const session = await sessionRes.json();
    if (!session?.[0]) {
      return { success: false, error: "Tournament not found" };
    }

    const tournament = session[0];

    // Get player state
    const playerRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_player_state?tournament_id=eq.${tournament_id}&user_id=eq.${user_id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const players = await playerRes.json();
    if (!players?.[0]) {
      return { success: false, error: "Player not registered in tournament" };
    }

    const playerState = players[0];

    // Get current match if playing
    let currentMatch = null;
    let question = null;
    let leaderboard = [];

    if (playerState.current_match_id) {
      const matchRes = await fetch(
        `${supabaseUrl}/rest/v1/tournament_matches?id=eq.${playerState.current_match_id}&select=*`,
        {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const matches = await matchRes.json();
      if (matches?.[0]) {
        currentMatch = matches[0];

        // Get question details (without correct answer)
        if (currentMatch.question_id) {
          const qRes = await fetch(
            `${supabaseUrl}/rest/v1/question_bank?id=eq.${currentMatch.question_id}&select=id,question,options,difficulty`,
            {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          const questions = await qRes.json();
          question = questions?.[0] || null;
        }
      }
    }

    // Get leaderboard (top players by matches_won, then by score)
    const leaderboardRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_player_state?tournament_id=eq.${tournament_id}&select=user_id,matches_won,total_score,status,current_round&order=matches_won.desc,total_score.desc&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const leaderboardData = await leaderboardRes.json();

    // Get user names for leaderboard
    const userIds = leaderboardData.map((p: {user_id: string}) => p.user_id);
    let userNames: {[key: string]: string} = {};

    if (userIds.length > 0) {
      const usersRes = await fetch(
        `${supabaseUrl}/rest/v1/users?id=in.(${userIds.map((id: string) => `"${id}"`).join(",")}}&select=id,name`,
        {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const users = await usersRes.json();
      users.forEach((u: {id: string, name: string}) => {
        userNames[u.id] = u.name;
      });
    }

    leaderboard = leaderboardData.map((p: any) => ({
      user_id: p.user_id,
      name: userNames[p.user_id] || "Anonymous",
      matches_won: p.matches_won,
      total_score: p.total_score,
      status: p.status,
    }));

    return {
      success: true,
      tournament: {
        id: tournament.id,
        status: tournament.status,
        current_round: tournament.current_round,
        total_participants: tournament.total_participants,
      },
      player: {
        user_id: playerState.user_id,
        status: playerState.status,
        current_round: playerState.current_round,
        matches_won: playerState.matches_won,
        matches_lost: playerState.matches_lost,
        total_score: playerState.total_score,
      },
      match: currentMatch ? {
        id: currentMatch.id,
        player1_id: currentMatch.player1_id,
        player2_id: currentMatch.player2_id,
        status: currentMatch.status,
        started_at: currentMatch.started_at,
      } : null,
      question,
      leaderboard,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============================================
// ACTION: submit_answer
// Submit answer to current match question
// ============================================
async function submitAnswer(payload: TournamentAction & {
  answer: string;
}) {
  const { tournament_id, user_id, answer } = payload;

  try {
    // Get player's current match
    const playerRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_player_state?tournament_id=eq.${tournament_id}&user_id=eq.${user_id}&select=current_match_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const players = await playerRes.json();
    if (!players?.[0] || !players[0].current_match_id) {
      return { success: false, error: "No active match found" };
    }

    const matchId = players[0].current_match_id;

    // Get match details
    const matchRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_matches?id=eq.${matchId}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const matches = await matchRes.json();
    if (!matches?.[0]) {
      return { success: false, error: "Match not found" };
    }

    const match = matches[0];

    // Check if match is still active
    if (match.status !== "active") {
      return { success: false, error: "Match is no longer active" };
    }

    // Get the question's correct answer
    const qRes = await fetch(
      `${supabaseUrl}/rest/v1/question_bank?id=eq.${match.question_id}&select=correct_answer`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const questions = await qRes.json();
    if (!questions?.[0]) {
      return { success: false, error: "Question not found" };
    }

    const correctAnswer = questions[0].correct_answer;
    const isCorrect = answer === correctAnswer;
    const timeTaken = Math.floor(
      (Date.now() - new Date(match.started_at).getTime()) / 1000
    ) * 1000; // in milliseconds

    // Record answer
    const answerRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_answers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          match_id: matchId,
          user_id,
          question_id: match.question_id,
          submitted_answer: answer,
          is_correct: isCorrect,
          time_taken_ms: timeTaken,
        }),
      }
    );

    if (!answerRes.ok) {
      return {
        success: false,
        error: "Failed to record answer (possibly duplicate submission)",
      };
    }

    // Check if both players have answered
    const allAnswersRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_answers?match_id=eq.${matchId}&select=user_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const approxAnswers = await allAnswersRes.json();

    // If both players answered, determine winner
    let matchResult = null;
    if (approxAnswers.length >= 2) {
      const determineRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tournament_determine_match_winner`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_match_id: matchId }),
        }
      );

      matchResult = await determineRes.json();

      // Check if round is complete
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tournament_check_round_completion`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_tournament_id: tournament_id,
            p_round_number: match.round_number,
          }),
        }
      );

      const roundCheck = await checkRes.json();

      return {
        success: true,
        answer_recorded: true,
        is_correct: isCorrect,
        time_taken_ms: timeTaken,
        match_complete: true,
        match_result: matchResult,
        round_check: roundCheck,
      };
    }

    return {
      success: true,
      answer_recorded: true,
      is_correct: isCorrect,
      time_taken_ms: timeTaken,
      match_complete: false,
      waiting_for: "opponent_answer",
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============================================
// ACTION: heartbeat
// Sync player state (same as bootstrap, used for periodic updates)
// ============================================
async function heartbeat(payload: TournamentAction) {
  return bootstrap(payload); // Same data retrieval
}

// ============================================
// ACTION: start_next_round
// Initialize and pair players for next round
// ============================================
async function startNextRound(payload: TournamentAction) {
  const { tournament_id, user_id } = payload;

  try {
    // Verify admin
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_sessions?id=eq.${tournament_id}&select=event_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const sessions = await sessionRes.json();
    if (!sessions?.[0]) {
      return { success: false, error: "Tournament not found" };
    }

    const eventId = sessions[0].event_id;

    // Check admin
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=created_by`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const events = await adminRes.json();
    if (!events?.[0] || events[0].created_by !== user_id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get current round
    const tournamentRes = await fetch(
      `${supabaseUrl}/rest/v1/tournament_sessions?id=eq.${tournament_id}&select=current_round`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const tournament = await tournamentRes.json();
    const nextRound = (tournament[0].current_round || 1) + 1;

    // Pair players for next round
    const pairingRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/tournament_pair_players_for_round`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_tournament_id: tournament_id,
          p_round_number: nextRound,
        }),
      }
    );

    const pairingResult = await pairingRes.json();

    // Update tournament current round
    await fetch(
      `${supabaseUrl}/rest/v1/tournament_sessions?id=eq.${tournament_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ current_round: nextRound }),
      }
    );

    return {
      success: true,
      next_round: nextRound,
      matches_created: pairingResult.matches_created,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============================================
// MAIN HANDLER
// ============================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as TournamentAction;
    const { action } = payload;

    let result;

    switch (action) {
      case "init_tournament":
        result = await initTournament(payload);
        break;
      case "bootstrap":
        result = await bootstrap(payload);
        break;
      case "heartbeat":
        result = await heartbeat(payload);
        break;
      case "submit_answer":
        result = await submitAnswer(payload as TournamentAction & {answer: string});
        break;
      case "start_next_round":
        result = await startNextRound(payload);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
