require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Para leer datos del formulario
router.use(express.urlencoded({ extended: false }));

router.post('/enviar-mensaje', async (req, res) => {
    const { nombre, email, telefono, pregunta } = req.body;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true si es 465, false si es 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: `"${nombre}" <${email}>`,
        to: process.env.SMTP_USER, // también podrías usar aquí tu correo destino si quieres
        subject: 'Nuevo mensaje del formulario',
        html: `
            <h3>Detalles del mensaje:</h3>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Teléfono:</strong> ${telefono}</p>
            <p><strong>Pregunta:</strong><br>${pregunta}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send('Mensaje enviado correctamente.');
    } catch (error) {
        console.error('Error al enviar email:', error);
        res.status(500).send('Error al enviar el mensaje.');
    }
});

module.exports = router;
