// PM2 Process Manager Configuration (for non-Docker bare-metal deployments)
// Tip: Run `pm2 install pm2-logrotate && pm2 set pm2-logrotate:retain 7 && pm2 set pm2-logrotate:max_size 10M`
// so PM2 logs are capped and rotated within 7 days (GDPR data minimization).

// Only forward optional keys when non-empty in the parent shell so Node's
// `--env-file-if-exists=.env` is never shadowed by empty/default values.
const passthroughEnv = {
  ...(process.env.PORT ? { PORT: process.env.PORT } : {}),
  ...(process.env.DOMAIN ? { DOMAIN: process.env.DOMAIN } : {}),
  ...(process.env.DB_PATH ? { DB_PATH: process.env.DB_PATH } : {}),
  ...(process.env.SECURITY_SECRET ? { SECURITY_SECRET: process.env.SECURITY_SECRET } : {})
};

module.exports = {
  apps: [
    {
      name: "swiss-knife-hub",
      script: "./server.js",
      // Must stay single-instance (`fork` mode): database.js & security.js maintain
      // in-memory state backed by atomic single-writer `data/hub_db.json` persistence.
      instances: 1,
      exec_mode: "fork",
      // Load `.env` automatically on Node >= 20.10 / Node 22+ without external dotenv package
      node_args: ["--env-file-if-exists=.env"],
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
      kill_timeout: 10000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "development",
        ...passthroughEnv
      },
      env_production: {
        NODE_ENV: "production",
        ...passthroughEnv
      }
    }
  ]
};
