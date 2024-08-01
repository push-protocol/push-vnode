module.exports = {
  apps: [
    {
      name: 'EPNS Push Node',
      script: 'build/app.js',
      instances: '1',
      max_memory_restart: '2048M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'IPFS Daemon',
      script: 'ipfs daemon',
      instances: '1',
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'Redis Server',
      script: 'redis-server',
      instances: '1',
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
}
