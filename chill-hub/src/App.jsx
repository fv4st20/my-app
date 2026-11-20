import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Moon,
  Sun,
  Cloud,
  CloudRain,
  Calculator,
  ArrowLeft,
  Headphones,
  Play,
  Pause,
  RotateCcw,
  Check,
  Wind,
  Trash2,
  MapPin,
  FileText
} from 'lucide-react';
import './index.css';

const VALID_THEMES = ['default', 'space', 'sea', 'pinky', 'football'];
const DEFAULT_VOLUMES = { rain: 0, waves: 0, brown: 0, binaural: 0 };

// Safe localStorage helpers guarded against SecurityError, QuotaExceededError, and corrupt JSON
function safeReadStorage(key, fallback, validator) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return validator ? (validator(parsed) ? parsed : fallback) : parsed;
  } catch {
    return fallback;
  }
}

function safeWriteStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore private-mode or quota errors
  }
}

// Deterministic particle styles generated once at module load (pure render, zero jitter)
const RAIN_PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: `r${i}`,
  left: `${((i * 37 + 11) % 97) + 1}%`,
  animationDuration: `${(0.8 + ((i * 19) % 10) * 0.09).toFixed(2)}s`,
  animationDelay: `${(((i * 23) % 10) * 0.1).toFixed(2)}s`
}));

const SNOW_PARTICLES = Array.from({ length: 25 }, (_, i) => ({
  id: `s${i}`,
  left: `${((i * 29 + 7) % 98) + 1}%`,
  animationDuration: `${(2.6 + ((i * 17) % 10) * 0.2).toFixed(2)}s`,
  animationDelay: `${(((i * 13) % 10) * 0.2).toFixed(2)}s`
}));

// Safe deterministic arithmetic parser (tokenized shunting-yard, CSP-safe)
function evaluateMathExpression(expr) {
  const cleaned = String(expr || '').replace(/\s+/g, '');
  if (!cleaned || /[^0-9+\-*/.]/.test(cleaned)) {
    return null;
  }

  // Tokenize numbers (supporting unary minus) and binary operators
  const tokens = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    const isUnaryMinus =
      ch === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string');

    if ((ch >= '0' && ch <= '9') || ch === '.' || isUnaryMinus) {
      let numStr = ch;
      let dotCount = ch === '.' ? 1 : 0;
      i++;
      while (i < cleaned.length && ((cleaned[i] >= '0' && cleaned[i] <= '9') || cleaned[i] === '.')) {
        if (cleaned[i] === '.') {
          dotCount++;
          if (dotCount > 1) return null;
        }
        numStr += cleaned[i];
        i++;
      }
      if (numStr === '-' || numStr === '.' || numStr === '-.') return null;
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push(val);
    } else if (['+', '-', '*', '/'].includes(ch)) {
      if (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string') {
        return null;
      }
      tokens.push(ch);
      i++;
    } else {
      return null;
    }
  }

  if (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string') {
    return null;
  }

  // Pass 1: * and /
  const pass1 = [tokens[0]];
  for (let j = 1; j < tokens.length; j += 2) {
    const op = tokens[j];
    const rhs = tokens[j + 1];
    if (typeof rhs !== 'number') return null;
    if (op === '*' || op === '/') {
      const lhs = pass1.pop();
      if (op === '/' && rhs === 0) return null;
      const computed = op === '*' ? lhs * rhs : lhs / rhs;
      if (!Number.isFinite(computed)) return null;
      pass1.push(computed);
    } else {
      pass1.push(op, rhs);
    }
  }

  // Pass 2: + and -
  let acc = pass1[0];
  for (let j = 1; j < pass1.length; j += 2) {
    const op = pass1[j];
    const rhs = pass1[j + 1];
    acc = op === '+' ? acc + rhs : acc - rhs;
    if (!Number.isFinite(acc)) return null;
  }

  const rounded = Math.round(acc * 1e8) / 1e8;
  return Number.isFinite(rounded) ? rounded : null;
}

