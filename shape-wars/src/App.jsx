import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Bomb, Shield, Circle } from 'lucide-react';
import { GameEngine } from './Engine';
import './index.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reqRef = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

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

  return (
    <>
      {!started && (
        <div className="start-overlay">
          <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
            <a href="/" style={{color: 'white', textDecoration: 'none', pointerEvents: 'auto'}}><ArrowLeft size={32} /></a>
          </div>
          <h1 style={{fontSize: '4rem', marginBottom: '20px', textShadow: '0 0 20px #fff'}}>Shape Wars</h1>
          <p style={{marginBottom: '40px', fontSize: '1.2rem', color: '#ccc'}}>The Emotional Battle Simulator</p>
          <button className="start-btn" onClick={handleStart}>
            <Play fill="white" size={32} /> Start Simulation
          </button>
        </div>
      )}

      {started && (
        <div className="hud">
          <a href="/" style={{color: 'white', textDecoration: 'none', pointerEvents: 'auto'}}><ArrowLeft size={32} /></a>
          
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
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'block', width: '100vw', height: '100vh' }} />
    </>
  );
}

export default App;
