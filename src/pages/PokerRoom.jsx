import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";
import "./PokerRoom.css";

export default function PokerRoom() {
  const { id } = useParams();
  const playerName = localStorage.getItem("playerName");
  const storedPlayerId = localStorage.getItem("playerId");

  const [players, setPlayers] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // ---------------------------------------------------------
  // 🔄 Hämta spelare i rummet
  // ---------------------------------------------------------
  async function loadPlayers() {
    const { data } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id)
      .order("created_at", { ascending: true });

    setPlayers(data || []);
  }

  // ---------------------------------------------------------
  // 🔄 Hämta room owner
  // ---------------------------------------------------------
  async function loadOwner() {
    const { data } = await supabase
      .from("rooms")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (data) {
      setOwnerId(data.owner_id);

      // Är jag ägare?
      setIsOwner(String(data.owner_id) === String(storedPlayerId));
    }
  }

  // ---------------------------------------------------------
  // 🟢 Säkerställ att spelaren finns i roomplayers
  // ---------------------------------------------------------
  async function ensurePlayerExists() {
    if (!playerName) {
      alert("Namn saknas — gå tillbaka och skriv in det först.");
      window.location.href = "/poker";
      return;
    }

    if (!storedPlayerId) {
      // Skapa spelare
      const { data, error } = await supabase
        .from("roomplayers")
        .insert([
          {
            room_id: id,
            name: playerName,
            is_connected: true,
            is_ready: false,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        localStorage.setItem("playerId", data.id);
      }
    }
  }

  // ---------------------------------------------------------
  // 🔁 Realtidssubscription för spelare
  // ---------------------------------------------------------
  useEffect(() => {
    loadPlayers();
    loadOwner();

    const channel = supabase
      .channel(`room_${id}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---------------------------------------------------------
  // 🚪 Lämna rummet
  // ---------------------------------------------------------
  async function leaveRoom() {
    const pid = localStorage.getItem("playerId");
    if (pid) {
      await supabase.from("roomplayers").delete().eq("id", pid);
    }

    localStorage.removeItem("playerId");

    window.location.href = "/poker";
  }

  // ---------------------------------------------------------
  // ❌ Kicka spelare (endast owner)
  // ---------------------------------------------------------
  async function kickPlayer(pid) {
    if (!isOwner) return;

    await supabase
      .from("roomplayers")
      .delete()
      .eq("id", pid);
  }

  // ---------------------------------------------------------
  // INIT
  // ---------------------------------------------------------
  useEffect(() => {
  async function init() {
    await ensurePlayerExists();  // 👈 viktigt: vänta!
    await loadPlayers();
    await loadOwner();
  }

  init();
}, []);

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="poker-page">
      <div className="player-info">
        <strong>{playerName}</strong>{" "}
        {isOwner && <span style={{ color: "gold" }}>(Leader)</span>}
      </div>

      <h2>♠️ Poker Rum</h2>

      <p>
        Rum-ID: <strong>{id}</strong>
      </p>

      <h3>Spelare i rummet:</h3>

      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className="player-item">
            <span className="player-name">
              {p.name}
              {String(p.id) === String(storedPlayerId) && " (du)"}
              {String(p.id) === String(ownerId) && " ⭐"}
            </span>

            {/* KICK KNAPP — endast owner, och ej på dig själv */}
            {isOwner && String(p.id) !== String(ownerId) && (
              <button
                className="remove-player-btn"
                onClick={() => kickPlayer(p.id)}
              >
                ✖
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <button
          onClick={() => (window.location.href = `/poker/${id}/play`)}
          className="start-game-btn"
        >
          Starta spel
        </button>
      )}


       <button onClick={leaveRoom} className="leave-btn">
        Lämna rummet
      </button>

      <Link to="/poker">Tillbaka</Link>
    </div>
  );
}
