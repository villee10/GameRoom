import './Dice.css';
import dice1 from '../images/dice1.png';
import dice2 from '../images/dice2.png';
import dice3 from '../images/dice3.png';
import dice4 from '../images/dice4.png';
import dice5 from '../images/dice5.png';
import dice6 from '../images/dice6.png';

import { useState } from 'react';  




export default function Dice() 
{
 var diceImages = [dice1, dice2, dice3, dice4, dice5, dice6];



const [image, setImage] = useState(diceImages[0]);
const [image2, setImage2] = useState(diceImages[1]);

const rollDice = () => {
    //generate random number
    var randomNum1 = Math.floor(Math.random() * 6);
    var randomNum2 = Math.floor(Math.random() * 6);
    setImage(diceImages[randomNum1]);
    setImage2(diceImages[randomNum2]);
}



  return (
    <div>
      <center>
        <h1>Dice Game</h1>
        <div className="container">
        <img className="square" src={image}></img>
        <div style={{width: "5px", display: "inline-block"}}></div>
        <img className="square" src={image2}></img>
        </div>
        <button type="button" className="button-roll" onClick={rollDice}>roll</button>
        </center>
    </div>
  );
}