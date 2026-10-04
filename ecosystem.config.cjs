// ====================================================
// KAYDO BOT - PM2 PROCESS SUPERVISOR (24/7 RUNTIME)
// Usage: npx pm2 start ecosystem.config.cjs
// ====================================================

module.exports = {
  apps: [
    {
      name: 'shado bot',
      script: 'dist/server.cjs',
      instances: 1, // Single instance required to prevent WhatsApp Baileys session lock conflicts
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000, // 10s graceful termination window for clean Baileys socket closure
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
