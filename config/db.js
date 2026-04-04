const { Pool } = require("pg");

// Use DATABASE_URL for Supabase/Render, fallback to individual env vars for local dev
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      // Force IPv4 to avoid IPv6 connection issues
      family: 4,
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

module.exports = pool;