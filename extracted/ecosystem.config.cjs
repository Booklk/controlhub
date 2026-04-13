/**
 * PM2 Ecosystem Config — ControlHub-2026
 * Usage: pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: 'controlhub',
      script: './dist/index.cjs',
      instances: 'max',           // Cluster mode: one instance per CPU core
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Logging
      out_file: './logs/app-out.log',
      error_file: './logs/app-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart policy
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '5s',
      // Graceful shutdown
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 15000,
    },
  ],
};
