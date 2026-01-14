const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  let token = null;

  if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const user = jwt.verify(token, SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}

module.exports = authMiddleware;
