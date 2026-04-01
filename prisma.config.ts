import * as dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const myEnv = dotenv.config();
expand(myEnv);

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL?.trim(),
  },
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
});
