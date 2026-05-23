#!/usr/bin/env node
// Apply care-ops SQL migrations to Supabase via direct postgres connection.
// Reads DATABASE_URL / POSTGRES_URL / SUPABASE_DB_URL / DIRECT_URL from env files.

const fs = require("fs");
const path = require("path");

function loadEnvFile(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[m[1]] == null) process.env[m[1]] = val;
    }
  } catch (_) {}
}
loadEnvFile(path.join(__dirname, "..", ".env.production.local"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));
loadEnvFile(path.join(__dirname, "..", ".env"));

const FILES = [
  "care-ops-incidents-v2.sql",
  "care-ops-handoffs-v2.sql",
  "care-ops-family-updates-v2.sql",
  "care-ops-staff-schedule-v2.sql"
];

async function main() {
  const url = process.env.DATABASE_URL
    || process.env.DIRECT_URL
    || process.env.POSTGRES_URL
    || process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("No DATABASE_URL / DIRECT_URL / POSTGRES_URL / SUPABASE_DB_URL found in env. Paste supabase/care-ops-all-v2.sql into Supabase SQL Editor instead.");
    process.exit(1);
  }
  const { Client } = require("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of FILES) {
      const full = path.join(__dirname, "..", "supabase", file);
      const sql = fs.readFileSync(full, "utf8");
      process.stdout.write(`Applying ${file}... `);
      await client.query(sql);
      console.log("OK");
    }
    console.log("\nAll care-ops migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nMigration FAILED:", err.message || err);
  console.error("Fallback: paste supabase/care-ops-all-v2.sql into Supabase SQL Editor.");
  process.exit(1);
});
