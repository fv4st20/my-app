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
  
  // Auth & Leaderboard State
  const [user, setUser] = useState(null);
  const [gameChallenge, setGameChallenge] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);

  const audioCtxRef = useRef(null);

  // Check user session
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data && data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard/alien-echo?limit=25');
      const data = await res.json();
      if (data && data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.warn('Failed to fetch leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

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
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + (duration/1000));

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

  const startGame = async () => {
    initAudio();
    setSequence([]);
    setPlayerInput([]);
    setScore(0);
    setLastSubmission(null);
    setStatus('PREPARING...');

    // Request anti-cheat game session challenge
    try {
      const res = await fetch('/api/leaderboard/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'alien-echo' })
      });
      const data = await res.json();
      if (data && data.success) {
        setGameChallenge(data.challenge);
      }
    } catch (e) {}

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
    
    const playSpeed = Math.max(200, 600 - (newSeq.length * 20)); 
    
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

  const submitScoreToLeaderboard = async (finalScore) => {
    if (finalScore <= 0) return;
    try {
      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'alien-echo',
          score: finalScore,
          challenge: gameChallenge,
          username: user ? user.username : 'Guest Pilot',
          details: { rounds: finalScore }
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setLastSubmission({
          rank: data.rank,
          username: data.entry.username,
          isRegistered: data.isRegistered
        });
      }
    } catch (e) {
      console.warn('Score submission error:', e);
    }
  };

  const handleAlienClick = (id) => {
    if (!isPlayerTurn) return;
    
    initAudio();
    activateAlien(id, 300);
    
    const newInput = [...playerInput, id];
    setPlayerInput(newInput);

    const currentIndex = newInput.length - 1;
    if (newInput[currentIndex] !== sequence[currentIndex]) {
      // Game Over
      playTone(100, 1000);
      setIsPlayerTurn(false);
      setStatus(`GAME OVER! FINAL SCORE: ${score}`);
      setSequence([]);

      // Submit score
      submitScoreToLeaderboard(score);
      return;
    }

    if (newInput.length === sequence.length) {
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

      <button 
        className="leaderboard-btn-top" 
        onClick={() => {
          fetchLeaderboard();
          setShowLeaderboard(true);
        }}
        title="View Global Leaderboard"
      >
        🏆 Leaderboard
      </button>

      <div className="header">
        <h1>Alien Echo</h1>
        <div className="score-board">SCORE: {score}</div>
        {user ? (
          <div className="user-indicator">Pilot: <strong>{user.username}</strong> <span className="verified-badge">✓</span></div>
        ) : (
          <div className="guest-indicator">Playing as Guest • <a href="/" style={{color:'#38bdf8'}}>Sign In</a> for verified rank</div>
        )}
      </div>

      <div className="status-msg">{status}</div>

      {lastSubmission && (
        <div className="submission-banner">
          🚀 Score submitted to Global Leaderboard! 
          {lastSubmission.rank && <span> Global Rank: <strong>#{lastSubmission.rank}</strong></span>}
        </div>
      )}

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

      {/* In-Game Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="leaderboard-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏆 Alien Echo Global Hall of Fame</h2>
              <button className="close-btn" onClick={() => setShowLeaderboard(false)}>&times;</button>
            </div>
            
            <div className="leaderboard-scroll">
              {loadingLeaderboard ? (
                <p style={{textAlign:'center', padding:'20px', color:'#94a3b8'}}>Loading records...</p>
              ) : leaderboard.length === 0 ? (
                <p style={{textAlign:'center', padding:'20px', color:'#94a3b8'}}>No scores yet! Play a round to claim #1.</p>
              ) : (
                <table className="lb-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Pilot</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(entry => (
                      <tr key={entry.id} className={user && user.username === entry.username ? 'highlight-row' : ''}>
                        <td><span className={`rank-tag rank-${entry.rank}`}>#{entry.rank}</span></td>
                        <td>
                          <strong>{entry.username}</strong>
                          {entry.isVerified && <span className="v-check">✓</span>}
                        </td>
                        <td className="score-cell">{entry.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button className="close-modal-btn" onClick={() => setShowLeaderboard(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
