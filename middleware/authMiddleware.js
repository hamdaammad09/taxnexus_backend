const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).send("Unauthorized");

  const decoded = jwt.verify(token, "SECRET");

  req.user = decoded;

  next();
};