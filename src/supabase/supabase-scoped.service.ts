import { Inject, Injectable, Scope, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class SupabaseScopedService {
  private readonly logger = new Logger(SupabaseScopedService.name);
  private scopedClient: SupabaseClient | null = null;

  constructor(
    @Inject(REQUEST) private request: Request,
    private configService: ConfigService,
  ) {}

  getClient(): SupabaseClient {
    if (this.scopedClient) {
      return this.scopedClient;
    }

    const url = this.configService.get<string>('SUPABASE_URL');
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
      this.logger.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
      throw new Error('Database credentials not configured correctly.');
    }

    // Extract Bearer token from the incoming request
    const authHeader = this.request.headers.authorization;
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (token) {
       this.logger.debug('Initializing context-aware Supabase Client with User JWT');
       this.scopedClient = createClient(url, anonKey, {
         global: { headers: { Authorization: `Bearer ${token}` } }
       });
    } else {
       this.logger.debug('Initializing anonymous Supabase Client (No JWT)');
       this.scopedClient = createClient(url, anonKey);
    }

    return this.scopedClient;
  }
}
