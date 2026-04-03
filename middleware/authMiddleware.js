const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to req.user
 * req.user contains: userId, companyId, role
 */
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT secret is not configured" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure req.user has the required fields
    req.user = {
      userId: decoded.userId || decoded.id,
      companyId: decoded.companyId || decoded.company_id,
      role: decoded.role,
      // Keep original fields for backward compatibility
      ...decoded,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};