import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mic, Upload, Music, Trophy, CheckCircle, X, Volume2, VolumeX, Play, Disc3, Zap } from 'lucide-react';
import { GameEngine } from './Engine';
import { AudioEngine } from './audioEngine';
import './index.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reqRef = useRef(null);
  const audioEngineRef = useRef(null);
  const audioElRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState(null); // 'cyberpunk', 'dnb', 'synthwave', 'mic', 'mp3'
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [sonicStrikes, setSonicStrikes] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(128);
  const [isBeatActive, setIsBeatActive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  // Auth & Leaderboard
  const [user, setUser] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const getAudioEngine = () => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
    }
    return audioEngineRef.current;
  };

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
            sonicStrikes,
            mode: mode || 'cyberpunk'
          }
        })
      });
      const data = await res.json();
      if (data?.success) {
        setSubmitStatus(`Rank #${data.rank} Recorded on Global Board!`);
        setTimeout(() => setSubmitStatus(null), 4000);
      } else {
        setSubmitStatus(data?.error || data?.reason || 'Submission failed');
        setTimeout(() => setSubmitStatus(null), 3500);
      }
    } catch {
      setSubmitStatus('Network error submitting score');
      setTimeout(() => setSubmitStatus(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const initGameLoop = () => {
    setStarted(true);

    // Request anti-cheat game session challenge
    fetch('/api/leaderboard/start?gameId=sonic-soccer', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data?.success && data?.challenge) {
          setChallenge(data.challenge);
        }
      })
      .catch(() => {});

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const audio = getAudioEngine();
      engineRef.current = new GameEngine(canvas, audio);

      const handleResize = () => {
        if (engineRef.current) {
          engineRef.current.resize(window.innerWidth, window.innerHeight);
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      let lastBeatFlash = 0;
      const loop = () => {
        if (engineRef.current) {
          engineRef.current.update();
          engineRef.current.draw();
          setScore({ ...engineRef.current.score });
          setSonicStrikes(engineRef.current.sonicStrikes);

          // Update BPM and Beat Pulse Indicator
          if (audio) {
            setCurrentBpm(audio.currentBpm || 128);
            const now = performance.now();
            if (audio.isKickBeat || audio.beatPulse > 0.6) {
              setIsBeatActive(true);
              lastBeatFlash = now;
            } else if (now - lastBeatFlash > 120) {
              setIsBeatActive(false);
            }
          }
        }
        reqRef.current = requestAnimationFrame(loop);
      };

      reqRef.current = requestAnimationFrame(loop);
    }, 80);
  };

  const startTrack = (trackName) => {
    const audio = getAudioEngine();
    audio.ensureContext();
    audio.playTrack(trackName);
    setMode(trackName);
    if (!started) initGameLoop();
  };

  const startMic = async () => {
    try {
      const audio = getAudioEngine();
      audio.ensureContext();
      audio.stopTrack();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audio.ctx.createMediaStreamSource(stream);
      source.connect(audio.analyser);
      // Microphone is NOT connected to destination to prevent feedback scream

      setMode('mic');
      if (!started) initGameLoop();
    } catch (err) {
      alert('Microphone access was denied or is unavailable on this device.');
    }
  };

  const handleAudioFile = (file) => {
    if (!file) return;
    const audio = getAudioEngine();
    audio.ensureContext();
    audio.stopTrack();

    const fileAudio = new Audio(URL.createObjectURL(file));
    fileAudio.loop = true;
    audioElRef.current = fileAudio;

    const source = audio.ctx.createMediaElementSource(fileAudio);
    source.connect(audio.analyser);
    audio.analyser.connect(audio.masterGain);

    fileAudio.play().catch(() => {});
    setMode('mp3');
    if (!started) initGameLoop();
  };

  const handleCanvasClick = (e) => {
    if (!engineRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    engineRef.current.touchKick(x, y);
  };

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    if (audioEngineRef.current) {
      audioEngineRef.current.sfxEnabled = next;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(val);
    }
  };

  useEffect(() => {
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (audioEngineRef.current) {
        audioEngineRef.current.stopTrack();
        if (audioEngineRef.current.ctx) {
          audioEngineRef.current.ctx.close().catch(() => {});
        }
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="sonic-container">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={handleCanvasClick}
      />

      {/* Start / Selection Screen */}
      {!started && (
        <div className="overlay">
          <div className="sonic-badge-top">
            <span className="pulse-dot"></span>
            ASTRONAUTIC AUDIO SYNCHRONIZER • NEXT-GEN DSP
          </div>

          <h1 className="title">SONIC SOCCER</h1>
          <p className="subtitle">
            CYBERNETIC AUDIO-REACTIVE SPORTS ARENA • ACCURATE SPECTRAL FLUX & ON-BEAT SONIC STRIKES
          </p>

          <div className="options-grid">
            {/* Track 1: Cyber Rush */}
            <div className="option-card featured" onClick={() => startTrack('cyberpunk')}>
              <div className="option-card-badge">RECOMMENDED</div>
              <div className="option-icon-box">
                <Disc3 size={32} className="spin-slow" />
              </div>
              <h3>CYBER RUSH</h3>
              <div className="track-bpm-tag">128 BPM • ELECTRO HOUSE</div>
              <p>Heavy 808 sub-bass, pumping sidechain compression, and razor-sharp synthesizer arpeggios.</p>
              <button className="btn">
                <Play size={16} /> PLAY CYBER RUSH
              </button>
            </div>

            {/* Track 2: Neon Velocity */}
            <div className="option-card" onClick={() => startTrack('dnb')}>
              <div className="option-icon-box">
                <Zap size={32} />
              </div>
              <h3>NEON VELOCITY</h3>
              <div className="track-bpm-tag">156 BPM • DRUM & BASS</div>
              <p>High-octane Amen breakbeats, rolling Reese basslines, and hyper-accelerated player sprints.</p>
              <button className="btn">
                <Play size={16} /> PLAY NEON VELOCITY
              </button>
            </div>

            {/* Track 3: Retrowave Stride */}
            <div className="option-card" onClick={() => startTrack('synthwave')}>
              <div className="option-icon-box">
                <Music size={32} />
              </div>
              <h3>RETROWAVE STRIDE</h3>
              <div className="track-bpm-tag">114 BPM • DARKSYNTH</div>
              <p>Analog octave square bass, lush gated-reverb snares, and nostalgic 80s neon lead melodies.</p>
              <button className="btn">
                <Play size={16} /> PLAY RETROWAVE
              </button>
            </div>

            {/* Live Microphone */}
            <div className="option-card" onClick={startMic}>
              <div className="option-icon-box">
                <Mic size={32} />
              </div>
              <h3>LIVE MICROPHONE</h3>
              <div className="track-bpm-tag">REAL-TIME HARDWARE DSP</div>
              <p>Shout, clap, or play your own Spotify / YouTube track in the background to drive the stadium!</p>
              <button className="btn">
                <Mic size={16} /> CONNECT MIC
              </button>
            </div>

            {/* Custom MP3 Upload */}
            <div className="option-card">
              <div className="option-icon-box">
                <Upload size={32} />
              </div>
              <h3>CUSTOM MP3 / WAV</h3>
              <div className="track-bpm-tag">1024-BIN FFT ANALYSIS</div>
              <p>Drop your own music file. Full multi-band frequency splitting and beat onsets extracted instantly.</p>
              <label className="btn upload-btn">
                <Upload size={16} /> UPLOAD FILE
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleAudioFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div className="start-footer-bar">
            <button className="sonic-rank-btn" onClick={openLeaderboard}>
              <Trophy size={16} /> Global Leaderboard
            </button>
            {user ? (
              <span className="sonic-user-badge">
                <CheckCircle size={14} style={{ color: '#00f0ff' }} /> {user.username} (Verified Pilot)
              </span>
            ) : (
              <span className="sonic-user-badge guest">Guest Striker (Scores can be claimed upon sign-up)</span>
            )}
            <a href="/" className="sonic-back-link">
              <ArrowLeft size={16} /> Exit to Hub
            </a>
          </div>
        </div>
      )}

      {/* In-Game Modern Cyber HUD */}
      {started && (
        <div className="hud">
          {/* Top Left: Navigation & Mode Switcher */}
          <div className="hud-left">
            <a href="/" className="sonic-hud-btn" title="Back to Astra Hub">
              <ArrowLeft size={16} /> Hub
            </a>
            <div className="track-switcher">
              <span className="track-label">TRACK:</span>
              <button
                className={`track-pill ${mode === 'cyberpunk' ? 'active' : ''}`}
                onClick={() => startTrack('cyberpunk')}
              >
                Cyber 128
              </button>
              <button
                className={`track-pill ${mode === 'dnb' ? 'active' : ''}`}
                onClick={() => startTrack('dnb')}
              >
                DnB 156
              </button>
              <button
                className={`track-pill ${mode === 'synthwave' ? 'active' : ''}`}
                onClick={() => startTrack('synthwave')}
              >
                Retro 114
              </button>
            </div>
          </div>

          {/* Center: Scoreboard & Sonic Strike Meter */}
          <div className="hud-center">
            <div className="score-board">
              <div className="team-score blue">
                <span className="team-name">BLUE</span>
                <span className="score-val">{score.blue}</span>
              </div>
              <div className="score-divider">:</div>
              <div className="team-score red">
                <span className="score-val">{score.red}</span>
                <span className="team-name">RED</span>
              </div>
            </div>

            <div className="sonic-strike-counter">
              <Zap size={14} className="zap-glow" />
              <span>SONIC STRIKES: <strong>{sonicStrikes}</strong></span>
              <span className={`beat-indicator ${isBeatActive ? 'hit' : ''}`} title="Beat Onset Meter"></span>
              <span className="bpm-display">{currentBpm} BPM</span>
            </div>
          </div>

          {/* Top Right: Sound Controls & Leaderboard */}
          <div className="hud-right">
            <button
              className="sonic-hud-icon-btn"
              onClick={toggleSfx}
              title={sfxEnabled ? 'Mute Game SFX' : 'Enable Game SFX'}
            >
              {sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
              title="Master Volume"
            />
            <button
              className="sonic-hud-btn submit"
              onClick={submitScore}
              disabled={submitting}
              title="Submit high score to Astra 13 Global Leaderboard"
            >
              <Trophy size={16} /> {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
            <button className="sonic-hud-btn" onClick={openLeaderboard}>
              <Trophy size={16} /> Board
            </button>
          </div>
        </div>
      )}

      {/* Floating Instructions Toast */}
      {started && (
        <div className="sonic-instructions-hint">
          <span>💡 <strong>Tip:</strong> Click anywhere on the pitch to launch laser touch kicks. Kick on the <strong>beat</strong> for a ⚡ <strong>Sonic Strike!</strong></span>
        </div>
      )}

      {/* Score Submission Notification Toast */}
      {submitStatus && (
        <div className="sonic-toast-banner">
          {submitStatus}
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="sonic-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="sonic-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sonic-modal-header">
              <div className="modal-title-wrap">
                <Trophy size={24} style={{ color: '#00f0ff' }} />
                <h2>Sonic Soccer Global Leaderboard</h2>
              </div>
              <button className="sonic-modal-close" onClick={() => setShowLeaderboard(false)}>
                <X size={20} />
              </button>
            </div>

            <p className="sonic-modal-desc">
              Scores recorded across all pilots. Kick on beat drops to increase Sonic Strike multipliers.
            </p>

            <div className="sonic-leaderboard-list">
              {loadingLeaderboard ? (
                <div className="sonic-board-empty">Fetching rankings...</div>
              ) : leaderboard.length === 0 ? (
                <div className="sonic-board-empty">No scores recorded yet. Be the first to strike!</div>
              ) : (
                leaderboard.map((item, idx) => (
                  <div key={item.id || idx} className={`sonic-board-row rank-${idx + 1}`}>
                    <div className="board-col-rank">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div className="board-col-player">
                      <span className="player-name">{item.username}</span>
                      {item.isRegistered && (
                        <span className="pilot-verified-badge" title="Verified Pilot Account">
                          <CheckCircle size={12} /> VERIFIED
                        </span>
                      )}
                    </div>
                    <div className="board-col-score">
                      <span className="score-num">{item.score}</span>
                      <span className="score-label">GOALS</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sonic-modal-footer">
              <button className="btn" onClick={() => setShowLeaderboard(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
