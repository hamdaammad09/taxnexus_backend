/**
 * Admin Routes
 * All routes require authentication and admin role
 */

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const {
  createCompany,
  createUser,
  getCompanies,
} = require("../controllers/adminController");

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @route   POST /api/admin/company
 * @desc    Create a new company
 * @access  Admin only
 */
router.post("/company", createCompany);

/**
 * @route   POST /api/admin/create-user
 * @desc    Create a new user for a company
 * @access  Admin only
 */
router.post("/create-user", createUser);

/**
 * @route   GET /api/admin/companies
 * @desc    Get all companies
 * @access  Admin only
 */
router.get("/companies", getCompanies);

module.exports = router;
