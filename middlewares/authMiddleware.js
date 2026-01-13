const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "secreto";

function authMiddleware(req, res, next) {
  let token = null;

  // 1️⃣ Authorization header (como ahora)
  if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2️⃣ Cookie (login actual)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const user = jwt.verify(token, SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

module.exports = authMiddleware;
