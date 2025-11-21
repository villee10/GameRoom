import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";
import "./PokerRoom.css";

export default function PokerRoom() {
  const { id } = useParams();

  const [players, setPlayers] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);

  // ---------------------------------------------------------
  // 🔐 Hämta inloggad användare + profil
  // ---------------------------------------------------------
  async function loadProfile() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const uid = session.session.user.id;
    setUserId(uid);

    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .single();

    if (data) setProfile(data);
  }

  // ---------------------------------------------------------
  // 🟢 Se till att spelaren finns i roomplayers
  // ---------------------------------------------------------
  async function ensurePlayerExists(username) {
  if (!userId || !username) return;

  // 1. Kontrollera om spelaren redan finns i roomet
  const { data: existing, error } = await supabase
    .from("roomplayers")
    .select("id")
    .eq("room_id", id)
    .eq("id", userId)
    .maybeSingle();

  // 2. Om spelaren redan finns – gör INGENTING
  if (existing) {
    console.log("Player already in room, skip insert.");
    return;
  }

  // 3. Skapa spelaren EN gång
  const { error: insertError } = await supabase
    .from("roomplayers")
    .insert({
      room_id: id,
      id: userId,      // supabase auth user id
      name: username,  // login-namnet (ville)
      is_connected: true,
      is_ready: false,
    });

  if (insertError) {
    console.error("Insert player error:", insertError);
  } else {
    console.log("Player inserted correctly");
  }
}






  // ---------------------------------------------------------
  // 🔄 Hämta spelare
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
  // 👑 Hämta owner
  // ---------------------------------------------------------
  async function loadOwner() {
    const { data } = await supabase
      .from("rooms")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (data) {
      setOwnerId(data.owner_id);
      setIsOwner(String(data.owner_id) === String(userId));
    }
  }

  // ---------------------------------------------------------
  // 🚪 Lämna rummet
  // ---------------------------------------------------------
  async function leaveRoom() {
    await supabase.from("roomplayers").delete().eq("id", userId);
    window.location.href = "/poker";
  }

  // ---------------------------------------------------------
  // ❌ Kicka spelare
  // ---------------------------------------------------------
  async function kickPlayer(pid) {
    if (!isOwner) return;
    await supabase.from("roomplayers").delete().eq("id", pid);
  }

  // ---------------------------------------------------------
  // INIT
  // ---------------------------------------------------------
  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile?.username && userId) {
      ensurePlayerExists(profile.username);
      loadPlayers();
      loadOwner();
    }
  }, [profile, userId]);

  // ---------------------------------------------------------
  // Realtid
  // ---------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`room_${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "roomplayers", filter: `room_id=eq.${id}` },
        loadPlayers
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ---------------------------------------------------------
  // Starta spelet
  // ---------------------------------------------------------
  async function startGame() {
    const { error } = await supabase
      .from("roomstate")
      .update({
        has_started: true,
        countdown: 3,
      })
      .eq("room_id", id);

    if (!error) {
      window.location.href = `/poker/${id}/play`;
    }
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  // If no players are returned yet, show the current profile as a fallback
  const playersToShow = (players && players.length > 0)
    ? players
    : profile && profile.username
      ? [{ id: userId || "me", name: profile.username }]
      : [];
  return (
    <div className="poker-page">
      <div className="player-info">
        <strong>{profile?.username}</strong>
        {isOwner && <span style={{ color: "gold" }}>(Leader)</span>}
      </div>

      <h2>♠️ Poker Rum</h2>

      <p>Rum-ID: <strong>{id}</strong></p>

      <h3>Spelare i rummet:</h3>

      <ul className="player-list">
        {playersToShow.map((p) => (
          <li key={p.id} className="player-item">
            <span className="player-name">
              {p.name}
              {String(p.id) === String(userId) && " (du)"}
              {String(p.id) === String(ownerId) && " ⭐"}
            </span>

            {isOwner && String(p.id) !== String(ownerId) && (
              <button onClick={() => kickPlayer(p.id)} className="remove-player-btn">
                ✖
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <button onClick={startGame} className="start-game-btn">
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
