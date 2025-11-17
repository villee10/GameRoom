import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";
import "./PokerRoom.css";
import { createDeck, shuffle, dealHands } from "./Game/pokerLogic";

export default function PokerRoom() {
  const { id } = useParams();
  const [players, setPlayers] = useState([]);

  // Hämta spelare
  async function loadPlayers() {
    const { data } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id);

    setPlayers(data || []);
  }

  // När man joinar → markera connected = true
 async function joinRoom() {
  const name = document.getElementById("playerName").value;
  if (!name.trim()) return alert("Skriv namn!");

  const { data, error } = await supabase
    .from("roomplayers")
    .insert([{ 
      room_id: id,
      name,
      is_connected: true,
      is_ready: false
    }])
    .select();

  if (error) return console.error(error);

  localStorage.setItem("playerId", data[0].id);

  // 🔥 FIX: Se till att roomstate finns
  await supabase.from("roomstate").upsert({
    room_id: id,
    deck: [],
    player_hands: {},
    community_cards: [],
    phase: "waiting",
    has_started: false,
    required_players: null
  });

  loadPlayers();
}

async function ensureRoomState() {
  const { data, error } = await supabase
    .from("roomstate")
    .select("*")
    .eq("room_id", id)
    .maybeSingle();

  // Finns redan → bra!
  if (data) return;

  // Skapa ny rad
  await supabase.from("roomstate").insert([
    {
      room_id: id,
      required_players: null,
      has_started: false,
      countdown: null,
      deck: [],
      player_hands: {},
      community_cards: [],
      phase: "waiting"
    }
  ]);
}



  // Starta spel → skapar kortleken i roomstate
  async function startGame() {
    const { data: players } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", id);

    if (!players || players.length === 0) {
      return alert("Inga spelare i rummet!");
    }

    let deck = shuffle(createDeck());
    const { hands, remaining } = dealHands(deck, players);

    await supabase.from("roomstate").upsert({
      room_id: id,
      deck: remaining,
      player_hands: hands,
      community_cards: [],
      phase: "preflop",
      has_started: false // 👈 viktigt — spelet startar INTE här
    });

    // bara gå till table view — countdown sker senare
    window.location.href = `/poker/${id}/play`;
  }

  useEffect(() => {
    loadPlayers();

    const channel = supabase
      .channel(`room_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roomplayers", filter: `room_id=eq.${id}` },
        loadPlayers
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function removePlayer(playerId) {
    await supabase.from("roomplayers").delete().eq("id", playerId);
    loadPlayers();
  }

  return (
    <div className="poker-page">
      <h2>♠️ Poker Rum</h2>
      <p>Rum-ID: <strong>{id}</strong></p>

      <input id="playerName" placeholder="Ditt namn" />
      <button onClick={joinRoom}>Gå med i rummet</button>

      <h3>Spelare i rummet:</h3>

     
     <ul className="player-list">
  {players.map(p => (
    <li className="player-item" key={p.id}>
      <span className="player-name">{p.name}</span>
      <button
        className="remove-player-btn"
        onClick={() => removePlayer(p.id)}
      >-</button>
    </li>
  ))}
</ul>



      <button onClick={startGame} className="start-game-btn">
        Starta spel
      </button>

      <Link to="/poker">Tillbaka</Link>
    </div>
  );
}
