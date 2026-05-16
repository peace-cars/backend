import { Module } from '@nestjs/common';
import { PeopleController } from './people.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PeopleController]
})
export class PeopleModule {}
