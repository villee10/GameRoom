import { useState, useEffect, useRef } from "react";
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
  const [userId, setUserId] = useState(null);
  const [ownerId, setOwnerId] = useState(null);
  
  // Ref för att förhindra att loopen körs dubbelt
  const hasStartedLoopRef = useRef(false);

  const isOwner = ownerId && userId && String(ownerId) === String(userId);

  // ---------------------------------------------------------
  // 1. Init & Realtid
  // ---------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      setUserId(sessionData?.session?.user?.id);

      const { data: roomData } = await supabase.from("rooms").select("owner_id").eq("id", id).single();
      if (roomData) setOwnerId(roomData.owner_id);
    }
    init();

    loadPlayers();
    loadGame();

    const channel = supabase
      .channel(`room_${id}_main`)
      .on("postgres_changes", { event: "*", schema: "public", table: "roomplayers", filter: `room_id=eq.${id}` }, loadPlayers)
      .on("postgres_changes", { event: "*", schema: "public", table: "roomstate", filter: `room_id=eq.${id}` }, loadGame)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  async function loadPlayers() {
    const { data } = await supabase.from("roomplayers").select("*").eq("room_id", id).order("seat", { ascending: true });
    setPlayers(data || []);
  }

  async function loadGame() {
    const { data } = await supabase.from("roomstate").select("*").eq("room_id", id).maybeSingle();
    setGame(data);
  }

  // ---------------------------------------------------------
  // 2. AUTO-START LOGIK (Endast för Leadern)
  // ---------------------------------------------------------
  useEffect(() => {
    // Om vi inte är owner, eller datan inte laddats än, eller loopen redan körts -> Avbryt.
    if (!isOwner || !game || !players.length) return;
    if (hasStartedLoopRef.current) return;

    // SCENARIO: Vi kommer från Lobbyn. Countdown är satt till 3, men spelet har inte startat (hands är tomt/has_started false).
    // Då tar Leadern befälet och kör loopen.
    if (game.countdown === 3 && !game.has_started) {
      console.log("Leader upptäcker start-signal -> Kör countdown-loop!");
      hasStartedLoopRef.current = true; // Lås så vi inte kör igen
      runAutoSequence();
    }
  }, [isOwner, game, players]);

  async function runAutoSequence() {
    // Vänta lite kort så alla hinner ladda sidan (valfritt, men bra för "känslan")
    await new Promise((r) => setTimeout(r, 1000));

    // Nedräkning: 3 -> 2 -> 1
    for (let i = 3; i > 0; i--) {
      await supabase.from("roomstate").update({ countdown: i }).eq("room_id", id);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Dela ut kort!
    const deck = shuffle(createDeck());
    const { hands } = dealHands(deck, players);

    await supabase
      .from("roomstate")
      .update({
        countdown: 0,
        has_started: true,
        hands: hands,
      })
      .eq("room_id", id);
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="poker-table-page">
      <div className="poker-header">
        <span className="room-id">Rum: {id}</span>
        <Link to={`/poker/${id}`} className="back-link">Avsluta</Link>
      </div>

      {/* COUNTDOWN OVERLAY */}
      {game?.countdown !== null && game?.countdown > 0 && (
        <div className="countdown-overlay">
          <div className="countdown-number">{game.countdown}</div>
          <p>Delar ut korten...</p>
        </div>
      )}

      {/* BORDET */}
      <div className="table-container">
        <div className="table-wrapper">
          <div className="table-area">
            
            <div className="community-cards">
              {game?.community_cards?.map((c, i) => (
                <div className="card" key={i}>{c}</div>
              ))}
            </div>

            {seatPositions.map((pos, i) => {
              const p = players[i];
              const isMe = p && String(p.id) === String(userId);
              const myHand = game?.hands && p ? game.hands[p.id] : null;

              return (
                <div key={i} className={`seat-box ${p ? "taken" : "empty"}`} style={{ top: pos.top, left: pos.left }}>
                  {p && (
                    <>
                      {game?.has_started && (
                        <div className="hand-container">
                          {isMe && myHand ? (
                            myHand.map((card, idx) => <div key={idx} className="poker-card front">{card}</div>)
                          ) : (
                            <>
                              <div className="poker-card back"></div>
                              <div className="poker-card back"></div>
                            </>
                          )}
                        </div>
                      )}
                      <div className="player-info-box">
                        <div className="player-name">{p.name} {isOwner && String(p.id) === String(ownerId) ? "👑" : ""}</div>
                        <div className="player-money">1000 kr</div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* INGEN KNAPP HÄR LÄNGRE - ALLT SKER AUTOMATISKT */}
    </div>
  );
}