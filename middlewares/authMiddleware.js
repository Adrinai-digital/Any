const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'secreto';

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const user = jwt.verify(token, SECRET);
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido' });
    }
}

module.exports = authMiddleware;