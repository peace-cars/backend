import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}
  
  /**
   * Executes a callback within a Prisma transaction.
   * If any error is thrown within the callback, the transaction is automatically rolled back.
   */
  async runInTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { 
      maxWait: 5000, 
      timeout: 10000 
    });
  }
}
