/**
 * Admin Controller
 * Handles admin operations: company management, user creation
 */

const bcrypt = require("bcrypt");
const pool = require("../config/db");

/**
 * Create a new company
 * POST /api/admin/company
 */
const createCompany = async (req, res) => {
  try {
    const { name, ntn, address, province, api_token, environment } = req.body;

    // Validation: required fields
    if (!name || !ntn || !api_token) {
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          name: !name ? "Company name is required" : undefined,
          ntn: !ntn ? "NTN is required" : undefined,
          api_token: !api_token ? "API token is required" : undefined,
        },
      });
    }

    // Insert company into database
    const query = `
      INSERT INTO companies (name, ntn, address, province, api_token, environment)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, ntn, address, province, environment, created_at
    `;

    const values = [
      name,
      ntn,
      address || null,
      province || null,
      api_token,
      environment || "sandbox",
    ];

    const result = await pool.query(query, values);
    const company = result.rows[0];

    return res.status(201).json({
      message: "Company created successfully",
      company: {
        id: company.id,
        name: company.name,
        ntn: company.ntn,
        address: company.address,
        province: company.province,
        environment: company.environment,
        createdAt: company.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating company:", error);

    // Handle unique constraint violations
    if (error.code === "23505") {
      const field = error.constraint?.includes("ntn") ? "NTN" : "Name";
      return res.status(409).json({
        message: "Company already exists",
        error: `${field} must be unique`,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Create a new user
 * POST /api/admin/create-user
 */
const createUser = async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    // Validation: required fields
    if (!email || !password || !companyId) {
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          email: !email ? "Email is required" : undefined,
          password: !password ? "Password is required" : undefined,
          companyId: !companyId ? "Company ID is required" : undefined,
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          email: "Invalid email format",
        },
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          password: "Password must be at least 6 characters",
        },
      });
    }

    // Check if company exists
    const companyCheck = await pool.query(
      "SELECT id FROM companies WHERE id = $1",
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
        error: "The specified company does not exist",
      });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        message: "User already exists",
        error: "Email is already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database with role = 'user' by default
    const query = `
      INSERT INTO users (email, password, company_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, company_id, role, created_at
    `;

    const values = [email, hashedPassword, companyId, "user"];

    const result = await pool.query(query, values);
    const user = result.rows[0];

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        companyId: user.company_id,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get all companies
 * GET /api/admin/companies
 */
const getCompanies = async (req, res) => {
  try {
    const query = `
      SELECT id, name, ntn, province, environment, created_at
      FROM companies
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      message: "Companies retrieved successfully",
      count: result.rows.length,
      companies: result.rows.map((company) => ({
        id: company.id,
        name: company.name,
        ntn: company.ntn,
        province: company.province,
        environment: company.environment,
        createdAt: company.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching companies:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createCompany,
  createUser,
  getCompanies,
};
