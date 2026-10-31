import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN ? process.env.DOMAIN.trim() : '';

// Trust first proxy (Nginx / Cloudflare / Docker bridge) for accurate protocol & client IP
app.set('trust proxy', 1);

// Health check endpoint for Docker & uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Serve the Launchpad Dashboard at root
app.use(express.static(path.join(__dirname, 'dashboard')));

// Serve the apps on their respective paths
app.use('/neon-orbit', express.static(path.join(__dirname, 'neon-orbit', 'dist')));
app.use('/star-locator', express.static(path.join(__dirname, 'star_locator', 'dist')));
app.use('/chem-lab', express.static(path.join(__dirname, 'chem-lab', 'dist')));
app.use('/chill-hub', express.static(path.join(__dirname, 'chill-hub', 'dist')));
app.use('/shape-wars', express.static(path.join(__dirname, 'shape-wars', 'dist')));
app.use('/sonic-soccer', express.static(path.join(__dirname, 'sonic-soccer', 'dist')));
app.use('/nond_ex', express.static(path.join(__dirname, 'nond_ex', 'dist')));
app.use('/alien-echo', express.static(path.join(__dirname, 'alien-echo', 'dist')));
app.use('/pirate-fishing', express.static(path.join(__dirname, 'pirate-fishing', 'dist')));

// Fallback for SPA routing inside the sub-apps (if they use client-side routing)
app.get('/star-locator/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'star_locator', 'dist', 'index.html'));
});

app.get('/neon-orbit/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'neon-orbit', 'dist', 'index.html'));
});

app.get('/chem-lab/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'chem-lab', 'dist', 'index.html'));
});

app.get('/chill-hub/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'chill-hub', 'dist', 'index.html'));
});

app.get('/shape-wars/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'shape-wars', 'dist', 'index.html'));
});

app.get('/sonic-soccer/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'sonic-soccer', 'dist', 'index.html'));
});

app.get('/nond_ex/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'nond_ex', 'dist', 'index.html'));
});

app.get('/alien-echo/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'alien-echo', 'dist', 'index.html'));
});

app.get('/pirate-fishing/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'pirate-fishing', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const publicBase = DOMAIN
    ? (DOMAIN.startsWith('http://') || DOMAIN.startsWith('https://') ? DOMAIN.replace(/\/$/, '') : `https://${DOMAIN}`)
    : `http://localhost:${PORT}`;

  console.log(`🚀 Swiss Knife Server running at http://0.0.0.0:${PORT}`);
  if (DOMAIN) {
    console.log(`🌐 Public Domain: ${publicBase}`);
  }
  console.log(`- Dashboard:      ${publicBase}/`);
  console.log(`- Neon Orbit:     ${publicBase}/neon-orbit/`);
  console.log(`- Star Locator:   ${publicBase}/star-locator/`);
  console.log(`- Chem Lab:       ${publicBase}/chem-lab/`);
  console.log(`- Chill Hub:      ${publicBase}/chill-hub/`);
  console.log(`- Shape Wars:     ${publicBase}/shape-wars/`);
  console.log(`- Sonic Soccer:   ${publicBase}/sonic-soccer/`);
  console.log(`- nond_ex:        ${publicBase}/nond_ex/`);
  console.log(`- Alien Echo:     ${publicBase}/alien-echo/`);
  console.log(`- Pirate Fishing: ${publicBase}/pirate-fishing/`);
});
