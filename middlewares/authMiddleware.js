const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  let token = null;

  // 1. Buscar en Headers (Authorization: Bearer TOKEN)
  if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2. Buscar en Cookies si no estaba en las cabeceras
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  // Si no hay token...
  if (!token) {
    // Si es una petición de API (JSON/Fetch), respondemos con un estado 401
    if (req.xhr || req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "No autorizado. Inicie sesión." });
    }
    // Si es una navegación normal por url de navegador, redirigimos
    return res.redirect("/formulario.html"); // Cambiado a tu archivo de login
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    
    // 💡 IMPORTANTE: Guardamos tanto en 'user' como en 'usuario' 
    // para que coincida exactamente con todas tus rutas antiguas y nuevas.
    req.user = decoded;
    req.usuario = decoded; 
    
    next();
  } catch (err) {
    console.error("⚠️ Token inválido:", err.message);
    
    if (req.xhr || req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
    return res.redirect("/formulario.html");
  }
}

module.exports = authMiddleware;