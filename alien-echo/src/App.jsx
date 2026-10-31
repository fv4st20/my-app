import React, { useState, useEffect, useRef } from 'react';
import './index.css';

// 0: Green (Top), 1: Red (Right), 2: Blue (Bottom), 3: Yellow (Left)
const ALIENS = [
  { id: 0, color: 'green', position: 'top', freq: 392.00, emoji: '👽' }, // G4
  { id: 1, color: 'red', position: 'right', freq: 329.63, emoji: '🤖' }, // E4
  { id: 2, color: 'blue', position: 'bottom', freq: 523.25, emoji: '👾' }, // C5
  { id: 3, color: 'yellow', position: 'left', freq: 261.63, emoji: '🛸' }  // C4
];

const AlienIcon = ({ type }) => {
  const alien = ALIENS.find(a => a.id === type);
  return <div className="alien-emoji">{alien.emoji}</div>;
};

function App() {
  const [sequence, setSequence] = useState([]);
  const [playerInput, setPlayerInput] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [activeAlien, setActiveAlien] = useState(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('PRESS START');
  
  const audioCtxRef = useRef(null);

  // Initialize Audio
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTone = (freq, duration = 300) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Sci-fi synth tone
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Filter sweep for retro feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + (duration/1000));

    // Envelope
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (duration/1000));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + (duration/1000));
  };

  const activateAlien = (id, duration = 400) => {
    setActiveAlien(id);
    const freq = ALIENS.find(a => a.id === id).freq;
    playTone(freq, duration);
    setTimeout(() => {
      setActiveAlien(null);
    }, duration - 100);
  };

  const startGame = () => {
    initAudio();
    setSequence([]);
    setPlayerInput([]);
    setScore(0);
    setStatus('PREPARING...');
    setTimeout(() => {
      nextRound([]);
    }, 1000);
  };

  const nextRound = (currentSeq) => {
    setIsPlayerTurn(false);
    setStatus('WATCH CLOSELY');
    const newAlien = Math.floor(Math.random() * 4);
    const newSeq = [...currentSeq, newAlien];
    setSequence(newSeq);
    setPlayerInput([]);
    
    // Speed increases as score goes up
    const playSpeed = Math.max(200, 600 - (newSeq.length * 20)); 
    
    // Play sequence
    let i = 0;
    const interval = setInterval(() => {
      activateAlien(newSeq[i], playSpeed);
      i++;
      if (i >= newSeq.length) {
        clearInterval(interval);
        setTimeout(() => {
          setIsPlayerTurn(true);
          setStatus('YOUR TURN');
        }, playSpeed + 200);
      }
    }, playSpeed + 200);
  };

  const handleAlienClick = (id) => {
    if (!isPlayerTurn) return;
    
    initAudio();
    activateAlien(id, 300);
    
    const newInput = [...playerInput, id];
    setPlayerInput(newInput);

    // Validate
    const currentIndex = newInput.length - 1;
    if (newInput[currentIndex] !== sequence[currentIndex]) {
      // Game Over
      playTone(100, 1000); // Error buzz
      setIsPlayerTurn(false);
      setStatus(`GAME OVER! SCORE: ${score}`);
      setSequence([]);
      return;
    }

    if (newInput.length === sequence.length) {
      // Round complete
      setIsPlayerTurn(false);
      setScore(s => s + 1);
      setStatus('CORRECT!');
      setTimeout(() => {
        nextRound(sequence);
      }, 1000);
    }
  };

  return (
    <div className="game-container">
      <a href="/" className="return-btn" title="Return to Hub">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      </a>
      <div className="header">
        <h1>Alien Echo</h1>
        <div className="score-board">SCORE: {score}</div>
      </div>

      <div className="status-msg">{status}</div>

      <div className="alien-grid">
        {ALIENS.map(alien => (
          <button 
            key={alien.id}
            className={`alien-btn alien-${alien.position} ${activeAlien === alien.id ? 'active' : ''}`}
            onMouseDown={() => handleAlienClick(alien.id)}
            disabled={!isPlayerTurn && sequence.length > 0}
          >
            <AlienIcon type={alien.id} />
          </button>
        ))}

        <div className="center-control">
          {sequence.length === 0 && (
            <button className="start-btn" onClick={startGame}>START</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
