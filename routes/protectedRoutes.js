const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');

// Requerimos la base de datos (subiendo un nivel desde la carpeta 'routes')
const db = require('../db'); 

// Ruta protegida: solo accesible con token válido
router.get('/perfil', verifyToken, (req, res) => {
    res.json({
        message: 'Bienvenido al perfil protegido',
        usuario: req.user
    });
});

// Ruta protegida de ejemplo para cursos
router.get('/cursos', verifyToken, (req, res) => {
    res.json({
        message: 'Lista de cursos disponibles para el usuario autenticado',
        usuario: req.user
    });
});

// ==========================================
// 1. RUTA GET: LEER EL PROGRESO AL REFRESCAR
// ==========================================
router.get('/lecciones-completadas', verifyToken, (req, res) => {
    const usuario_id = req.user.id;

    if (!usuario_id) {
        return res.status(400).json({ error: 'Usuario no identificado' });
    }

    db.query(
        `SELECT video_id FROM lecciones_completadas WHERE usuario_id = ? AND completado = 1`,
        [usuario_id],
        (err, results) => {
            if (err) {
                console.error("❌ Error al consultar el progreso:", err);
                return res.status(500).json({ error: 'Error obteniendo progreso' });
            }
            return res.json({ completados: results });
        }
    );
});

// ==========================================
// 2. RUTA POST: GUARDAR PROGRESO AL TERMINAR
// ==========================================
router.post('/marcar-completado', verifyToken, (req, res) => {
    const usuario_id = req.user.id;
    const { video_id, cursoId } = req.body;
    const curso_id = cursoId;

    if (!usuario_id || !curso_id || !video_id) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    db.query(
        `INSERT INTO lecciones_completadas (usuario_id, curso_id, video_id, completado)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE completado=1, fecha_completado=CURRENT_TIMESTAMP`,
        [usuario_id, curso_id, video_id],
        (err) => {
            if (err) {
                console.error("❌ Error al guardar progreso:", err);
                return res.status(500).json({ error: 'Error guardando progreso' });
            }
            return res.json({ ok: true });
        }
    );
});

module.exports = router;