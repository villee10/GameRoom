import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./PokerTableView.css";
import { createDeck, shuffle, dealHands } from "./Game/pokerLogic";

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
  // ⏳ Countdown logik
  // ---------------------------------------------------------
  useEffect(() => {
    if (localCountdown === null) return;

    if (localCountdown > 0) {
      const t = setTimeout(() => {
        setLocalCountdown(c => c - 1);

        supabase.from("roomstate")
          .update({ countdown: localCountdown - 1 })
          .eq("room_id", id);

      }, 1000);

      return () => clearTimeout(t);
    }

    // När countdown når 0 → starta spelet
    if (localCountdown === 0) startGame();

  }, [localCountdown]);


  // ---------------------------------------------------------
  // 🎮 Starta spelet (deal cards + mark has_started)
  // ---------------------------------------------------------
  async function startGame() {
    const { data: playersInRoom } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id)
      .order("seat", { ascending: true });

    // skapa kortlek och dela ut
    let deck = shuffle(createDeck());
    const { hands, remaining } = dealHands(deck, playersInRoom);

    await supabase
      .from("roomstate")
      .update({
        has_started: true,
        countdown: null,
        hands: hands,
        community_cards: [],
      })
      .eq("room_id", id);

    window.location.href = `/poker/${id}/play`;
  }


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

    if (game?.has_started) return;

    const allReady = data.every(p => p.is_ready);
    if (allReady && localCountdown === null && game?.countdown == null) {
      await supabase
        .from("roomstate")
        .update({ countdown: 3 })
        .eq("room_id", id);

      setLocalCountdown(3);
    }

    if (!allReady && localCountdown !== null) {
      await supabase
        .from("roomstate")
        .update({ countdown: null })
        .eq("room_id", id);

      setLocalCountdown(null);
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

    if (data?.countdown !== null && localCountdown === null) {
      setLocalCountdown(data.countdown);
    }
  }


  // ---------------------------------------------------------
  // 🔘 Toggle redo
  // ---------------------------------------------------------
  async function toggleReady() {
    if (!currentPlayer) return;

    await supabase
      .from("roomplayers")
      .update({ is_ready: !currentPlayer.is_ready })
      .eq("id", currentPlayer.id);

    loadPlayers();
  }


  // ---------------------------------------------------------
  // 🔁 Realtid
  // ---------------------------------------------------------
  useEffect(() => {
    loadPlayers();
    loadGame();

    const channel = supabase
      .channel(`room_${id}_updates`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "roomplayers", filter: `room_id=eq.${id}` },
        loadPlayers
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "roomstate", filter: `room_id=eq.${id}` },
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
          {localCountdown > 0 ? <h1>{localCountdown}</h1> : <h1>Startar!</h1>}
        </div>
      )}

      {/* BORD */}
      <div className="table-container">
        <div className="table-wrapper">
          <div className="table-area">

            {/* COMMUNITY CARDS */}
            {game && (
              <div className="community-cards">
                {game.community_cards.map((c, i) =>
                  <div className="card" key={i}>{c}</div>
                )}
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
                  {p ? `${p.name} ${p.is_ready ? "✔️" : "⏳"}` : "Tom stol"}
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* READY-KNAPP */}
      {currentPlayer && !game?.has_started && (
        <button className="ready-btn" onClick={toggleReady}>
          {currentPlayer.is_ready ? "Redo ✔️" : "Jag är redo"}
        </button>
      )}

    </div>
  );
}
