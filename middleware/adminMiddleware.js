/**
 * Admin Middleware
 * Restricts access to users with admin role only
 */

const adminMiddleware = (req, res, next) => {
  // Check if user exists (should be set by authMiddleware)
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if user has admin role
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }

  next();
};

module.exports = adminMiddleware;
