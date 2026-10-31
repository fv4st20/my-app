import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Moon, Sun, Cloud, CloudRain, CalendarDays, Calculator, ArrowLeft, Headphones, Play, Pause, RotateCcw, Check, Wind, Volume2 } from 'lucide-react';
import './index.css';

// --- Sound Synthesizers ---
const playThock = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) { }
};

// Brown noise generator (warmer than white noise)
const createBrownNoise = (ctx) => {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // Compensate gain
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
};

function App() {
  // Calculator State
  const [calcInput, setCalcInput] = useState('0');
  const [isResult, setIsResult] = useState(false);
  
  // Weather & Time State
  const [weather, setWeather] = useState({ temp: '--', condition: 'Loading...', loc: 'Locating...' });
  const [time, setTime] = useState(new Date());
  
  // Sleep / Focus Mode
  const [sleepMode, setSleepMode] = useState(false);
  
  // Pomodoro State
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState('focus'); // focus or break
  
  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  
  // Breathing State
  const [breathPhase, setBreathPhase] = useState('idle'); // idle, in, hold, out
  
  const [theme, setTheme] = useState('default');
  
  // Audio Mixer State
  const audioCtxRef = useRef(null);
  const [volumes, setVolumes] = useState({ rain: 0, waves: 0, brown: 0, binaural: 0 });
  const nodesRef = useRef({});

  // Apply Theme
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pomodoro Timer
  useEffect(() => {
    let interval = null;
    if (pomoActive && pomoTime > 0) {
      interval = setInterval(() => setPomoTime(t => t - 1), 1000);
    } else if (pomoActive && pomoTime === 0) {
      // Ring alarm (thock sequence)
      playThock(); setTimeout(playThock, 200); setTimeout(playThock, 400);
      if (pomoMode === 'focus') {
        setPomoMode('break');
        setPomoTime(5 * 60);
      } else {
        setPomoMode('focus');
        setPomoTime(25 * 60);
        setPomoActive(false);
      }
    }
    return () => clearInterval(interval);
  }, [pomoActive, pomoTime, pomoMode]);

  // Weather fetch (Dynamic Geolocation)
  useEffect(() => {
    const fetchWeather = (lat, lon, locName) => {
      axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
        .then(res => {
          const code = res.data.current.weather_code;
          let cond = 'Clear';
          if (code >= 71 && code <= 86) cond = 'Snowy';
          else if (code >= 51 && code <= 67 || code >= 95) cond = 'Rainy';
          
          setWeather({
            temp: res.data.current.temperature_2m,
            condition: cond,
            loc: locName
          });
        })
        .catch(() => setWeather({ temp: '??', condition: 'Offline', loc: 'Unknown' }));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Local'),
        () => {
          // IP fallback
          axios.get('https://ipapi.co/json/')
            .then(res => fetchWeather(res.data.latitude, res.data.longitude, res.data.city || 'IP Local'))
            .catch(() => fetchWeather(52.52, 13.41, 'Berlin (Fallback)'));
        }
      );
    }
  }, []);

  // Audio Mixer Engine
  useEffect(() => {
    if (sleepMode) {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      
      const ctx = audioCtxRef.current;
      const setupChannel = (name, nodeCreator) => {
        if (!nodesRef.current[name]) {
          const gain = ctx.createGain();
          gain.gain.value = 0;
          gain.connect(ctx.destination);
          
          const source = nodeCreator(ctx);
          source.connect(gain);
          if (source.start) source.start();
          
          nodesRef.current[name] = { source, gain };
        }
      };

      // Binaural (200Hz L, 204Hz R = 4Hz Theta wave)
      setupChannel('binaural', (c) => {
        const merger = c.createChannelMerger(2);
        const oscL = c.createOscillator(); oscL.frequency.value = 200;
        const oscR = c.createOscillator(); oscR.frequency.value = 204;
        oscL.connect(merger, 0, 0); oscR.connect(merger, 0, 1);
        oscL.start(); oscR.start();
        return merger;
      });

      // Brown Noise
      setupChannel('brown', createBrownNoise);

      // Rain (Pink/Brown noise through lowpass)
      setupChannel('rain', (c) => {
        const noise = createBrownNoise(c);
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        noise.disconnect();
        noise.connect(filter);
        return filter;
      });

      // Waves (Brown noise + LFO gain)
      setupChannel('waves', (c) => {
        const noise = createBrownNoise(c);
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.1; // 10 second swells
        const lfoGain = c.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain.gain);
        
        const mainGain = c.createGain();
        mainGain.gain.value = 0.5;
        lfoGain.connect(mainGain);
        
        noise.disconnect();
        noise.connect(filter);
        filter.connect(mainGain);
        
        lfo.start();
        return mainGain;
      });

    } else {
      // Cleanup audio when leaving sleep mode
      if (audioCtxRef.current) {
        Object.values(nodesRef.current).forEach(n => {
          n.gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 1);
          setTimeout(() => {
            if(n.source.stop) n.source.stop();
            if(n.source.disconnect) n.source.disconnect();
          }, 1000);
        });
        nodesRef.current = {};
      }
    }
  }, [sleepMode]);

  // Update Volumes
  useEffect(() => {
    if (audioCtxRef.current && sleepMode) {
      Object.keys(volumes).forEach(key => {
        if (nodesRef.current[key]) {
          // Map 0-100 to 0-1 (exponential curve for volume feels more natural, but linear is fine here)
          nodesRef.current[key].gain.gain.setTargetAtTime(volumes[key] / 100, audioCtxRef.current.currentTime, 0.1);
        }
      });
    }
  }, [volumes, sleepMode]);

  const handleCalcClick = (val) => {
    playThock();
    if (val === 'C') { setCalcInput('0'); setIsResult(false); return; }
    if (val === '=') {
      try {
        const sanitized = calcInput.replace(/[^0-9+\-*/.]/g, '');
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        const rounded = Math.round(result * 100000000) / 100000000;
        setCalcInput(rounded.toString());
        setIsResult(true);
      } catch {
        setCalcInput('Error');
        setIsResult(true);
      }
      return;
    }
    if (['+', '-', '*', '/'].includes(val)) {
      if (calcInput === 'Error') { setCalcInput('0' + val); } 
      else {
        const lastChar = calcInput.slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) { setCalcInput(calcInput.slice(0, -1) + val); } 
        else { setCalcInput(calcInput + val); }
      }
      setIsResult(false);
      return;
    }
    if (isResult || calcInput === '0' || calcInput === 'Error') {
      setCalcInput(val); setIsResult(false);
    } else {
      setCalcInput(prev => prev + val);
    }
  };

  const addTask = (e) => {
    if (e.key === 'Enter' && newTask.trim()) {
      setTasks([...tasks, { id: Date.now(), text: newTask, done: false }]);
      setNewTask('');
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  // Breathing Logic
  const startBreathing = () => {
    if (breathPhase !== 'idle') {
      setBreathPhase('idle');
      return;
    }
    const cycle = () => {
      setBreathPhase('in'); // 4s
      setTimeout(() => {
        setBreathPhase('hold'); // 7s
        setTimeout(() => {
          setBreathPhase('out'); // 8s
          setTimeout(() => {
            if (document.getElementById('b-trigger')?.dataset?.active === 'true') {
              cycle();
            }
          }, 8000);
        }, 7000);
      }, 4000);
    };
    cycle();
  };

  const formatTime = (sec) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

  const daysInMonth = new Date(time.getFullYear(), time.getMonth() + 1, 0).getDate();
  const firstDay = new Date(time.getFullYear(), time.getMonth(), 1).getDay();
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

  return (
    <div className="hub-container">
      <header className="hub-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <a href="/" style={{color: 'var(--text-muted)', textDecoration: 'none'}}><ArrowLeft /></a>
          <h1>Chill Hub</h1>
        </div>
        <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
          <select 
            value={theme} 
            onChange={e => setTheme(e.target.value)}
            style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 15px', borderRadius: '20px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit'}}
          >
            <option value="default" style={{color: '#000'}}>Cosmic Dust (Default)</option>
            <option value="space" style={{color: '#000'}}>Deep Space</option>
            <option value="sea" style={{color: '#000'}}>Ocean Depths</option>
            <option value="pinky" style={{color: '#000'}}>Romantic Rose</option>
            <option value="football" style={{color: '#000'}}>Football Pitch</option>
          </select>
          <button 
            onClick={() => setSleepMode(true)} 
            style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', padding: '10px 20px', borderRadius: '20px', color: 'white', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center'}}
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
             <div className="cloud" style={{width: '100px', height: '40px', top: '20%', animationDuration: '20s'}}></div>
             <div className="cloud" style={{width: '150px', height: '60px', top: '40%', animationDuration: '35s', animationDelay: '-10s'}}></div>
             {weather.condition === 'Rainy' && Array.from({length: 15}).map((_,i) => <div key={`r${i}`} className="rain-drop" style={{left: `${Math.random()*100}%`, animationDuration: `${0.8+Math.random()}s`, animationDelay: `${Math.random()}s`}}></div>)}
             {weather.condition === 'Snowy' && Array.from({length: 25}).map((_,i) => <div key={`s${i}`} className="snow-flake" style={{left: `${Math.random()*100}%`, animationDuration: `${2.5+Math.random()*2}s`, animationDelay: `${Math.random()*2}s`}}></div>)}
          </div>
          <h2 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', zIndex: 1}}><Sun /> {weather.loc}</h2>
          <div className="weather-info" style={{zIndex: 1}}>
            <div className="weather-temp">{weather.temp}°C</div>
            <div style={{fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px'}}>
              {weather.condition === 'Rainy' ? <CloudRain /> : <Cloud />} {weather.condition}
            </div>
          </div>
          <div style={{zIndex: 1, marginTop: '20px', fontSize: '2rem', fontWeight: 'bold'}}>{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>

        {/* Pomodoro Timer */}
        <div className="glass-card flex-center col">
          <h2 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', alignSelf: 'flex-start'}}><RotateCcw /> Pomodoro</h2>
          <div className={`pomo-ring ${pomoMode}`}>
            <div className="pomo-time">{formatTime(pomoTime)}</div>
            <div className="pomo-label">{pomoMode.toUpperCase()}</div>
          </div>
          <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
            <button className="pomo-btn" onClick={() => setPomoActive(!pomoActive)}>{pomoActive ? <Pause size={18}/> : <Play size={18}/>}</button>
            <button className="pomo-btn" onClick={() => { setPomoActive(false); setPomoTime(pomoMode === 'focus' ? 25*60 : 5*60); }}><RotateCcw size={18}/></button>
          </div>
        </div>

        {/* Task List */}
        <div className="glass-card">
          <h2 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}><Check /> Focus Tasks</h2>
          <input 
            type="text" 
            className="task-input" 
            placeholder="Add a task & press Enter..." 
            value={newTask} 
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={addTask}
          />
          <div className="task-list">
            {tasks.length === 0 ? <p style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px'}}>All clear! Enjoy your break.</p> : null}
            {tasks.map(t => (
              <div key={t.id} className={`task-item ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id)}>
                <div className="task-checkbox">{t.done && <Check size={14} />}</div>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breathing Exercise */}
        <div className="glass-card flex-center col relative overflow-hidden">
          <h2 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', alignSelf: 'flex-start', zIndex: 2}}><Wind /> 4-7-8 Breathing</h2>
          <div id="b-trigger" data-active={breathPhase !== 'idle'} style={{display: 'none'}}></div>
          
          <div className="breath-container">
            <div className={`breath-scaler phase-${breathPhase}`}>
              <div className="breath-blob blob-1"></div>
              <div className="breath-blob blob-2"></div>
              <div className="breath-blob blob-3"></div>
            </div>
            <div className="breath-text">
              {breathPhase === 'idle' ? 'START' : breathPhase === 'in' ? 'INHALE' : breathPhase === 'hold' ? 'HOLD' : 'EXHALE'}
            </div>
          </div>
          <button className="pomo-btn" style={{marginTop: '20px', zIndex: 2}} onClick={startBreathing}>
            {breathPhase === 'idle' ? 'Begin Exercise' : 'Stop'}
          </button>
        </div>

        {/* Satisfying Calculator */}
        <div className="glass-card">
          <h2 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}><Calculator /> Quick Calc</h2>
          <div className="calc-display">{calcInput}</div>
          <div className="calc-grid">
            {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'].map(btn => (
              <button key={btn} className={`calc-btn ${['/','*','-','+','C'].includes(btn) ? 'op' : ''} ${btn === '=' ? 'eq' : ''}`} onClick={() => handleCalcClick(btn)}>
                {btn}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Sleep Mode / Focus Overlay with Soundscape Mixer */}
      <div className={`sleep-overlay ${sleepMode ? 'active' : ''}`}>
        <button className="close-sleep" onClick={() => setSleepMode(false)}>Exit Ambient Mode</button>
        
        <div className="sleep-clock">
          {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
        <div style={{color: 'rgba(255,255,255,0.6)', marginTop: '10px', fontSize: '1.2rem', marginBottom: '40px'}}>
          <Moon size={18} style={{display: 'inline', verticalAlign: 'middle'}}/> Deep Focus Active
        </div>

        <div className="mixer-panel glass-card">
          <h3 style={{marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>Soundscape Mixer</h3>
          
          <div className="mixer-controls">
            <div className="mix-channel">
              <label>Rain</label>
              <input type="range" min="0" max="100" value={volumes.rain} onChange={(e) => setVolumes({...volumes, rain: Number(e.target.value)})} />
            </div>
            <div className="mix-channel">
              <label>Ocean Waves</label>
              <input type="range" min="0" max="100" value={volumes.waves} onChange={(e) => setVolumes({...volumes, waves: Number(e.target.value)})} />
            </div>
            <div className="mix-channel">
              <label>Deep Brown Noise</label>
              <input type="range" min="0" max="100" value={volumes.brown} onChange={(e) => setVolumes({...volumes, brown: Number(e.target.value)})} />
            </div>
            <div className="mix-channel">
              <label>Binaural Beats (Alpha)</label>
              <input type="range" min="0" max="100" value={volumes.binaural} onChange={(e) => setVolumes({...volumes, binaural: Number(e.target.value)})} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
