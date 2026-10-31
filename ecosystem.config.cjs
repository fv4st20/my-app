module.exports = {
  apps: [
    {
      name: "swiss-knife-hub",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        DOMAIN: "localhost"
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        DOMAIN: process.env.DOMAIN || "yourdomain.com"
      }
    }
  ]
};
