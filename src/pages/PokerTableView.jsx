import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./PokerTableView.css";
import { createDeck, shuffle, dealHands } from "./Game/pokerLogic";

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
  const [userId, setUserId] = useState(null);
  const [ownerId, setOwnerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // ---------------------------------------------------------
  // 🔐 Hämta inloggad användare
  // ---------------------------------------------------------
  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id;
      setUserId(uid);
    }
    getSession();
  }, []);

  useEffect(() => {
    setIsOwner(ownerId && userId ? String(ownerId) === String(userId) : false);
  }, [ownerId, userId]);

  // ---------------------------------------------------------
  // ⏳ Countdown logik
  // ---------------------------------------------------------
  useEffect(() => {
    if (!game || game.has_started) return;
    if (localCountdown === null) return;

    if (localCountdown > 0) {
      const t = setTimeout(() => {
        const next = localCountdown - 1;
        setLocalCountdown(next);

        supabase
          .from("roomstate")
          .update({ countdown: next })
          .eq("room_id", id);
      }, 1000);

      return () => clearTimeout(t);
    }

    if (localCountdown === 0) startGame();
  }, [localCountdown, game]);

  // ---------------------------------------------------------
  // 🎮 Starta spelet – dealer
  // ---------------------------------------------------------
  async function startGame() {
    const { data: playersInRoom } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id)
      .order("seat", { ascending: true });

    let deck = shuffle(createDeck());
    const { hands } = dealHands(deck, playersInRoom);

    await supabase
      .from("roomstate")
      .update({
        has_started: true,
        countdown: null,
        hands,
        community_cards: [],
      })
      .eq("room_id", id);
  }

  // ---------------------------------------------------------
  // 🔄 Ladda spelare
  // ---------------------------------------------------------
  async function loadPlayers() {
    const { data } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id)
      .order("seat", { ascending: true });
    console.log(
      `[loadPlayers] ${new Date().toISOString()} - fetched ${(
        data || []
      ).length} players for room ${id}`
    );

    setPlayers(data || []);

    if (userId) {
      setCurrentPlayer(data?.find((p) => p.id === userId) || null);
    }

    if (game?.has_started || !data) return;

    // Require at least 2 players before starting countdown
    const allReady = data.length > 1 && data.every((p) => p.is_ready === true);

    // När alla spelare är redo (minst 2) → starta nedräkning, men bara om
    // den lokala spelaren också har tryckt "Starta spel". Detta förhindrar
    // att en nedräkning startar för klienter som inte själva bekräftat redo.
    if (
      allReady &&
      localCountdown === null &&
      game?.countdown === null &&
      currentPlayer?.is_ready === true
    ) {
      console.log(
        "[loadPlayers] all players ready and local player is ready -> trigger countdown start -> 3"
      );
      try {
        await supabase
          .from("roomstate")
          .update({ countdown: 3 })
          .eq("room_id", id);
      } catch (err) {
        console.warn("[loadPlayers] countdown update warning:", err);
      }

      setLocalCountdown(3);
    } else if (allReady && currentPlayer?.is_ready !== true) {
      console.log(
        "[loadPlayers] all players are ready but local player hasn't clicked yet; waiting for local click"
      );
    }
  }

  // ---------------------------------------------------------
  // 🔄 Ladda roomstate
  // ---------------------------------------------------------
  async function loadGame() {
    const { data } = await supabase
      .from("roomstate")
      .select("*")
      .eq("room_id", id)
      .maybeSingle();
    console.log(
      `[loadGame] ${new Date().toISOString()} - roomstate fetched for ${id}:`,
      data
    );

    if (!data) {
      setGame(null);
      setLocalCountdown(null);
      return;
    }

    setGame(data);

    if (data.countdown !== null && localCountdown === null) {
      // Only sync countdown locally if the local player is marked ready.
      const localIsReady =
        currentPlayer?.is_ready ||
        players.find((p) => String(p.id) === String(userId))?.is_ready;

      if (localIsReady) {
        console.log(
          `[loadGame] syncing localCountdown -> ${data.countdown} (local player ready)`
        );
        setLocalCountdown(data.countdown);
      } else {
        console.log(
          `[loadGame] ignoring countdown=${data.countdown} because local player is not ready yet`
        );
      }
    }
  }

  // ---------------------------------------------------------
  // 🔘 Ready-knapp
  // ---------------------------------------------------------
  // Toggle ready/unready for current player
  async function toggleReady() {
    if (!currentPlayer) return;

    const newReady = !currentPlayer.is_ready;

    console.log(
      `[toggleReady] ${new Date().toISOString()} - setting is_ready=${newReady} for ${currentPlayer.id}`
    );

    await supabase
      .from("roomplayers")
      .update({ is_ready: newReady })
      .eq("room_id", id)
      .eq("id", currentPlayer.id);

    // reload players to trigger countdown logic
    loadPlayers();
  }

  // ---------------------------------------------------------
  // 📡 Realtid: roomplayers + roomstate
  // ---------------------------------------------------------
  useEffect(() => {
    loadPlayers();
    loadGame();
    // load owner info so only owner triggers countdown
    (async function loadOwner() {
      const { data } = await supabase
        .from("rooms")
        .select("owner_id")
        .eq("id", id)
        .maybeSingle();

      if (data) {
        setOwnerId(data.owner_id);
      }
    })();

    const channel = supabase
      .channel(`room_${id}_realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roomplayers",
          filter: `room_id=eq.${id}`,
        },
        loadPlayers
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roomstate",
          filter: `room_id=eq.${id}`,
        },
        loadGame
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="poker-table-page">
      <div className="poker-header">
        <span className="room-id">Rum-ID: {id}</span>
        <h2>♠️ Pokerbord</h2>
        <Link to={`/poker/${id}`} className="back-link">
          Tillbaka
        </Link>
      </div>

      {/* COUNTDOWN */}
      {localCountdown !== null && !game?.has_started && (
        <div className="countdown-box">
          <h1>{localCountdown > 0 ? localCountdown : "Startar!"}</h1>
        </div>
      )}

      {/* BORD */}
      <div className="table-container">
        <div className="table-wrapper">
          <div className="table-area">
            {/* COMMUNITY CARDS */}
            {game && (
              <div className="community-cards">
                {game.community_cards?.map((c, i) => (
                  <div className="card" key={i}>
                    {c}
                  </div>
                ))}
              </div>
            )}

            {/* SEATS */}
            {seatPositions.map((pos, i) => {
              const p = players[i];
              return (
                <div
                  key={i}
                  className={`seat-box ${p ? "taken" : "empty-seat"}`}
                  style={{ top: pos.top, left: pos.left }}
                >
                  {p
                    ? `${p.name} ${p.is_ready ? "✔️" : "⏳"}`
                    : "Tom stol"}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* READY BUTTON */}
      {currentPlayer && !game?.has_started && (
        <button className="ready-btn" onClick={toggleReady}>
          {currentPlayer.is_ready ? "Redo ✔️" : "Starta spel"}
        </button>
      )}
    </div>
  );
}
