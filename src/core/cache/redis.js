const Redis = require('ioredis')

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  username: 'default',
  password: process.env.REDIS_PASSWORD,

})

redis.on('connect', () => {
  console.log('✅ Redis Cloud connected')
})

redis.on('error', (err) => {
  console.log('❌ Redis error:', err.message)
})

module.exports = redis