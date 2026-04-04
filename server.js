require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

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
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected successfully",
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({
      message: "Database connection failed",
      error: err.message,
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));