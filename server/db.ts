import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, NeonClient } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle<typeof schema>(sql as NeonClient);