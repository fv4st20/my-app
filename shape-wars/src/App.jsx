import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Bomb, Shield, Circle, Trophy, CheckCircle, X, Volume2, VolumeX } from 'lucide-react';
import { GameEngine } from './Engine';
import './index.css';

function formatRecordDate(item) {
  const raw = item?.date ?? item?.timestamp ?? item?.createdAt;
  if (!raw) return '—';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
}

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reqRef = useRef(null);
  const lastScoreRef = useRef(0);
  const challengeRef = useRef(null);
  const toastTimerRef = useRef(null);
  const mutedRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);

  // Auth & Leaderboard
  const [user, setUser] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = useCallback((msg, durationMs = 3500) => {
    setSubmitStatus(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setSubmitStatus(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const requestChallenge = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'shape-wars' })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.success && data?.challenge) {
        challengeRef.current = data.challenge;
        return data.challenge;
      }
    } catch {
      // Offline or unauthenticated
    }
    return null;
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore speech cancel error
        }
      }
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    if (engineRef.current) {
      engineRef.current.setMuted(muted);
    }
  }, [muted]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard/shape-wars?limit=25', {
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch {
      // Network error ignored
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  const openLeaderboard = () => {
    setShowLeaderboard(true);
    fetchLeaderboard();
  };

  const toggleMute = () => {
    setMuted(prev => !prev);
  };

  const submitScore = async () => {
    if (!Number.isFinite(score) || score <= 0) {
      showToast('Obliterate at least 1 unit to record a battle score!');
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    try {
      let activeChallenge = challengeRef.current;
      if (!activeChallenge) {
        activeChallenge = await requestChallenge();
      }
      challengeRef.current = null;

      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'shape-wars',
          score: Math.min(100000, Math.floor(score)),
          challenge: activeChallenge,
          username: user ? user.username : 'Guest_Commander',
          details: { casualties: Math.floor(score) }
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        showToast(`Rank #${data.rank || 1} Recorded on Global Board!`, 4000);
      } else {
        showToast(data?.reason || data?.error || 'Submission failed', 3500);
      }
    } catch {
      showToast('Network error submitting score', 3000);
    } finally {
      setSubmitting(false);
      // Prepare fresh one-time challenge for subsequent submissions in this battle
      requestChallenge();
    }
  };

  useEffect(() => {
    if (!started) return;

    requestChallenge();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, mutedRef.current);
    engineRef.current = engine;
    lastScoreRef.current = 0;

    const handleResize = () => {
      engine.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const loop = (now) => {
      engine.update(now);
      engine.draw();
      if (engine.totalCasualties !== lastScoreRef.current) {
        lastScoreRef.current = engine.totalCasualties;
        setScore(engine.totalCasualties);
      }
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      engine.destroy();
      engineRef.current = null;
    };
  }, [started, requestChallenge]);

  const handleStart = () => {
    setStarted(true);
    if (!muted && typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        const u = new SpeechSynthesisUtterance('Welcome to Shape Wars!');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch {
        // Speech synthesis blocked or unsupported
      }
    }
  };

  const handleCanvasPointerDown = (e) => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const team = x < rect.width / 2 ? 'blue' : 'red';
    engineRef.current.spawnAt(team, x, y, 2);
  };

  return (
    <>
      {!started && (
        <div className="start-overlay">
          <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href="/" style={{ color: 'white', textDecoration: 'none', pointerEvents: 'auto' }} title="Back to Hub">
              <ArrowLeft size={32} />
            </a>
            <button
              type="button"
              className="shape-hud-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute Narrator' : 'Mute Narrator'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {muted ? 'Muted' : 'Voice On'}
            </button>
          </div>
          <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 4rem)', marginBottom: '16px', textShadow: '0 0 20px #fff' }}>Shape Wars</h1>
          <p style={{ marginBottom: '32px', fontSize: '1.2rem', color: '#ccc' }}>The Emotional Battle Simulator</p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <button type="button" className="start-btn" onClick={handleStart}>
              <Play fill="white" size={32} /> Start Simulation
            </button>

            <button type="button" className="shape-board-btn" onClick={openLeaderboard}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
            <a href="/" style={{ color: 'white', textDecoration: 'none' }} title="Back to Hub">
              <ArrowLeft size={32} />
            </a>
            <div className="battle-score-pill">
              <span>Casualties:</span>
              <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{score}</strong>
            </div>
            <button
              type="button"
              className="shape-hud-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute Narrator' : 'Mute Narrator'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button type="button" className="shape-hud-btn" onClick={openLeaderboard} title="View Leaderboards">
              <Trophy size={16} /> Hall of Fame
            </button>
            <button
              type="button"
              className="shape-hud-btn submit"
              onClick={submitScore}
              disabled={submitting}
              title="Broadcast battle record"
            >
              {submitting ? 'Submitting...' : `Submit Record (${score})`}
            </button>
          </div>

          <div className="hud-panel controls">
            <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Tactical Dashboard</h3>

            <div className="btn-group">
              <button type="button" className="btn-blue" onClick={() => engineRef.current?.spawn('blue', 10)}>
                <Shield size={16} /> +10 Cubes
              </button>
              <button type="button" className="btn-blue" onClick={() => engineRef.current?.spawn('blue', 50)}>
                +50
              </button>
            </div>

            <div className="btn-group">
              <button type="button" className="btn-red" onClick={() => engineRef.current?.spawn('red', 10)}>
                <Circle size={16} /> +10 Circles
              </button>
              <button type="button" className="btn-red" onClick={() => engineRef.current?.spawn('red', 50)}>
                +50
              </button>
            </div>

            <button type="button" className="btn-bomb" onClick={() => engineRef.current?.mathBomb()}>
              <Bomb size={16} /> Deploy Math Bomb
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
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
              <button type="button" className="shape-close-btn" onClick={() => setShowLeaderboard(false)}>
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
                      {leaderboard.map((item, idx) => {
                        const safeName = String(item.username || 'Anonymous').slice(0, 24);
                        const safeScore = Number.isFinite(Number(item.score)) ? Number(item.score) : 0;
                        return (
                          <tr key={item.id || idx} className={safeName === user?.username ? 'highlight-row' : ''}>
                            <td>
                              <span className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                                {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600 }}>{safeName}</span>
                                {(item.isRegistered || item.isVerified) && (
                                  <span title="Verified Hub Record" style={{ color: '#22c55e', fontSize: '0.85rem' }}>✓</span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontWeight: 'bold', color: '#ef4444' }}>
                              {safeScore.toLocaleString()} units
                            </td>
                            <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                              {formatRecordDate(item)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="shape-modal-footer">
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Signed battle records with anti-cheat verification.
              </span>
              <button type="button" className="shape-hud-btn" onClick={() => setShowLeaderboard(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none' }}
      />
    </>
  );
}

export default App;
