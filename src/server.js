require('dotenv').config()

const app = require('./app')
const redis = require('./core/cache/redis') // 👈 ADD THIS

app.listen(5000, async () => {
  console.log('Server running')

  // 🔥 TEMP REDIS TEST
  try {
    await redis.set('test', 'radora')
    const value = await redis.get('test')
    console.log('Redis Test:', value)
  } catch (err) {
    console.log('Redis test failed:', err.message)
  }
})