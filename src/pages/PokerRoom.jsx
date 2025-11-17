import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";
import "./PokerRoom.css";

export default function PokerRoom() {
  const { id } = useParams();
  const [players, setPlayers] = useState([]);

  const playerName = localStorage.getItem("playerName");
  const playerId = localStorage.getItem("playerId");

  // ----------------------------------------------------------
  // 🔥 HÄMTA ALLA SPELARE I RUMMET
  // ----------------------------------------------------------
  async function loadPlayers() {
    const { data } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id);

    setPlayers(data || []);
  }

  // ----------------------------------------------------------
  // 🔥 JOINA RUM AUTOMATISKT om man inte redan är med
  // ----------------------------------------------------------
  async function autoJoin() {
    if (!playerName) return; // borde aldrig hända nu

    // Om vi HAR ett playerId — kolla om spelaren faktiskt finns
    if (playerId) {
      const { data: exists } = await supabase
        .from("roomplayers")
        .select("*")
        .eq("id", playerId)
        .maybeSingle();

      if (exists) {
        loadPlayers();
        return; // redan med i rummet ✔️
      }
    }

    // Annars lägg in spelaren
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
      .select();

    if (error) {
      console.error(error);
      return;
    }

    // Spara spelarens ID
    localStorage.setItem("playerId", data[0].id);

    loadPlayers();
  }

  // ----------------------------------------------------------
  // 🔥 REALTIDSUPPDATERING + AUTOJOIN
  // ----------------------------------------------------------
  useEffect(() => {
    autoJoin();
    loadPlayers();

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

    return () => supabase.removeChannel(channel);
  }, []);

  // ----------------------------------------------------------
  // 🔥 TA BORT SPELARE
  // ----------------------------------------------------------
  async function removePlayer(idToRemove) {
    await supabase.from("roomplayers").delete().eq("id", idToRemove);
    loadPlayers();
  }

  // ----------------------------------------------------------
  // 🔥 STARTA SPELET
  // ----------------------------------------------------------
  async function startGame() {
    window.location.href = `/poker/${id}/play`;
  }

  return (
    <div className="poker-page">

      {/* Spelarinfo uppe till vänster */}
      <div className="player-info">
        Inloggad som: <strong>{playerName}</strong>
      </div>

      <h2>♠️ Poker Rum</h2>
      <p>Rum-ID: <strong>{id}</strong></p>

      <h3>Spelare i rummet:</h3>

      <ul className="player-list">
        {players.map((p) => (
          <li className="player-item" key={p.id}>
            <span className="player-name">{p.name}</span>
            <button
              className="remove-player-btn"
              onClick={() => removePlayer(p.id)}
            >
              -
            </button>
          </li>
        ))}
      </ul>

      <button onClick={startGame} className="start-game-btn">Starta spel</button>
      <Link to="/poker">Tillbaka</Link>
    </div>
  );
}
