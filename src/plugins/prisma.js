import { PrismaClient } from '@prisma/client';

let prisma;

export async function prismaPlugin(fastify) {
  if (!prisma) {
    prisma = new PrismaClient();

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  }

  fastify.decorate('db', prisma);
}
