import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use direct connection for CLI operations (introspect, migrate)
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!,
  },
});
