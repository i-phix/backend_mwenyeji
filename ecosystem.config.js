module.exports = {
    apps: [
      {
        name: 'backend',
        script: './app.js',
        instances: 1, // Or 'max' for clustering
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'development'
        },
        env_production: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  