const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  let token = null;

  // 1️⃣ API (fetch / axios)
  if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2️⃣ Navegación normal (cookies)
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    // 🔥 diferencia API vs VISTA
    if (req.originalUrl.startsWith("/api")) {
      return res.status(401).json({ error: "No autenticado" });
    } else {
      return res.redirect("/login");
    }
  }

  try {
    const user = jwt.verify(token, SECRET);
    req.user = user;
    next();
  } catch (err) {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(403).json({ error: "Token inválido" });
    } else {
      return res.redirect("/login");
    }
  }
}

module.exports = authMiddleware;
