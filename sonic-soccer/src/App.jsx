import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const fileSourceRef = useRef(null);
  const fileUrlRef = useRef(null);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const challengeRef = useRef(null);
  const toastTimerRef = useRef(null);

  const lastScoreRef = useRef({ blue: 0, red: 0 });
  const lastStrikesRef = useRef(0);
  const lastBpmRef = useRef(128);
  const lastBeatRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState(null);
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [sonicStrikes, setSonicStrikes] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(128);
  const [isBeatActive, setIsBeatActive] = useState(false);
  const [volume, setVolume] = useState(0.45);
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

  const getAudioEngine = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
    }
    return audioEngineRef.current;
  }, []);

  const stopExternalAudio = useCallback(() => {
    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (fileSourceRef.current) {
      try {
        fileSourceRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      fileSourceRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
  }, []);

  const requestChallenge = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'sonic-soccer' })
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
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard/sonic-soccer?limit=25', {
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

  const submitScore = async () => {
    if (!Number.isFinite(score.blue) || score.blue <= 0) {
      showToast('Score at least 1 goal with the Blue team to submit!');
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

      // Match physical goal limit enforced by backend (60 goals max per match)
      const submittedGoals = Math.min(60, Math.floor(score.blue));

      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'sonic-soccer',
          score: submittedGoals,
          challenge: activeChallenge,
          username: user ? user.username : 'Guest_Striker',
          details: {
            blue: submittedGoals,
            red: Math.floor(score.red),
            sonicStrikes: Math.floor(sonicStrikes),
            mode: mode || 'cyberpunk'
          }
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
      requestChallenge();
    }
  };

  // Dedicated lifecycle effect for canvas, resize listener, and animation loop
  useEffect(() => {
    if (!started) return;

    requestChallenge();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const audio = getAudioEngine();
    const engine = new GameEngine(canvas, audio);
    engineRef.current = engine;
    lastScoreRef.current = { blue: 0, red: 0 };
    lastStrikesRef.current = 0;

    const handleResize = () => {
      engine.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    let lastBeatFlash = 0;
    const loop = (now) => {
      engine.update(now);
      engine.draw();

      if (
        engine.score.blue !== lastScoreRef.current.blue ||
        engine.score.red !== lastScoreRef.current.red
      ) {
        lastScoreRef.current = { blue: engine.score.blue, red: engine.score.red };
        setScore(lastScoreRef.current);
      }

      if (engine.sonicStrikes !== lastStrikesRef.current) {
        lastStrikesRef.current = engine.sonicStrikes;
        setSonicStrikes(engine.sonicStrikes);
      }

      if (audio) {
        const bpm = audio.currentBpm || 128;
        if (bpm !== lastBpmRef.current) {
          lastBpmRef.current = bpm;
          setCurrentBpm(bpm);
        }

        let nextBeat = lastBeatRef.current;
        if (audio.isKickBeat || audio.beatPulse > 0.6) {
          nextBeat = true;
          lastBeatFlash = now;
        } else if (now - lastBeatFlash > 160) {
          nextBeat = false;
        }

        if (nextBeat !== lastBeatRef.current) {
          lastBeatRef.current = nextBeat;
          setIsBeatActive(nextBeat);
        }
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
  }, [started, getAudioEngine, requestChallenge]);

  const startTrack = (trackName) => {
    stopExternalAudio();
    const audio = getAudioEngine();
    audio.ensureContext();
    audio.playTrack(trackName);
    setMode(trackName);
    setStarted(true);
  };

  const startMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Microphone access is unavailable in this browser.');
      return;
    }
    try {
      stopExternalAudio();
      const audio = getAudioEngine();
      audio.ensureContext();
      audio.stopTrack();
      if (!audio.ctx || !audio.analyser) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const source = audio.ctx.createMediaStreamSource(stream);
      micSourceRef.current = source;
      source.connect(audio.analyser);

      setMode('mic');
      setStarted(true);
    } catch {
      showToast('Microphone access was denied or is unavailable.');
    }
  };

  const handleAudioFile = (file) => {
    if (!file) return;
    stopExternalAudio();
    const audio = getAudioEngine();
    audio.ensureContext();
    audio.stopTrack();
    if (!audio.ctx || !audio.analyser || !audio.masterGain) return;

    const objectUrl = URL.createObjectURL(file);
    fileUrlRef.current = objectUrl;

    const fileAudio = new Audio(objectUrl);
    fileAudio.loop = true;
    audioElRef.current = fileAudio;

    const source = audio.ctx.createMediaElementSource(fileAudio);
    fileSourceRef.current = source;
    source.connect(audio.analyser);
    source.connect(audio.masterGain);

    fileAudio.play().catch(() => {});
    setMode('mp3');
    setStarted(true);
  };

  const handleCanvasPointerDown = (e) => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    engineRef.current.touchKick(x, y);
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (audioEngineRef.current) {
      audioEngineRef.current.setMuted(nextMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!Number.isFinite(val)) return;
    setVolume(val);
    if (val > 0 && muted) {
      setMuted(false);
      if (audioEngineRef.current) audioEngineRef.current.setMuted(false);
    }
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(val);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      stopExternalAudio();
      if (audioEngineRef.current) {
        audioEngineRef.current.stopTrack();
        if (audioEngineRef.current.ctx) {
          audioEngineRef.current.ctx.close().catch(() => {});
        }
      }
    };
  }, [stopExternalAudio]);

  return (
    <div className="sonic-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onPointerDown={handleCanvasPointerDown}
        style={{ touchAction: 'none' }}
      />

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
            <div className="option-card featured" onClick={() => startTrack('cyberpunk')}>
              <div className="option-card-badge">RECOMMENDED</div>
              <div className="option-icon-box">
                <Disc3 size={32} className="spin-slow" />
              </div>
              <h3>CYBER RUSH</h3>
              <div className="track-bpm-tag">128 BPM • ELECTRO HOUSE</div>
              <p>Heavy 808 sub-bass, pumping sidechain compression, and razor-sharp synthesizer arpeggios.</p>
              <button type="button" className="btn">
                <Play size={16} /> PLAY CYBER RUSH
              </button>
            </div>

            <div className="option-card" onClick={() => startTrack('dnb')}>
              <div className="option-icon-box">
                <Zap size={32} />
              </div>
              <h3>NEON VELOCITY</h3>
              <div className="track-bpm-tag">156 BPM • DRUM & BASS</div>
              <p>High-octane Amen breakbeats, rolling Reese basslines, and hyper-accelerated player sprints.</p>
              <button type="button" className="btn">
                <Play size={16} /> PLAY NEON VELOCITY
              </button>
            </div>

            <div className="option-card" onClick={() => startTrack('synthwave')}>
              <div className="option-icon-box">
                <Music size={32} />
              </div>
              <h3>RETROWAVE STRIDE</h3>
              <div className="track-bpm-tag">114 BPM • DARKSYNTH</div>
              <p>Analog octave square bass, lush gated-reverb snares, and nostalgic 80s neon lead melodies.</p>
              <button type="button" className="btn">
                <Play size={16} /> PLAY RETROWAVE
              </button>
            </div>

            <div className="option-card" onClick={startMic}>
              <div className="option-icon-box">
                <Mic size={32} />
              </div>
              <h3>LIVE MICROPHONE</h3>
              <div className="track-bpm-tag">REAL-TIME HARDWARE DSP</div>
              <p>Shout, clap, or play your own Spotify / YouTube track in the background to drive the stadium!</p>
              <button type="button" className="btn">
                <Mic size={16} /> CONNECT MIC
              </button>
            </div>

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
                  onChange={(e) => handleAudioFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div className="start-footer-bar">
            <button type="button" className="sonic-rank-btn" onClick={openLeaderboard}>
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

      {started && (
        <div className="hud">
          <div className="hud-left">
            <a href="/" className="sonic-hud-btn" title="Back to Astra Hub">
              <ArrowLeft size={16} /> Hub
            </a>
            <div className="track-switcher">
              <span className="track-label">TRACK:</span>
              <button
                type="button"
                className={`track-pill ${mode === 'cyberpunk' ? 'active' : ''}`}
                onClick={() => startTrack('cyberpunk')}
              >
                Cyber 128
              </button>
              <button
                type="button"
                className={`track-pill ${mode === 'dnb' ? 'active' : ''}`}
                onClick={() => startTrack('dnb')}
              >
                DnB 156
              </button>
              <button
                type="button"
                className={`track-pill ${mode === 'synthwave' ? 'active' : ''}`}
                onClick={() => startTrack('synthwave')}
              >
                Retro 114
              </button>
            </div>
          </div>

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

          <div className="hud-right">
            <button
              type="button"
              className="sonic-hud-icon-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="volume-slider"
              title="Master Volume"
              aria-label="Master Volume"
            />
            <button
              type="button"
              className="sonic-hud-btn submit"
              onClick={submitScore}
              disabled={submitting}
              title="Submit high score to Global Leaderboard"
            >
              <Trophy size={16} /> {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
            <button type="button" className="sonic-hud-btn" onClick={openLeaderboard}>
              <Trophy size={16} /> Board
            </button>
          </div>
        </div>
      )}

      {started && (
        <div className="sonic-instructions-hint">
          <span>💡 <strong>Tip:</strong> Tap or click anywhere on the pitch to launch laser kicks. Kick on the <strong>beat</strong> for a ⚡ <strong>Sonic Strike!</strong></span>
        </div>
      )}

      {submitStatus && (
        <div className="sonic-toast-banner">
          {submitStatus}
        </div>
      )}

      {showLeaderboard && (
        <div className="sonic-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="sonic-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sonic-modal-header">
              <div className="modal-title-wrap">
                <Trophy size={24} style={{ color: '#00f0ff' }} />
                <h2>Sonic Soccer Global Leaderboard</h2>
              </div>
              <button type="button" className="sonic-modal-close" onClick={() => setShowLeaderboard(false)}>
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
                leaderboard.map((item, idx) => {
                  const safeName = String(item.username || 'Anonymous').slice(0, 24);
                  const safeGoals = Number.isFinite(Number(item.score)) ? Number(item.score) : 0;
                  return (
                    <div key={item.id || idx} className={`sonic-board-row rank-${idx + 1}`}>
                      <div className="board-col-rank">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div className="board-col-player">
                        <span className="player-name">{safeName}</span>
                        {(item.isRegistered || item.isVerified) && (
                          <span className="pilot-verified-badge" title="Verified Pilot Account">
                            <CheckCircle size={12} /> VERIFIED
                          </span>
                        )}
                      </div>
                      <div className="board-col-score">
                        <span className="score-num">{safeGoals}</span>
                        <span className="score-label">GOALS</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="sonic-modal-footer">
              <button type="button" className="btn" onClick={() => setShowLeaderboard(false)}>
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
