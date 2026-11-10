import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mic, Upload, Music, Trophy, CheckCircle, X } from 'lucide-react';
import { GameEngine } from './Engine';
import './index.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reqRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState(null); // 'mic' or 'mp3' or 'synth'
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Auth & Leaderboard
  const [user, setUser] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Audio Element for MP3
  const audioRef = useRef(null);

  // Check auth session on load
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
      const res = await fetch('/api/leaderboard/sonic-soccer?limit=25');
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
    if (score.blue <= 0) {
      alert('Score at least 1 goal with the Blue team to submit to the Global Leaderboard!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'sonic-soccer',
          score: score.blue,
          challenge,
          username: user ? user.username : 'Guest Striker',
          details: {
            blue: score.blue,
            red: score.red,
            mode: mode || 'synth'
          }
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

  const initGame = async (analyser) => {
    setStarted(true);

    // Request anti-cheat game session challenge
    try {
      const res = await fetch('/api/leaderboard/start?gameId=sonic-soccer', { method: 'POST' });
      const data = await res.json();
      if (data?.success && data?.challenge) {
        setChallenge(data.challenge);
      }
    } catch {}
    
    // We need a short timeout to let React render the canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      engineRef.current = new GameEngine(canvas, analyser);
      
      const handleResize = () => {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      };
      
      window.addEventListener('resize', handleResize);
      handleResize();

      const loop = () => {
        engineRef.current.update();
        engineRef.current.draw();
        setScore({ ...engineRef.current.score });
        reqRef.current = requestAnimationFrame(loop);
      };
      
      reqRef.current = requestAnimationFrame(loop);
    }, 100);
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      source.connect(analyser);
      // Don't connect to destination to avoid feedback loop!
      
      setMode('mic');
      initGame(analyser);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleAudioFile = (file) => {
    if (!file) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContext();
    
    const analyser = audioCtxRef.current.createAnalyser();
    
    const audio = new Audio(URL.createObjectURL(file));
    audio.loop = true;
    audioRef.current = audio;
    
    const source = audioCtxRef.current.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtxRef.current.destination);
    
    audio.play();
    setMode('mp3');
    initGame(analyser);
  };

  const startMp3 = (e) => {
    handleAudioFile(e.target.files[0]);
  };

  const startDemoBeat = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    
    // Electronic dance rhythm generator
    const bpm = 124;
    const interval = (60 / bpm) * 1000 / 2;
    let step = 0;
    
    const timer = setInterval(() => {
      if (ctx.state === 'closed') {
        clearInterval(timer);
        return;
      }
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        if (step % 4 === 0) {
          // Punchy 808 kick
          osc.frequency.setValueAtTime(140, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(1.0, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        } else if (step % 4 === 2) {
          // Snare snap
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280, ctx.currentTime);
          gain.gain.setValueAtTime(0.65, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        } else {
          // Electro synth pulse
          osc.type = 'sawtooth';
          const notes = [110, 130, 164, 196, 220];
          osc.frequency.setValueAtTime(notes[step % notes.length], ctx.currentTime);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        }
        
        osc.connect(gain);
        gain.connect(analyser);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        step = (step + 1) % 16;
      } catch (e) {
        clearInterval(timer);
      }
    }, interval);
    
    setMode('synth');
    initGame(analyser);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!started) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (started) return;
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleAudioFile(file);
    }
  };

  useEffect(() => {
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return (
    <div 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop} 
      style={{ width: '100vw', height: '100vh', position: 'relative' }}
    >
      {isDragging && !started && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(57, 255, 20, 0.1)', border: '4px dashed var(--neon-green)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
           <h2 style={{ color: 'var(--neon-green)', fontSize: '3rem', textShadow: '0 0 20px var(--neon-green)', background: '#000', padding: '20px 40px', borderRadius: '20px' }}>Drop MP3 to Play!</h2>
        </div>
      )}

      {!started && (
        <div className="overlay">
          <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
            <a href="/" style={{color: 'var(--neon-green)', textDecoration: 'none', pointerEvents: 'auto'}}><ArrowLeft size={32} /></a>
          </div>
          <h1 className="title">Sonic Soccer</h1>
          <p style={{fontSize: '1.2rem', color: '#ccc', textAlign: 'center', maxWidth: '600px'}}>
            A football simulation powered entirely by soundwaves. <br/>
            Loudness determines game speed and kick power. High frequencies increase player aggression.
          </p>
          
          <div className="options-grid">
            <div className="option-card">
              <Mic size={48} color="var(--neon-green)" />
              <h3>Microphone Mode</h3>
              <p>Yell, clap, or play music out loud. The engine will pick up your mic.</p>
              <button className="btn" onClick={startMic}>Connect Mic</button>
            </div>
            
            <div className="option-card">
              <Upload size={48} color="var(--neon-green)" />
              <h3>MP3 Fallback</h3>
              <p>No mic? Upload an MP3 file directly. It will play in the background.</p>
              <label className="btn" style={{display: 'inline-block', marginTop: '10px'}}>
                Choose MP3
                <input type="file" accept="audio/*" onChange={startMp3} style={{display: 'none'}} />
              </label>
            </div>

            <div className="option-card">
              <Music size={48} color="var(--neon-green)" />
              <h3>Instant Demo Beat</h3>
              <p>Perfect for Mobile! Starts a generated synth electro track immediately.</p>
              <button className="btn" onClick={startDemoBeat}>Play Demo Beat ⚡</button>
            </div>
          </div>

          {/* Leaderboard & User Bar */}
          <div className="start-footer-bar">
            <button className="sonic-rank-btn" onClick={openLeaderboard}>
              <Trophy size={18} /> Global Rankings
            </button>
            {user ? (
              <span className="sonic-user-badge">
                <CheckCircle size={15} color="#22c55e" /> {user.username} (Verified)
              </span>
            ) : (
              <span className="sonic-user-badge guest">
                Guest Player (Sign in on main hub to verify)
              </span>
            )}
          </div>
        </div>
      )}

      {started && (
        <div className="hud">
          <div className="hud-left">
            <a href="/" style={{color: 'var(--neon-green)', textDecoration: 'none'}}><ArrowLeft size={32} /></a>
          </div>
          
          <div className="score-board">
            <span style={{color: '#38bdf8'}}>{score.blue}</span>
            <span>-</span>
            <span style={{color: '#ef4444'}}>{score.red}</span>
          </div>

          <div className="hud-right">
            <button className="sonic-hud-btn" onClick={openLeaderboard} title="View Leaderboards">
              <Trophy size={18} />
              <span className="hud-btn-text">Rankings</span>
            </button>
            <button 
              className="sonic-hud-btn submit" 
              onClick={submitScore} 
              disabled={submitting}
              title="Submit your Blue Team score"
            >
              {submitting ? 'Submitting...' : `Submit (${score.blue})`}
            </button>
          </div>
        </div>
      )}

      {submitStatus && (
        <div className="sonic-toast-banner">
          {submitStatus}
        </div>
      )}

      {mode === 'mp3' && started && (
        <div className="audio-player">
           <div style={{display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--neon-green)'}}>
             <Music size={20} /> Playing MP3 Audio Track
           </div>
        </div>
      )}

      {mode === 'synth' && started && (
        <div className="audio-player">
           <div style={{display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--neon-green)'}}>
             <Music size={20} /> Playing Synth Beat Rhythm ⚡ (Tap field to kick ball)
           </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="sonic-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="sonic-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sonic-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={22} color="#39ff14" />
                <h2>Sonic Soccer Leaderboard</h2>
              </div>
              <button className="sonic-close-btn" onClick={() => setShowLeaderboard(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="sonic-modal-body">
              {loadingLeaderboard ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Loading rankings...
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No scores recorded yet. Score a goal to take #1!
                </div>
              ) : (
                <div className="sonic-leaderboard-table-wrap">
                  <table className="sonic-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Goals (Score)</th>
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
                          <td style={{ fontWeight: 'bold', color: '#39ff14' }}>
                            {item.score} goals
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

            <div className="sonic-modal-footer">
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Anti-cheat verified scores with HMAC challenge protection.
              </span>
              <button className="btn" style={{ padding: '8px 20px' }} onClick={() => setShowLeaderboard(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {started && (
        <canvas 
          ref={canvasRef} 
          onClick={(e) => engineRef.current?.touchKick(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches && e.touches[0]) {
              engineRef.current?.touchKick(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none' }} 
        />
      )}
    </div>
  );
}

export default App;
