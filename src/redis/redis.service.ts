import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      this.logger.warn('Upstash Redis credentials missing — caching will be disabled.');
      return;
    }

    this.client = new Redis({ url, token });
    this.logger.log('Upstash Redis connected via REST API.');
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      return await this.client.get<T>(key);
    } catch (err) {
      this.logger.error(`Redis GET error [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      this.logger.error(`Redis SET error [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.error(`Redis DEL error [${key}]: ${err.message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.error(`Redis DEL PATTERN error [${pattern}]: ${err.message}`);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.error(`Redis INCR error [${key}]: ${err.message}`);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch (err) {
      this.logger.error(`Redis EXPIRE error [${key}]: ${err.message}`);
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -1;
    try {
      return await this.client.ttl(key);
    } catch (err) {
      return -1;
    }
  }

  getClient(): Redis | null {
    return this.client ?? null;
  }
}
