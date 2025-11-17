import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./PokerTableView.css";

// Positioner runt bordet
const seatPositions = [
  { top: "70%", left: "50%" },
  { top: "60%", left: "75%" },
  { top: "40%", left: "88%" },
  { top: "20%", left: "75%" },
  { top: "10%", left: "50%" },
  { top: "20%", left: "25%" },
  { top: "40%", left: "12%" },
  { top: "60%", left: "25%" },
];

export default function PokerTableView() {
  const { id } = useParams();

  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [localCountdown, setLocalCountdown] = useState(null);

  // ---------------------------------------------------------
  // ⏳ Countdown logik — frontend timer
  // ---------------------------------------------------------
  useEffect(() => {
  if (localCountdown === null) return;

  if (localCountdown > 0) {
    const t = setTimeout(() => {
      setLocalCountdown(c => c - 1);

      // update DB so all clients see the countdown
      supabase.from("roomstate")
        .update({ countdown: localCountdown - 1 })
        .eq("room_id", id);

    }, 1000);

    return () => clearTimeout(t);
  }

  if (localCountdown === 0) {
    // mark game as started
    supabase.from("roomstate")
      .update({ has_started: true })
      .eq("room_id", id);

    window.location.href = `/poker/${id}/play`;
  }
}, [localCountdown]);


  // ---------------------------------------------------------
  // 🔄 Hämta spelare
  // ---------------------------------------------------------
  async function loadPlayers() {
    const { data } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id)
      .order("seat", { ascending: true });

    setPlayers(data || []);

    const myId = localStorage.getItem("playerId");
    if (myId) setCurrentPlayer(data.find(p => p.id === myId));

    // Om spelet redan startat → visa inte countdown
    if (game?.has_started) return;

    // Är alla redo?
    const allReady = data.every(p => p.is_ready);

if (allReady && !game?.has_started && localCountdown == null) {
  // Save countdown in DB
  await supabase
    .from("roomstate")
    .update({ countdown: 3 })
    .eq("room_id", id);

  setLocalCountdown(3);
}
    else if (!allReady && localCountdown !== null) {
      // Någon inte redo — avbryt nedräkningen
      await supabase
        .from("roomstate")
        .update({ countdown: null })
        .eq("room_id", id);
    }
  }

  // ---------------------------------------------------------
  // 🔄 Hämta spelstatus
  // ---------------------------------------------------------
  async function loadGame() {
  const { data } = await supabase
    .from("roomstate")
    .select("*")
    .eq("room_id", id)
    .single();

  setGame(data);

  // NEW: Sync local countdown with database
  if (data?.countdown !== null && localCountdown === null) {
    setLocalCountdown(data.countdown);
  }
}


  // ---------------------------------------------------------
  // 🔘 Toggle redo-status
  // ---------------------------------------------------------
  async function toggleReady() {
    if (!currentPlayer) return;

    const newState = !currentPlayer.is_ready;

    await supabase
      .from("roomplayers")
      .update({ is_ready: newState })
      .eq("id", currentPlayer.id);

    loadPlayers();
  }

  // ---------------------------------------------------------
  // 🔁 Realtidsuppdatering
  // ---------------------------------------------------------
  useEffect(() => {
    loadPlayers();
    loadGame();

    const channel = supabase
      .channel(`room_${id}_updates`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roomplayers",
          filter: `room_id=eq.${id}`
        },
        loadPlayers
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roomstate",
          filter: `room_id=eq.${id}`
        },
        loadGame
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="poker-table-page">
      <div className="poker-header">
        <span className="room-id">Rum-ID: {id}</span>

        <h2>♠️ Pokerbord</h2>
        <Link to={`/poker/${id}`} className="back-link">Tillbaka</Link>
      </div>

      {/* COUNTDOWN */}
      {localCountdown !== null && !game?.has_started && (
        <div className="countdown-box">
          {localCountdown > 0 ? (
            <h1>{localCountdown}</h1>
          ) : (
            <h1>Startar!</h1>
          )}
        </div>
      )}

      {/* BORD */}
      <div className="table-container">
        <div className="table-wrapper">
          <div className="table-area">

            {/* COMMUNITY CARDS */}
            {game && (
              <div className="community-cards">
                {game.community_cards.map((c, i) => (
                  <div className="card" key={i}>{c}</div>
                ))}

                {Array.from({ length: 5 - game.community_cards.length }).map((_, i) => (
                  <div className="card empty" key={`e${i}`}></div>
                ))}
              </div>
            )}

            {/* STOLAR */}
            {seatPositions.map((pos, i) => {
              const p = players[i];
              return (
                <div
                  key={i}
                  className={`seat-box ${p ? "taken" : "empty-seat"}`}
                  style={{ top: pos.top, left: pos.left }}
                >
                  {p ? (
                    <>
                      {p.name} {p.is_ready ? "✔️" : "⏳"}
                    </>
                  ) : (
                    "Tom stol"
                  )}
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* READY-KNAPP — endast om spelet inte startat */}
      {currentPlayer && !game?.has_started && (
        <button className="ready-btn" onClick={toggleReady}>
          {currentPlayer.is_ready ? "Redo ✔️" : "Jag är redo"}
        </button>
      )}

    </div>
  );
}
