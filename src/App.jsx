import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Poker from "./pages/Poker";
import PokerRoom from "./pages/PokerRoom";
import PokerTableView from "./pages/PokerTableView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/poker" element={<Poker />} />
        <Route path="/poker/:id" element={<PokerRoom />} />
        <Route path="/poker/:id/play" element={<PokerTableView />} />
      </Routes>
    </BrowserRouter>
  );
}
