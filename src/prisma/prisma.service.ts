import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Only configure the adapter if the DATABASE_URL is available
    let adapter;
    if (process.env.DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      adapter = new PrismaPg(pool);
    }
    
    super({
      adapter,
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Client connected to database.');
    } catch (error: any) {
      this.logger.error(`Prisma connection failed: ${error.message}`);
      // Don't throw — allow the app to start; Supabase REST is still available as fallback
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected.');
  }
}
