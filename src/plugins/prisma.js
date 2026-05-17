import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export default async function prismaPlugin(fastify) {
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
