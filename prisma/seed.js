const bcrypt = require('bcryptjs')
const prisma = require('../src/core/database/prisma')

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@radora.com' }
  })

  if (existing) {
    console.log('Admin already exists')
    return
  }

  const hashed = await bcrypt.hash('admin123', 12)

  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@radora.com',
      password: hashed,
      role: 'admin'
    }
  })

  console.log('Admin created: admin@radora.com / admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
