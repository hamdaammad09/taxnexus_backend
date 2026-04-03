const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { email, password, company_id } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users (email, password, company_id) VALUES ($1,$2,$3)",
    [email, hash, company_id]
  );

  res.json({ message: "User created" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  const user = result.rows[0];

  if (!user) return res.status(400).send("User not found");

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) return res.status(400).send("Wrong password");

  const token = jwt.sign(
    { userId: user.id, companyId: user.company_id },
    "SECRET",
    { expiresIn: "1d" }
  );

  res.json({ token });
};