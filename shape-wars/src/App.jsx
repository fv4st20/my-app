import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Bomb, Shield, Circle, Trophy, CheckCircle, X } from 'lucide-react';
import { GameEngine } from './Engine';
import './index.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reqRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);

  // Auth & Leaderboard
  const [user, setUser] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard/shape-wars?limit=25');
      const data = await res.json();
      if (data?.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const openLeaderboard = () => {
    setShowLeaderboard(true);
    fetchLeaderboard();
  };

  const submitScore = async () => {
    if (score <= 0) {
      alert('Obliterate at least 1 unit to record a battle score on the Global Leaderboard!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'shape-wars',
          score,
          challenge,
          username: user ? user.username : 'Guest Commander',
          details: { casualties: score }
        })
      });
      const data = await res.json();
      if (data?.success) {
        setSubmitStatus(`Rank #${data.rank} Recorded on Global Board!`);
        setTimeout(() => setSubmitStatus(null), 4000);
      } else {
        setSubmitStatus(data?.error || 'Submission failed');
        setTimeout(() => setSubmitStatus(null), 3000);
      }
    } catch {
      setSubmitStatus('Network error submitting score');
      setTimeout(() => setSubmitStatus(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!started) return;

    // Fetch challenge token for verified session
    fetch('/api/leaderboard/start?gameId=shape-wars', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d?.success && d?.challenge) setChallenge(d.challenge);
      })
      .catch(() => {});

    const canvas = canvasRef.current;
    engineRef.current = new GameEngine(canvas);
    
    const handleResize = () => {
      engineRef.current.resize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    const loop = () => {
      engineRef.current.update();
      engineRef.current.draw();
      if (engineRef.current.totalCasualties !== score) {
        setScore(engineRef.current.totalCasualties);
      }
      reqRef.current = requestAnimationFrame(loop);
    };
    
    reqRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqRef.current);
    };
  }, [started]);

  const handleStart = () => {
    setStarted(true);
    // Initialize speech synthesis by speaking an empty string on user interaction
    const u = new SpeechSynthesisUtterance("Welcome to Shape Wars!");
    u.volume = 0; // Just to unlock it
    window.speechSynthesis.speak(u);
  };

  const handleCanvasTap = (e) => {
    if (!engineRef.current) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientX == null || clientY == null) return;
    
    // Tap left side: Blue Cubes, Tap right side: Red Circles
    const team = clientX < window.innerWidth / 2 ? 'blue' : 'red';
    engineRef.current.spawnAt(team, clientX, clientY, 2);
  };

  return (
    <>
      {!started && (
        <div className="start-overlay">
          <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
            <a href="/" style={{color: 'white', textDecoration: 'none', pointerEvents: 'auto'}}><ArrowLeft size={32} /></a>
          </div>
          <h1 style={{fontSize: '4rem', marginBottom: '16px', textShadow: '0 0 20px #fff'}}>Shape Wars</h1>
          <p style={{marginBottom: '32px', fontSize: '1.2rem', color: '#ccc'}}>The Emotional Battle Simulator</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <button className="start-btn" onClick={handleStart}>
              <Play fill="white" size={32} /> Start Simulation
            </button>

            <button className="shape-board-btn" onClick={openLeaderboard}>
              <Trophy size={18} /> View Hall of Fame
            </button>

            {user ? (
              <span className="shape-user-tag">
                <CheckCircle size={15} color="#22c55e" /> Logged in as {user.username}
              </span>
            ) : (
              <span className="shape-user-tag guest">
                Playing as Guest Commander (Sign in on hub to verify records)
              </span>
            )}
          </div>
        </div>
      )}

      {started && (
        <div className="hud">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/" style={{color: 'white', textDecoration: 'none', pointerEvents: 'auto'}}><ArrowLeft size={32} /></a>
            <div className="battle-score-pill">
              <span>Casualties:</span>
              <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{score}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button className="shape-hud-btn" onClick={openLeaderboard} title="View Leaderboards">
              <Trophy size={16} /> Hall of Fame
            </button>
            <button 
              className="shape-hud-btn submit" 
              onClick={submitScore}
              disabled={submitting}
              title="Broadcast battle record"
            >
              {submitting ? 'Submitting...' : `Submit Record (${score})`}
            </button>
          </div>
          
          <div className="hud-panel controls">
            <h3 style={{textAlign: 'center', marginBottom: '10px'}}>Tactical Dashboard</h3>
            
            <div className="btn-group">
              <button className="btn-blue" onClick={() => engineRef.current?.spawn('blue', 10)}>
                <Shield size={16}/> +10 Cubes
              </button>
              <button className="btn-blue" onClick={() => engineRef.current?.spawn('blue', 50)}>
                +50
              </button>
            </div>

            <div className="btn-group">
              <button className="btn-red" onClick={() => engineRef.current?.spawn('red', 10)}>
                <Circle size={16}/> +10 Circles
              </button>
              <button className="btn-red" onClick={() => engineRef.current?.spawn('red', 50)}>
                +50
              </button>
            </div>

            <button className="btn-bomb" onClick={() => engineRef.current?.mathBomb()}>
              <Bomb size={16} /> Deploy Math Bomb
            </button>
            <p style={{textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0'}}>
              ✨ Tap anywhere on screen to spawn units directly!
            </p>
          </div>
        </div>
      )}

      {submitStatus && (
        <div className="shape-toast-banner">
          {submitStatus}
        </div>
      )}

      {/* Hall of Fame Modal */}
      {showLeaderboard && (
        <div className="shape-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="shape-modal-card" onClick={e => e.stopPropagation()}>
            <div className="shape-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={22} color="#facc15" />
                <h2>Shape Wars Hall of Fame</h2>
              </div>
              <button className="shape-close-btn" onClick={() => setShowLeaderboard(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="shape-modal-body">
              {loadingLeaderboard ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Loading Hall of Fame...
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No battle records yet. Cause some destruction to enter the records!
                </div>
              ) : (
                <div className="shape-table-wrap">
                  <table className="shape-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Commander</th>
                        <th>Casualties Claimed</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((item, idx) => (
                        <tr key={idx} className={item.username === user?.username ? 'highlight-row' : ''}>
                          <td>
                            <span className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                              {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600 }}>{item.username}</span>
                              {item.isRegistered && (
                                <span title="Verified Hub Member" style={{ color: '#22c55e', fontSize: '0.85rem' }}>✓</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: 'bold', color: '#ef4444' }}>
                            {item.score} units
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            {new Date(item.timestamp).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="shape-modal-footer">
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Hashed & signed battle records with anti-cheat verification.
              </span>
              <button className="shape-hud-btn" onClick={() => setShowLeaderboard(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasTap}
        onTouchStart={handleCanvasTap}
        style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none' }} 
      />
    </>
  );
}

export default App;
