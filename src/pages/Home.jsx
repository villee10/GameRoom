import { Link } from "react-router-dom";
import "./Home.css";


export default function Home() {
  return (
    <div className="GameRoom">
      <h1>GameRoom</h1>
      <p>Välj ett spel:</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li><Link to="/poker">Poker</Link></li>
      </ul>
      </div>
  );
}
