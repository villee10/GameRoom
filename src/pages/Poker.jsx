import { useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";

export default function Poker() {
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("playerName") || ""
  );

  async function createRoom() {
    const trimmed = playerName.trim();
    if (!trimmed) return alert("Skriv in ditt namn!");

    localStorage.setItem("playerName", trimmed);

    const roomId = Math.random().toString(36).substring(2, 8);

    const { error } = await supabase.from("rooms").insert([
      {
        id: roomId,
        owner_id: null,
      },
    ]);

    if (error) {
      console.error(error);
      return alert("Kunde inte skapa rum.");
    }

    window.location.href = `/poker/${roomId}`;
  }

  async function joinRoom() {
    const trimmed = playerName.trim();
    if (!trimmed) return alert("Skriv in ditt namn!");

    localStorage.setItem("playerName", trimmed);

    const roomId = prompt("Ange rum-ID:");
    if (!roomId) return;

    const { data, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .single();

    if (error || !data) return alert("Rummet finns inte!");

    window.location.href = `/poker/${roomId}`;
  }

  return (
    <div className="poker-page">
      <h2 className="header">♠️ Poker</h2>

      <input
        className="name-input"
        placeholder="Ditt namn"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />

      <div className="poker-buttons">
        <button onClick={createRoom}>Skapa rum</button>
        <button onClick={joinRoom}>Gå med i rum</button>
      </div>

      <Link to="/">Tillbaka</Link>
    </div>
  );
}
