import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../../supabaseClient";
import "./Poker.css";

export default function Poker() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const userId = session.session.user.id;

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      if (data) setProfile(data);
    }

    loadProfile();
  }, []);

  async function createRoom() {
    if (!profile) return alert("Profil saknas?");

    // Hämta inloggad användare
    const session = await supabase.auth.getSession();
    const userId = session.data.session.user.id;

    const roomId = Math.random().toString(36).substring(2, 8);

    // Skapa rummet (INGA roomplayers här!)
    const { error } = await supabase
      .from("rooms")
      .insert([{ id: roomId, owner_id: userId }]);

    if (error) {
      console.error(error);
      alert("Kunde inte skapa rum");
      return;
    }

    // Gå till rummet
    window.location.href = `/poker/${roomId}`;
  }

  async function joinRoom() {
    if (!profile) return alert("Profil saknas?");

    const roomId = prompt("Ange rum-ID:");
    if (!roomId) return;

    const { data } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .single();

    if (!data) return alert("Rummet finns inte!");

    window.location.href = `/poker/${roomId}`;
  }

  return (
    <div className="poker-page">
      <h2 className="header">♠️ Poker</h2>

      <p style={{ marginBottom: "20px", opacity: 0.7 }}>
        Inloggad som: <strong>{profile?.username}</strong>
      </p>

      <div className="poker-buttons">
        <button onClick={createRoom}>Skapa rum</button>
        <button onClick={joinRoom}>Gå med i rum</button>
      </div>

      <Link to="/">Tillbaka</Link>
    </div>
  );
}
