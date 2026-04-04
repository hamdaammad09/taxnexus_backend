require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/invoice", require("./routes/invoiceRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Root route for health check
app.get("/", (req, res) => {
  res.send("TaxNexus Backend is running 🚀");
});

// Test database connection
app.get("/test-db", async (req, res) => {
  try {
    // Debug: Show DATABASE_URL (hide password)
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const maskedUrl = dbUrl.replace(/:([^@@]+)@/, ":****@");

    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected successfully",
      timestamp: result.rows[0].now,
      databaseUrl: maskedUrl,
    });
  } catch (err) {
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const maskedUrl = dbUrl.replace(/:([^@@]+)@/, ":****@");

    res.status(500).json({
      message: "Database connection failed",
      error: err.message,
      databaseUrl: maskedUrl,
      hint: "Use Supabase Session Pooler (port 5432), NOT Direct Connection (port 6543)",
      example: "postgresql://postgres.xxxxxxx:password@aws-0-xxxxx.pooler.supabase.com:5432/postgres",
    });
  }
});

// Debug: Check if user exists (without exposing password)
app.get("/debug-user/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, company_id, role, created_at FROM users WHERE email=$1",
      [req.params.email]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false, message: "User not found" });
    }

    res.json({
      exists: true,
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: Create test company (for setup only - remove in production)
app.post("/debug-create-company", async (req, res) => {
  try {
    const { name, ntn, api_token } = req.body;

    const result = await pool.query(
      "INSERT INTO companies (name, ntn, api_token, environment) VALUES ($1,$2,$3,$4) RETURNING id, name, ntn, environment",
      [name, ntn, api_token || "test-token", "sandbox"]
    );

    res.json({ message: "Company created", company: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: Create test user (for setup only - remove in production)
app.post("/debug-create-user", async (req, res) => {
  try {
    const { email, password, companyId } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password, company_id, role) VALUES ($1,$2,$3,$4) RETURNING id, email, company_id, role",
      [email, hashed, companyId, "admin"]
    );

    res.json({ message: "User created", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: List all companies
app.get("/debug-companies", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, ntn, environment FROM companies");
    res.json({ companies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));