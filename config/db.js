const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "tax_nexus",
  password: "your_password",
  port: 5432,
});

module.exports = pool;