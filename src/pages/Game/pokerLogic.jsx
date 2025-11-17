export function createDeck() {
  const suits = ["S", "H", "D", "C"]; 
  const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  const deck = [];
  for (let s of suits)
    for (let r of ranks)
      deck.push(r + s);

  return deck;
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Deal två kort till varje spelare
export function dealHands(deck, players) {
  const hands = {};
  let pos = 0;

  players.forEach(p => {
    hands[p.id] = [ deck[pos], deck[pos+1] ];
    pos += 2;
  });

  return { hands, remaining: deck.slice(pos) };
}
