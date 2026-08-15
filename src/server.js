require('dotenv').config()

const app = require('./app')
const redis = require('./core/cache/redis')
const { ensureLogoReady } = require('./shared/utils/email.logo')

const PORT = Number(process.env.PORT) || 5000

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)

  try {
    await redis.set('test', 'radora')
    const value = await redis.get('test')
    console.log('Redis Test:', value)
  } catch (err) {
    console.log('Redis test failed:', err.message)
  }

  // Warm the logo URL cache so all emails have it ready
  ensureLogoReady().catch(() => {})
})