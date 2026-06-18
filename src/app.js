const express = require('express')
const app = express()

const routes = require('./api/v1/routes')
const cors = require('cors')

app.use(cors())

// Middlewares
app.use(express.json({ limit: '10mb' }))

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
