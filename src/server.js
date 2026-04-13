require('dotenv').config()

const app = require('./app')
const connectDB = require('./core/database/mongo')

connectDB()

app.listen(5000, () => console.log('Server running'))