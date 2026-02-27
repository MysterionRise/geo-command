import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  // Seed default AI engines
  const engines = [
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      label: 'Claude Sonnet 4',
      isDefault: true,
      maxTokens: 4096,
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      label: 'GPT-4o',
      isDefault: false,
      maxTokens: 4096,
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      isDefault: false,
      maxTokens: 4096,
    },
  ]

  for (const engine of engines) {
    await prisma.aIEngine.upsert({
      where: { id: `${engine.provider}-${engine.model}` },
      update: { ...engine },
      create: { id: `${engine.provider}-${engine.model}`, ...engine },
    })
  }

  console.log(`Seeded ${engines.length} AI engines`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
