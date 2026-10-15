const express = require('express')
const app = express()

const routes = require('./api/v1/routes')
const cors = require('cors')

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error("Origin is not allowed"))
  },
}))

// Middlewares
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl.includes('/payments/cashfree/webhook')) req.rawBody = Buffer.from(buffer)
  },
}))

// Health check
app.get('/', (req, res) => {
  res.send('Radora API running 🚀')
})

// API routes
app.use('/api/v1', routes)

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    message: err.message || 'Internal Server Error'
  })
})

module.exports = app
