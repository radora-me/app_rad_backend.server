const express = require('express')
const app = express()
const multer = require('multer')

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

// Keep profile photos in memory so they can be sent directly to Cloudinary.
app.use(multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed'))
    }
    callback(null, true)
  },
}).single('photo'))

// Health check
app.get('/', (req, res) => {
  res.send('Radora API running 🚀')
})

// API routes
app.use('/api/v1', routes)

// Global error handler
app.use((err, req, res, next) => {
  const status = err?.code === 'LIMIT_FILE_SIZE' || err?.message?.includes('Only JPEG') ? 400 : 500
  res.status(status).json({
    message: err.message || 'Internal Server Error'
  })
})

module.exports = app