// Noise buffer helper for Web Audio channels
function createNoiseSource(ctx, mode = 'brown') {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (mode === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
  } else {
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

let taskIdCounter = 1;

function App() {
  // Calculator State
  const [calcInput, setCalcInput] = useState('0');
  const [isResult, setIsResult] = useState(false);

  // Weather & Time State
  const [weather, setWeather] = useState({ temp: '--', condition: 'Clear', loc: 'Berlin' });
  const [locatingWeather, setLocatingWeather] = useState(false);
  const [time, setTime] = useState(() => new Date());

  // Sleep / Focus Mode
  const [sleepMode, setSleepMode] = useState(false);

  // Pomodoro State (drift-free wall-clock timer)
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState('focus');
  const pomoEndRef = useRef(null);
  const pomoRemainingRef = useRef(25 * 60);
  const alarmTimersRef = useRef([]);

  // Tasks & Notes State (persisted safely in localStorage)
  const [tasks, setTasks] = useState(() =>
    safeReadStorage(
      'chill_hub_tasks',
      [],
      (v) =>
        Array.isArray(v) &&
        v.every((item) => item && typeof item.text === 'string' && typeof item.done === 'boolean')
    )
  );
  const [newTask, setNewTask] = useState('');
  const [notes, setNotes] = useState(() =>
    safeReadStorage('chill_hub_notes', '', (v) => typeof v === 'string')
  );

  // Breathing State
  const [breathPhase, setBreathPhase] = useState('idle'); // idle, in, hold, out

  // Theme State
  const [theme, setTheme] = useState(() =>
    safeReadStorage('chill_hub_theme', 'default', (v) => VALID_THEMES.includes(v))
  );

  // Audio Mixer State
  const audioCtxRef = useRef(null);
  const nodesRef = useRef({});
  const stopAudioTimerRef = useRef(null);
  const [volumes, setVolumes] = useState(() =>
    safeReadStorage('chill_hub_volumes', DEFAULT_VOLUMES, (v) => {
      if (!v || typeof v !== 'object') return false;
      return ['rain', 'waves', 'brown', 'binaural'].every(
        (k) => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100
      );
    })
  );
  const volumesRef = useRef(volumes);

  useEffect(() => {
    volumesRef.current = volumes;
    safeWriteStorage('chill_hub_volumes', volumes);
  }, [volumes]);

  useEffect(() => {
    safeWriteStorage('chill_hub_tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    safeWriteStorage('chill_hub_notes', notes);
  }, [notes]);

  useEffect(() => {
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'default';
    document.body.className = `theme-${safeTheme}`;
    safeWriteStorage('chill_hub_theme', safeTheme);
    return () => {
      document.body.className = '';
    };
  }, [theme]);

  // Shared AudioContext getter to prevent leaking multiple AudioContext instances
  const ensureAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playThock = useCallback(() => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.09);

      gainNode.gain.setValueAtTime(0.35, now);
      gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.09);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gainNode.disconnect();
        } catch {
          // Already disconnected
        }
      };

      osc.start(now);
      osc.stop(now + 0.095);
    } catch {
      // Ignore blocked autoplay
    }
  }, [ensureAudioContext]);

  const teardownMixerNodes = useCallback((immediate = false) => {
    if (stopAudioTimerRef.current !== null) {
      clearTimeout(stopAudioTimerRef.current);
      stopAudioTimerRef.current = null;
    }

    const activeEntries = Object.values(nodesRef.current);
    nodesRef.current = {};
    if (activeEntries.length === 0) return;

    const ctx = audioCtxRef.current;
    const stopAllNow = () => {
      for (const entry of activeEntries) {
        for (const src of entry.sources || []) {
          try {
            src.stop();
          } catch {
            // Already stopped
          }
        }
        for (const node of entry.nodes || []) {
          try {
            node.disconnect();
          } catch {
            // Already disconnected
          }
        }
      }
    };

    if (immediate || !ctx || ctx.state === 'closed') {
      stopAllNow();
      return;
    }

    const now = ctx.currentTime;
    for (const entry of activeEntries) {
      try {
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
        entry.gain.gain.linearRampToValueAtTime(0, now + 0.25);
      } catch {
        // Ignore ramp edge case
      }
    }

    stopAudioTimerRef.current = setTimeout(() => {
      stopAudioTimerRef.current = null;
      stopAllNow();
    }, 280);
  }, []);

  // Cleanup AudioContext and all timers on unmount
  useEffect(() => {
    return () => {
      for (const id of alarmTimersRef.current) {
        clearTimeout(id);
      }
      alarmTimersRef.current = [];
      teardownMixerNodes(true);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [teardownMixerNodes]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Drift-free Pomodoro Timer using monotonic deadline comparison
  useEffect(() => {
    if (!pomoActive) {
      pomoEndRef.current = null;
      return undefined;
    }

    pomoEndRef.current = Date.now() + pomoRemainingRef.current * 1000;

    const interval = setInterval(() => {
      if (pomoEndRef.current === null) return;
      const secsLeft = Math.max(0, Math.ceil((pomoEndRef.current - Date.now()) / 1000));
      pomoRemainingRef.current = secsLeft;
      setPomoTime(secsLeft);

      if (secsLeft <= 0) {
        playThock();
        const t1 = setTimeout(playThock, 200);
        const t2 = setTimeout(playThock, 400);
        alarmTimersRef.current.push(t1, t2);

        if (pomoMode === 'focus') {
          const nextDuration = 5 * 60;
          pomoRemainingRef.current = nextDuration;
          pomoEndRef.current = Date.now() + nextDuration * 1000;
          setPomoMode('break');
          setPomoTime(nextDuration);
        } else {
          const nextDuration = 25 * 60;
          pomoRemainingRef.current = nextDuration;
          pomoEndRef.current = null;
          setPomoMode('focus');
          setPomoTime(nextDuration);
          setPomoActive(false);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [pomoActive, pomoMode, playThock]);

  const togglePomodoro = () => {
    pomoRemainingRef.current = pomoTime;
    setPomoActive((prev) => !prev);
  };

  const resetPomodoro = () => {
    setPomoActive(false);
    const resetSecs = pomoMode === 'focus' ? 25 * 60 : 5 * 60;
    pomoRemainingRef.current = resetSecs;
    setPomoTime(resetSecs);
  };

  // Weather fetch helper (defaults to Berlin without unsolicited GPS prompt or IP-tracking services)
  const fetchWeatherByCoords = useCallback((lat, lon, locLabel, signal) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    axios
      .get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
        { timeout: 6000, signal }
      )
      .then((res) => {
        const current = res.data?.current;
        if (!current || typeof current.temperature_2m !== 'number') {
          throw new Error('Invalid weather payload');
        }
        const code = Number(current.weather_code) || 0;
        let cond = 'Clear';
        if (code >= 71 && code <= 86) cond = 'Snowy';
        else if ((code >= 51 && code <= 67) || code >= 80) cond = 'Rainy';

        setWeather({
          temp: Math.round(current.temperature_2m * 10) / 10,
          condition: cond,
          loc: locLabel
        });
      })
      .catch((err) => {
        if (axios.isCancel(err) || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        setWeather({ temp: '--', condition: 'Clear', loc: `${locLabel} (Offline)` });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeatherByCoords(52.52, 13.41, 'Berlin', controller.signal);
    return () => controller.abort();
  }, [fetchWeatherByCoords]);

  const handleLocateWeather = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocatingWeather(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocatingWeather(false);
          fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'Local GPS');
        },
        () => {
          setLocatingWeather(false);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 }
      );
    } catch {
      setLocatingWeather(false);
    }
  };

  // Audio Mixer Engine with complete source & node tracking
  useEffect(() => {
    if (!sleepMode) {
      teardownMixerNodes(false);
      return;
    }

    if (stopAudioTimerRef.current !== null) {
      clearTimeout(stopAudioTimerRef.current);
      stopAudioTimerRef.current = null;
    }

    const ctx = ensureAudioContext();
    if (!ctx) return;

    const currentVols = volumesRef.current;

    const setupChannel = (name, builder) => {
      if (nodesRef.current[name]) return;
      const gain = ctx.createGain();
      gain.gain.value = (currentVols[name] || 0) / 100;
      gain.connect(ctx.destination);

      const { output, sources, nodes } = builder(ctx);
      output.connect(gain);

      for (const src of sources) {
        src.start();
      }

      nodesRef.current[name] = {
        gain,
        sources,
        nodes: [...nodes, output, gain]
      };
    };

    // Binaural (200Hz L, 204Hz R = 4Hz beat)
    setupChannel('binaural', (c) => {
      const merger = c.createChannelMerger(2);
      const oscL = c.createOscillator();
      oscL.frequency.value = 200;
      const oscR = c.createOscillator();
      oscR.frequency.value = 204;
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      return { output: merger, sources: [oscL, oscR], nodes: [oscL, oscR] };
    });

    // Deep Brown Noise
    setupChannel('brown', (c) => {
      const noise = createNoiseSource(c, 'brown');
      return { output: noise, sources: [noise], nodes: [] };
    });

    // Rain (Filtered pink noise)
    setupChannel('rain', (c) => {
      const noise = createNoiseSource(c, 'pink');
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      noise.connect(filter);
      return { output: filter, sources: [noise], nodes: [noise] };
    });

    // Ocean Waves (Lowpass brown noise modulated by 0.1Hz LFO swell)
    setupChannel('waves', (c) => {
      const noise = createNoiseSource(c, 'brown');
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;

      const mainGain = c.createGain();
      mainGain.gain.value = 0.5;

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.1; // 10-second wave swell
      const lfoDepth = c.createGain();
      lfoDepth.gain.value = 0.38;

      lfo.connect(lfoDepth);
      lfoDepth.connect(mainGain.gain);

      noise.connect(filter);
      filter.connect(mainGain);

      return {
        output: mainGain,
        sources: [noise, lfo],
        nodes: [noise, filter, lfo, lfoDepth]
      };
    });
  }, [sleepMode, ensureAudioContext, teardownMixerNodes]);

  // Smoothly update channel volumes
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !sleepMode) return;
    const now = ctx.currentTime;
    for (const key of Object.keys(volumes)) {
      const ch = nodesRef.current[key];
      if (ch) {
        const clamped = Math.min(100, Math.max(0, Number(volumes[key]) || 0)) / 100;
        ch.gain.gain.setTargetAtTime(clamped, now, 0.08);
      }
    }
  }, [volumes, sleepMode]);

  // 4-7-8 Breathing Timer managed cleanly via React effect (no leaked timeouts)
  useEffect(() => {
    if (breathPhase === 'idle') return undefined;

    const durations = { in: 4000, hold: 7000, out: 8000 };
    const nextPhase = { in: 'hold', hold: 'out', out: 'in' };

    const timer = setTimeout(() => {
      setBreathPhase((prev) => (prev === 'idle' ? 'idle' : nextPhase[prev] || 'in'));
    }, durations[breathPhase] || 4000);

    return () => clearTimeout(timer);
  }, [breathPhase]);

  const toggleBreathing = () => {
    setBreathPhase((prev) => (prev === 'idle' ? 'in' : 'idle'));
  };

  // Safe Calculator Input Handler
  const handleCalcClick = (val) => {
    playThock();
    if (val === 'C') {
      setCalcInput('0');
      setIsResult(false);
      return;
    }
    if (val === '⌫') {
      if (isResult || calcInput === 'Error' || calcInput.length <= 1) {
        setCalcInput('0');
        setIsResult(false);
      } else {
        setCalcInput((prev) => prev.slice(0, -1));
      }
      return;
    }
    if (val === '=') {
      const evaluated = evaluateMathExpression(calcInput);
      setCalcInput(evaluated === null ? 'Error' : String(evaluated));
      setIsResult(true);
      return;
    }
    if (['+', '-', '*', '/'].includes(val)) {
      if (calcInput === 'Error') {
        setCalcInput(val === '-' ? '-' : `0${val}`);
      } else {
        const lastChar = calcInput.slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) {
          setCalcInput(calcInput.slice(0, -1) + val);
        } else {
          setCalcInput(calcInput + val);
        }
      }
      setIsResult(false);
      return;
    }
    if (val === '.') {
      if (isResult || calcInput === 'Error') {
        setCalcInput('0.');
        setIsResult(false);
        return;
      }
      const parts = calcInput.split(/[+\-*/]/);
      const currentSegment = parts[parts.length - 1] || '';
      if (!currentSegment.includes('.')) {
        setCalcInput((prev) => (prev === '' || /[+\-*/]$/.test(prev) ? `${prev}0.` : `${prev}.`));
      }
      return;
    }
    if (isResult || calcInput === '0' || calcInput === 'Error') {
      setCalcInput(val);
      setIsResult(false);
    } else if (calcInput.length < 28) {
      setCalcInput((prev) => prev + val);
    }
  };

  const addTask = (e) => {
    const trimmed = newTask.trim();
    if (e.key === 'Enter' && trimmed) {
      const nextId = `t-${Date.now()}-${taskIdCounter++}`;
      setTasks((prev) => [...prev, { id: nextId, text: trimmed, done: false }]);
      setNewTask('');
    }
  };

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTask = (e, id) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompletedTasks = () => {
    setTasks((prev) => prev.filter((t) => !t.done));
  };

  const formatTime = (sec) =>
    `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <div className="hub-container">
      <header className="hub-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="/" aria-label="Return to Hub" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            <ArrowLeft />
          </a>
          <h1>Chill Hub</h1>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Color Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '20px',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <option value="default" style={{ color: '#000' }}>Cosmic Dust (Default)</option>
            <option value="space" style={{ color: '#000' }}>Deep Space</option>
            <option value="sea" style={{ color: '#000' }}>Ocean Depths</option>
            <option value="pinky" style={{ color: '#000' }}>Romantic Rose</option>
            <option value="football" style={{ color: '#000' }}>Football Pitch</option>
          </select>
          <button
            type="button"
            onClick={() => setSleepMode(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--glass-border)',
              padding: '10px 20px',
              borderRadius: '20px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            <Headphones size={20} /> Enter Focus Mode
          </button>
        </div>
      </header>

      <div className="hub-grid">
        {/* Weather & Time */}
        <div className="glass-card weather-card">
          <div className={`weather-visual ${weather.condition}`}>
            {weather.condition === 'Clear' && <div className="sun-orb"></div>}
            <div className="cloud" style={{ width: '100px', height: '40px', top: '20%', animationDuration: '20s' }}></div>
            <div
              className="cloud"
              style={{ width: '150px', height: '60px', top: '40%', animationDuration: '35s', animationDelay: '-10s' }}
            ></div>
            {weather.condition === 'Rainy' &&
              RAIN_PARTICLES.map((p) => (
                <div
                  key={p.id}
                  className="rain-drop"
                  style={{ left: p.left, animationDuration: p.animationDuration, animationDelay: p.animationDelay }}
                />
              ))}
            {weather.condition === 'Snowy' &&
              SNOW_PARTICLES.map((p) => (
                <div
                  key={p.id}
                  className="snow-flake"
                  style={{ left: p.left, animationDuration: p.animationDuration, animationDelay: p.animationDelay }}
                />
              ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '10px',
              zIndex: 1
            }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Sun /> {weather.loc}
            </h2>
            <button
              type="button"
              onClick={handleLocateWeather}
              disabled={locatingWeather}
              title="Use local GPS for weather"
              style={{
                background: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '14px',
                color: 'white',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <MapPin size={12} /> {locatingWeather ? '...' : 'GPS'}
            </button>
          </div>
          <div className="weather-info" style={{ zIndex: 1 }}>
            <div className="weather-temp">{weather.temp}°C</div>
            <div style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {weather.condition === 'Rainy' ? <CloudRain /> : <Cloud />} {weather.condition}
            </div>
          </div>
          <div style={{ zIndex: 1, marginTop: '20px', fontSize: '2rem', fontWeight: 'bold' }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Pomodoro Timer */}
        <div className="glass-card flex-center col">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', alignSelf: 'flex-start' }}>
            <RotateCcw /> Pomodoro
          </h2>
          <div className={`pomo-ring ${pomoMode}`}>
            <div className="pomo-time">{formatTime(pomoTime)}</div>
            <div className="pomo-label">{pomoMode.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              aria-label={pomoActive ? 'Pause timer' : 'Start timer'}
              className="pomo-btn"
              onClick={togglePomodoro}
            >
              {pomoActive ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button type="button" aria-label="Reset timer" className="pomo-btn" onClick={resetPomodoro}>
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Check /> Focus Tasks
            </h2>
            {tasks.some((t) => t.done) && (
              <button
                type="button"
                onClick={clearCompletedTasks}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  color: 'var(--text-muted)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Clear Done
              </button>
            )}
          </div>
          <input
            type="text"
            className="task-input"
            placeholder="Add a task & press Enter..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={addTask}
          />
          <div className="task-list">
            {tasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                All clear! Enjoy your break.
              </p>
            ) : null}
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`task-item ${t.done ? 'done' : ''}`}
                onClick={() => toggleTask(t.id)}
              >
                <div className="task-checkbox">{t.done && <Check size={14} />}</div>
                <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.text}</span>
                <button
                  type="button"
                  aria-label="Delete task"
                  onClick={(e) => removeTask(e, t.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'inline-flex'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Notes (Persisted) */}
        <div className="glass-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <FileText /> Quick Notes
          </h2>
          <textarea
            aria-label="Quick Notes"
            placeholder="Jot down thoughts, reminders, or focus goals (saved locally)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              flex: 1,
              minHeight: '190px',
              width: '100%',
              resize: 'vertical',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '14px',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              outline: 'none'
            }}
          />
        </div>

        {/* Breathing Exercise */}
        <div className="glass-card flex-center col relative overflow-hidden">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', alignSelf: 'flex-start', zIndex: 2 }}>
            <Wind /> 4-7-8 Breathing
          </h2>

          <div className="breath-container">
            <div className={`breath-scaler phase-${breathPhase}`}>
              <div className="breath-blob blob-1"></div>
              <div className="breath-blob blob-2"></div>
              <div className="breath-blob blob-3"></div>
            </div>
            <div className="breath-text">
              {breathPhase === 'idle'
                ? 'START'
                : breathPhase === 'in'
                  ? 'INHALE'
                  : breathPhase === 'hold'
                    ? 'HOLD'
                    : 'EXHALE'}
            </div>
          </div>
          <button
            type="button"
            className="pomo-btn"
            style={{ marginTop: '20px', zIndex: 2, width: 'auto', padding: '0 22px' }}
            onClick={toggleBreathing}
          >
            {breathPhase === 'idle' ? 'Begin Exercise' : 'Stop'}
          </button>
        </div>

        {/* Satisfying Calculator */}
        <div className="glass-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calculator /> Quick Calc
          </h2>
          <div className="calc-display">{calcInput}</div>
          <div className="calc-grid">
            {['C', '⌫', '/', '*', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '.', '0', '='].map((btn) => (
              <button
                type="button"
                key={btn}
                className={`calc-btn ${['/', '*', '-', '+', 'C', '⌫'].includes(btn) ? 'op' : ''} ${btn === '=' ? 'eq' : ''} ${btn === '0' ? 'zero' : ''}`}
                onClick={() => handleCalcClick(btn)}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sleep Mode / Focus Overlay with Soundscape Mixer */}
      <div className={`sleep-overlay ${sleepMode ? 'active' : ''}`}>
        <button type="button" className="close-sleep" onClick={() => setSleepMode(false)}>
          Exit Ambient Mode
        </button>

        <div className="sleep-clock">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: '10px', fontSize: '1.2rem', marginBottom: '40px' }}>
          <Moon size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Deep Focus Active
        </div>

        <div className="mixer-panel glass-card">
          <h3 style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
            Soundscape Mixer
          </h3>

          <div className="mixer-controls">
            <div className="mix-channel">
              <label htmlFor="vol-rain">Rain</label>
              <input
                id="vol-rain"
                type="range"
                min="0"
                max="100"
                value={volumes.rain}
                onChange={(e) => setVolumes((v) => ({ ...v, rain: Number(e.target.value) }))}
              />
            </div>
            <div className="mix-channel">
              <label htmlFor="vol-waves">Ocean Waves</label>
              <input
                id="vol-waves"
                type="range"
                min="0"
                max="100"
                value={volumes.waves}
                onChange={(e) => setVolumes((v) => ({ ...v, waves: Number(e.target.value) }))}
              />
            </div>
            <div className="mix-channel">
              <label htmlFor="vol-brown">Deep Brown Noise</label>
              <input
                id="vol-brown"
                type="range"
                min="0"
                max="100"
                value={volumes.brown}
                onChange={(e) => setVolumes((v) => ({ ...v, brown: Number(e.target.value) }))}
              />
            </div>
            <div className="mix-channel">
              <label htmlFor="vol-binaural">Binaural Beats (Theta)</label>
              <input
                id="vol-binaural"
                type="range"
                min="0"
                max="100"
                value={volumes.binaural}
                onChange={(e) => setVolumes((v) => ({ ...v, binaural: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
