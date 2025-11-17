import { Link } from "react-router-dom";
import supabase from "../supabaseClient";
import "./Poker.css";

export default function Poker() {

async function createRoom() {
  const ownerId = localStorage.getItem("playerId");

  const roomId = Math.random().toString(36).substring(2, 8);

  const { error } = await supabase.from("rooms").insert([
    {
      id: roomId,
      owner_id: ownerId   // läggs in direkt här
    }
  ]);

  if (error) {
    console.error("Kunde inte skapa rum:", error);
    alert("Ett fel uppstod!");
    return;
  }

  // Skicka användaren till rummet
  window.location.href = `/poker/${roomId}`;
} 




async function testSupabase() {
  const { data, error } = await supabase
    .from("rooms")
    .select("*");

  if (error) {
    console.error("Fel vid hämtning:", error);
  } else {
    console.log("RUMDATA:", data);
  }
}
testSupabase();


  async function joinRoom() {
    const roomId = prompt("Ange rum-ID:");
    if (!roomId) return;

    //  Kolla om rummet finns i databasen
    const { data, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .single();




    if (error || !data) {
      alert(" Rummet finns inte!");
      return;
    }

    //  Om det finns, gå in
    window.location.href = `/poker/${roomId}`;
  }



  return (
  <div className="poker-page">
    <h2 className="header">♠️ Poker</h2>

    <div className="poker-buttons">
      <button onClick={createRoom}>Skapa rum</button>
      <button onClick={joinRoom}>Gå med i rum</button>
    </div>

    <Link to="/">Tillbaka</Link>
  </div>
);
}