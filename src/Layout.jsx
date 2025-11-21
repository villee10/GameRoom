import { useEffect, useState } from "react";
import supabase from "./supabaseClient";
import { Link } from "react-router-dom";

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getSession();

      if (data?.session?.user) {
        const u = data.session.user;
        setUser(u);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.id)
          .single();

        setProfile(profileData);
      }
    }

    loadUser();

    // lyssna på auth förändringar
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <div style={{
        width: "100%",
        padding: "15px 12px 15px 25px",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        background: "rgba(0,0,0,0.4)",
        color: "white",
        fontSize: "16px",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 20
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <Link to="/" style={{ color: "white", textDecoration: "none" }}>
            Home
          </Link>
        </div>

        {/* Place logout a bit in from the right edge */}
        {profile ? (
          <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", marginRight: "80px" }}>
            <button 
              onClick={logout}
              style={{
                background: "green",
                border: "none",
                padding: "8px 15px",
                borderRadius: "5px",
                color: "white",
                cursor: "pointer"
              }}>
              Logga ut
            </button>
          </div>
        ) : (
          <Link to="/login" style={{ color: "white", marginLeft: "auto", marginRight: "80px" }}>
            Logga in
          </Link>
        )}
      </div>

      <div style={{ marginTop: "80px" }}>
        {children}
      </div>
    </>
  );
}
