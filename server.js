require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const bcrypt = require("bcrypt");

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: [
    "https://frontend-tax-nexus.vercel.app",
    "https://frontend-tax-nexus-git-main-sundus-projects-871ec62d.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
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
      "SELECT id, email, password, company_id, role, created_at FROM users WHERE email=$1",
      [req.params.email]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false, message: "User not found" });
    }

    const user = result.rows[0];
    const passwordFormat = user.password.startsWith('$2') ? 'bcrypt' : 'plain text';

    res.json({
      exists: true,
      user: {
        id: user.id,
        email: user.email,
        company_id: user.company_id,
        role: user.role,
        created_at: user.created_at,
        password_format: passwordFormat,
        password_preview: user.password.substring(0, 20) + '...',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: Test password comparison
app.post("/debug-test-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT password FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ error: "User not found" });
    }

    const hashedPassword = result.rows[0].password;
    const isValid = await bcrypt.compare(password, hashedPassword);

    res.json({
      email,
      password_stored: hashedPassword.substring(0, 30) + '...',
      password_format: hashedPassword.startsWith('$2') ? 'bcrypt' : 'plain text',
      comparison_result: isValid,
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

// Debug: List recent invoices with data
app.get("/debug-invoices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, company_id, invoice_ref_no, status, invoice_data, created_at 
      FROM invoices 
      ORDER BY id DESC 
      LIMIT 10
    `);
    res.json({ invoices: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: Create uploads table (if missing)
app.post("/debug-create-tables", async (req, res) => {
  try {
    // Create uploads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        file_name VARCHAR(255),
        file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create invoices table (if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        invoice_ref_no VARCHAR(100),
        invoice_data JSONB,
        fbr_invoice_number VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create validation_errors table (if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_errors (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id),
        row_no INTEGER,
        field_name VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create api_logs table (if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        request JSONB,
        response JSONB,
        status_code INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    res.json({ message: "Tables created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: Create or update all required tables
app.post("/debug-setup-database", async (req, res) => {
  try {
    // 1. Create companies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ntn VARCHAR(50) NOT NULL,
        address TEXT,
        province VARCHAR(100),
        api_token VARCHAR(500),
        environment VARCHAR(50) DEFAULT 'sandbox',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        company_id INTEGER REFERENCES companies(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Create invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        invoice_ref_no VARCHAR(100),
        invoice_data JSONB,
        fbr_invoice_number VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 4. Create validation_errors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_errors (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id),
        row_no INTEGER,
        field_name VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 5. Create uploads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        file_name VARCHAR(255),
        file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 6. Create api_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        request JSONB,
        response JSONB,
        status_code INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    res.json({ message: "All tables created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));