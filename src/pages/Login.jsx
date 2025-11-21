import { useState } from "react";
import supabase from "../supabaseClient";
import "./login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState("login"); // login | signup

  async function handleSignup() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    // Create profile row
    await supabase.from("profiles").insert({
      id: data.user.id,
      username
    });

    alert("Konto skapat! Du kan logga in nu.");
    setMode("login");
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/"; // ändra till lobby om du vill
  }

  return (
    <div className="login-container">
      <h2>{mode === "login" ? "Logga in" : "Skapa konto"}</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Lösenord"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {mode === "signup" && (
        <input
          placeholder="Användarnamn"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      )}

      {mode === "login" ? (
        <button onClick={handleLogin}>Logga in</button>
      ) : (
        <button onClick={handleSignup}>Skapa konto</button>
      )}

      <p onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login"
          ? "Har du inget konto? Skapa ett →"
          : "Har du redan konto? Logga in →"}
      </p>
    </div>
  );
}
