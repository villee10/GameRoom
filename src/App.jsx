import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Poker from "./pages/Poker/Poker";
import PokerRoom from "./pages/Poker/PokerRoom";
import PokerTableView from "./pages/Poker/PokerTableView";
import Login from "./pages/Login";
import Layout from "./Layout";
import Dice from "./Dice/Dice";


export default function App() {
  return (
    <BrowserRouter>
      <Layout> {/* Allt ligger i Layout */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/poker" element={<Poker />} />
          <Route path="/poker/:id" element={<PokerRoom />} />
          <Route path="/poker/:id/play" element={<PokerTableView />} />
          <Route path="/dice" element={<Dice />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
