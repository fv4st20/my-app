import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// 0: Green (Top), 1: Red (Right), 2: Blue (Bottom), 3: Yellow (Left)
const ALIENS = [
  { id: 0, color: 'green', position: 'top', freq: 392.0, emoji: '👽' },
  { id: 1, color: 'red', position: 'right', freq: 329.63, emoji: '🤖' },
  { id: 2, color: 'blue', position: 'bottom', freq: 523.25, emoji: '👾' },
  { id: 3, color: 'yellow', position: 'left', freq: 261.63, emoji: '🛸' }
];

function pickRandomAlienId() {
  return Math.floor(Math.random() * ALIENS.length);
}

const AlienIcon = ({ type }) => {
  const alien = ALIENS.find(a => a.id === type);
  return <div className="alien-emoji">{alien ? alien.emoji : '👽'}</div>;
};

function App() {
  const [sequence, setSequence] = useState([]);
  const [playerInput, setPlayerInput] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [activeAlien, setActiveAlien] = useState(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('PRESS START');
  const [muted, setMuted] = useState(false);

  // Auth & Leaderboard State
  const [user, setUser] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  const audioCtxRef = useRef(null);
  const mutedRef = useRef(false);
  const challengeRef = useRef(null);
  const runIdRef = useRef(0);
  const activePadTimerRef = useRef(null);
  const roundDelayTimerRef = useRef(null);
  const seqIntervalRef = useRef(null);
  const turnTimerRef = useRef(null);

  const clearGameTimers = useCallback(() => {
    if (activePadTimerRef.current) {
      clearTimeout(activePadTimerRef.current);
      activePadTimerRef.current = null;
    }
    if (roundDelayTimerRef.current) {
      clearTimeout(roundDelayTimerRef.current);
      roundDelayTimerRef.current = null;
    }
    if (seqIntervalRef.current) {
      clearInterval(seqIntervalRef.current);
      seqIntervalRef.current = null;
    }
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const stopCurrentSession = useCallback(() => {
    runIdRef.current += 1;
    clearGameTimers();
  }, [clearGameTimers]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Check user session & clean up timers + AudioContext on unmount
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      stopCurrentSession();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [stopCurrentSession]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard/alien-echo?limit=25', {
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch {
      // Network error ignored
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        try {
          audioCtxRef.current = new AudioContextCtor();
        } catch {
          audioCtxRef.current = null;
        }
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const playTone = useCallback((freq, duration = 300) => {
    if (mutedRef.current || !audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
    try {
      const ctx = audioCtxRef.current;
      const durSec = Math.max(0.08, duration / 1000);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + durSec);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + Math.min(0.04, durSec * 0.4));
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + durSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc.start();
      osc.stop(ctx.currentTime + durSec);
    } catch {
      // Ignore WebAudio transient errors
    }
  }, []);

  const activateAlien = useCallback((id, duration = 400) => {
    const alien = ALIENS.find(a => a.id === id);
    if (!alien) return;
    setActiveAlien(id);
    playTone(alien.freq, duration);

    if (activePadTimerRef.current) {
      clearTimeout(activePadTimerRef.current);
    }
    activePadTimerRef.current = setTimeout(() => {
      setActiveAlien(null);
      activePadTimerRef.current = null;
    }, Math.max(80, duration - 100));
  }, [playTone]);

  const nextRound = useCallback((currentSeq, activeRunId) => {
    if (activeRunId !== runIdRef.current) return;
    setIsPlayerTurn(false);
    setStatus('WATCH CLOSELY');

    const newAlien = pickRandomAlienId();
    const newSeq = [...currentSeq, newAlien];
    setSequence(newSeq);
    setPlayerInput([]);

    const playSpeed = Math.max(200, 600 - newSeq.length * 20);

    let i = 0;
    if (seqIntervalRef.current) clearInterval(seqIntervalRef.current);
    seqIntervalRef.current = setInterval(() => {
      if (activeRunId !== runIdRef.current) {
        clearInterval(seqIntervalRef.current);
        seqIntervalRef.current = null;
        return;
      }
      activateAlien(newSeq[i], playSpeed);
      i++;
      if (i >= newSeq.length) {
        clearInterval(seqIntervalRef.current);
        seqIntervalRef.current = null;
        turnTimerRef.current = setTimeout(() => {
          if (activeRunId !== runIdRef.current) return;
          setIsPlayerTurn(true);
          setStatus('YOUR TURN');
        }, playSpeed + 200);
      }
    }, playSpeed + 200);
  }, [activateAlien]);

  const startGame = async () => {
    if (isPlaying) return;
    initAudio();
    clearGameTimers();

    const activeRunId = ++runIdRef.current;
    challengeRef.current = null;

    setIsPlaying(true);
    setIsPlayerTurn(false);
    setActiveAlien(null);
    setSequence([]);
    setPlayerInput([]);
    setScore(0);
    setLastSubmission(null);
    setSubmissionError(null);
    setStatus('PREPARING...');

    try {
      const res = await fetch('/api/leaderboard/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'alien-echo' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.challenge && activeRunId === runIdRef.current) {
          challengeRef.current = data.challenge;
        }
      }
    } catch {
      // Offline or unauthenticated
    }

    if (activeRunId !== runIdRef.current) return;
    roundDelayTimerRef.current = setTimeout(() => {
      nextRound([], activeRunId);
    }, 1000);
  };

  const submitScoreToLeaderboard = async (finalScore) => {
    if (!Number.isFinite(finalScore) || finalScore <= 0) return;
    const consumedChallenge = challengeRef.current;
    challengeRef.current = null;

    try {
      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'alien-echo',
          score: Math.min(100, Math.floor(finalScore)),
          challenge: consumedChallenge,
          username: user ? user.username : 'Guest_Pilot',
          details: { rounds: Math.floor(finalScore) }
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setLastSubmission({
          rank: data.rank,
          username: data.entry?.username || (user ? user.username : 'Guest_Pilot'),
          isRegistered: data.isRegistered
        });
      } else if (data?.reason) {
        setSubmissionError(String(data.reason));
      }
    } catch {
      setSubmissionError('Network error submitting score.');
    }
  };

  const handleAlienClick = (id) => {
    if (!isPlaying || !isPlayerTurn) return;

    initAudio();
    activateAlien(id, 300);

    const newInput = [...playerInput, id];
    setPlayerInput(newInput);

    const currentIndex = newInput.length - 1;
    if (newInput[currentIndex] !== sequence[currentIndex]) {
      // Game Over
      runIdRef.current++;
      clearGameTimers();
      setActiveAlien(null);
      playTone(100, 800);
      setIsPlayerTurn(false);
      setIsPlaying(false);
      setStatus(`GAME OVER! FINAL SCORE: ${score}`);
      setSequence([]);

      submitScoreToLeaderboard(score);
      return;
    }

    if (newInput.length === sequence.length) {
      const activeRunId = runIdRef.current;
      const completedSeq = sequence;
      setIsPlayerTurn(false);
      setScore(s => s + 1);
      setStatus('CORRECT!');
      roundDelayTimerRef.current = setTimeout(() => {
        nextRound(completedSeq, activeRunId);
      }, 1000);
    }
  };

  return (
    <div className="game-container">
      <a href="/" className="return-btn" title="Return to Hub">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      </a>

      <div className="top-controls-right">
        <button
          type="button"
          className={`mute-btn-top ${muted ? 'muted' : ''}`}
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          className="leaderboard-btn-top"
          onClick={() => {
            fetchLeaderboard();
            setShowLeaderboard(true);
          }}
          title="View Global Leaderboard"
        >
          🏆 Leaderboard
        </button>
      </div>

      <div className="header">
        <h1>Alien Echo</h1>
        <div className="score-board">SCORE: {score}</div>
        {user ? (
          <div className="user-indicator">Pilot: <strong>{user.username}</strong> <span className="verified-badge">✓</span></div>
        ) : (
          <div className="guest-indicator">Playing as Guest • <a href="/" style={{ color: '#38bdf8' }}>Sign In</a> for verified rank</div>
        )}
      </div>

      <div className="status-msg">{status}</div>

      {lastSubmission && (
        <div className="submission-banner">
          🚀 Score submitted to Global Leaderboard!
          {lastSubmission.rank && <span> Global Rank: <strong>#{lastSubmission.rank}</strong></span>}
        </div>
      )}

      {submissionError && (
        <div className="submission-banner" style={{ borderColor: '#ef4444', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.15)' }}>
          {submissionError}
        </div>
      )}

      <div className="alien-grid">
        {ALIENS.map(alien => (
          <button
            key={alien.id}
            type="button"
            className={`alien-btn alien-${alien.position} ${activeAlien === alien.id ? 'active' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              handleAlienClick(alien.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAlienClick(alien.id);
              }
            }}
            disabled={!isPlayerTurn}
            aria-label={`${alien.color} alien pad`}
          >
            <AlienIcon type={alien.id} />
          </button>
        ))}

        <div className="center-control">
          {!isPlaying && (
            <button type="button" className="start-btn" onClick={startGame}>START</button>
          )}
        </div>
      </div>

      {showLeaderboard && (
        <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="leaderboard-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏆 Alien Echo Global Hall of Fame</h2>
              <button type="button" className="close-btn" onClick={() => setShowLeaderboard(false)}>&times;</button>
            </div>

            <div className="leaderboard-scroll">
              {loadingLeaderboard ? (
                <p style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Loading records...</p>
              ) : leaderboard.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No scores yet! Play a round to claim #1.</p>
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
                    {leaderboard.map((entry, idx) => {
                      const safeRank = typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : idx + 1;
                      const safeName = String(entry.username || 'Anonymous').slice(0, 24);
                      const safeScore = Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0;
                      return (
                        <tr key={entry.id || idx} className={user && user.username === safeName ? 'highlight-row' : ''}>
                          <td><span className={`rank-tag rank-${safeRank}`}>#{safeRank}</span></td>
                          <td>
                            <strong>{safeName}</strong>
                            {entry.isVerified && <span className="v-check">✓</span>}
                          </td>
                          <td className="score-cell">{safeScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <button type="button" className="close-modal-btn" onClick={() => setShowLeaderboard(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
