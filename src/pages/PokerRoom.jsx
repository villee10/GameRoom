import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";
import "./PokerRoom.css";

export default function PokerRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);

  // Spärrar så att React StrictMode inte skapar dubbla inserts
  const playerCreatedRef = useRef(false);
  const roomstateCreatedRef = useRef(false);

  // ---------------------------------------------------------
  // 🔐 Hämta session + profil
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) return;

      const uid = session.user.id;
      setUserId(uid);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .single();

      if (profileData) setProfile(profileData);
    }

    loadProfile();
  }, []);

  // ---------------------------------------------------------
  // 🟢 Skapa roomstate om den saknas (med anti-dubbel-insert)
  // ---------------------------------------------------------
  async function createRoomStateIfMissing() {
    if (roomstateCreatedRef.current) return; // skydd
    roomstateCreatedRef.current = true;

    const { data } = await supabase
      .from("roomstate")
      .select("*")
      .eq("room_id", id)
      .maybeSingle();

    if (!data) {
      console.log("Roomstate saknas → Skapar ny...");

      // Använd upsert för att göra operationen idempotent vid dubbel-render
      const { error } = await supabase
        .from("roomstate")
        .upsert(
          [
            {
              room_id: id,
              community_cards: [],
              has_started: false,
              countdown: null,
              hands: {},
            },
          ],
          { onConflict: "room_id" }
        )
        .select();

      if (error) {
        console.log("Roomstate upsert error (ignored if conflict):", error);
      }
    }
  }

  // ---------------------------------------------------------
  // 🟢 Lägg till spelare EN gång (med anti-dubbel-insert)
  // ---------------------------------------------------------
  async function ensurePlayerExists(username) {
    if (playerCreatedRef.current) return;
    if (!userId || !username) return;

    // Finns spelaren redan?
    const { data: existing } = await supabase
      .from("roomplayers")
      .select("id")
      .eq("room_id", id)
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      console.log("Player already exists → skip insert.");
      playerCreatedRef.current = true;
      return;
    }

    // Hämta använda seats
    const { data: others } = await supabase
      .from("roomplayers")
      .select("seat")
      .eq("room_id", id);

    const usedSeats = (others || [])
      .map((p) => p.seat)
      .filter((s) => s !== null);

    let seat = 0;
    while (usedSeats.includes(seat)) seat++;

    // Skapa spelaren
    const { data: upserted, error } = await supabase
      .from("roomplayers")
      .upsert(
        [
          {
            room_id: id,
            id: userId,
            name: username,
            seat,
            is_ready: false,
            is_connected: true,
          },
        ],
        { onConflict: "id" }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("Upsert player error:", error);
    } else {
      console.log("Player upserted in room", upserted);
    }

    playerCreatedRef.current = true;
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

    setPlayers(data || []);
  }

  // ---------------------------------------------------------
  // 👑 Ladda owner
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
    navigate("/poker");
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
    if (profile?.username && userId) {
      ensurePlayerExists(profile.username);
      createRoomStateIfMissing();
      loadPlayers();
      loadOwner();
    }
  }, [profile, userId]);

  // ---------------------------------------------------------
  // 📡 Realtid - Lyssna på spelare & navigering
  // ---------------------------------------------------------
  useEffect(() => {
    // 1. Lyssna på nya spelare
    const playersChannel = supabase
      .channel(`room_${id}_players`)
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

    // 2. Lyssna på "Start Game" signal (countdown = 3)
    const gameChannel = supabase
      .channel(`room_wait_${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roomstate",
          filter: `room_id=eq.${id}`,
        },
        (payload) => {
          // Om countdown blir 3, gå till bordet!
          if (payload.new && payload.new.countdown === 3) {
            console.log("Spelet startar! Navigerar till bordet...");
            navigate(`/poker/${id}/play`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(gameChannel);
    };
  }, [id, navigate]); // Viktigt att id och navigate är med här

  // ---------------------------------------------------------
  // ▶️ Starta spelet (Leader Only)
  // ---------------------------------------------------------
  async function startGame() {
    // Se till att roomstate finns (fallback)
    const { data: existing } = await supabase
      .from("roomstate")
      .select("*")
      .eq("room_id", id)
      .single();

    if (!existing) {
      await supabase.from("roomstate").insert({
        room_id: id,
        community_cards: [],
        hands: {},
        has_started: false,
        countdown: 3,
      });
    }

    // Uppdatera countdown till 3 -> Detta triggar lyssnaren ovan för ALLA
    await supabase
      .from("roomstate")
      .update({ countdown: 3, has_started: false })
      .eq("room_id", id);
      
    // Vi navigerar INTE manuellt här längre. Lyssnaren sköter det.
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="poker-page">
      <div className="player-info">
        <strong>{profile?.username}</strong>
        {isOwner && <span style={{ color: "gold" }}> (Leader)</span>}
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
              {String(p.id) === String(userId) && " (du)"}
              {String(p.id) === String(ownerId) && " ⭐"}
            </span>

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
        <button className="start-game-btn" onClick={startGame}>
          Starta spel
        </button>
      )}

      <button className="leave-btn" onClick={leaveRoom}>
        Lämna rummet
      </button>

      <Link to="/poker" className="back-link">
        Tillbaka
      </Link>
    </div>
  );
}