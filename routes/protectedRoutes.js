const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');

// Ruta protegida: solo accesible con token válido
router.get('/perfil', verifyToken, (req, res) => {
    res.json({
        message: 'Bienvenido al perfil protegido',
        usuario: req.user
    });
});

// Ruta protegida de ejemplo para cursos (puedes conectar con la base de datos aquí)
router.get('/cursos', verifyToken, (req, res) => {
    // Aquí podrías consultar los cursos adquiridos desde la base de datos
    res.json({
        message: 'Lista de cursos disponibles para el usuario autenticado',
        usuario: req.user
    });
});

module.exports = router;
