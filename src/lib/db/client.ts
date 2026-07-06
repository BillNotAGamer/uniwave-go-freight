import "server-only";

import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

export const db = drizzle({
  connection: env.DATABASE_URL,
  schema,
  ws,
});

export type Database = typeof db;
