// citasRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // tu conexión MySQL
const authMiddleware = require("../middlewares/authMiddleware");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

/* -------------------- CONFIGURACIÓN EMAIL -------------------- */
const transporter = nodemailer.createTransport({
  host: "smtp.tuservidor.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function enviarAviso(cita) {
  await transporter.sendMail({
    from: `"Tu Web" <${process.env.EMAIL_USER}>`,
    to: "tucorreo@gmail.com", // tu email
    subject: "Nueva cita agendada",
    html: `
      <p>Se ha agendado una cita:</p>
      <p>Usuario: ${cita.nombre} (${cita.email})</p>
      <p>Curso: ${cita.curso_id}</p>
      <p>Fecha: ${cita.fecha}</p>
      <p>Hora: ${cita.hora}</p>
    `,
  });
}

/* -------------------- GOOGLE CALENDAR -------------------- */
async function agregarAGoogleCalendar(cita) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json", // tu archivo JSON del servicio
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Cita Método Learn - ${cita.nombre}`,
      description: `Usuario: ${cita.nombre} (${cita.email})`,
      start: { dateTime: new Date(`${cita.fecha}T${cita.hora}`), timeZone: "Europe/Madrid" },
      end: { dateTime: new Date(new Date(`${cita.fecha}T${cita.hora}`).getTime() + 60 * 60 * 1000), timeZone: "Europe/Madrid" },
    },
  });
}

/* -------------------- AGENDA CITA -------------------- */
router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id } = req.body;
  const userId = req.user.id;

  // Actualizar cita pendiente pagada
  db.query(
    `UPDATE citas SET fecha=?, hora=? 
     WHERE user_id=? AND curso_id=? AND fecha IS NULL AND estado='pagado'`,
    [fecha, hora, userId, curso_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error al agendar la cita" });
      if (result.affectedRows === 0) return res.status(400).json({ error: "No hay sesiones pagadas pendientes" });

      // Obtener cita actualizada
      db.query(
        `SELECT * FROM citas WHERE user_id=? AND curso_id=? AND fecha=? AND hora=? LIMIT 1`,
        [userId, curso_id, fecha, hora],
        async (err2, rows) => {
          if (!err2 && rows.length) {
            const cita = rows[0];
            try {
              await enviarAviso(cita);
              await agregarAGoogleCalendar(cita);
              console.log("✅ Email y Google Calendar enviados");
            } catch (error) {
              console.error("❌ Error enviando aviso o calendario:", error);
            }
          }
        }
      );

      res.json({ mensaje: "Cita agendada correctamente" });
    }
  );
});

/* -------------------- VER CITAS DEL USUARIO -------------------- */
router.get("/mis-citas", authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.query(
    `SELECT citas.*, cursos.titulo
     FROM citas
     JOIN cursos ON citas.curso_id = cursos.id
     WHERE citas.user_id = ?
     ORDER BY fecha ASC, hora ASC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error al obtener citas" });
      res.json(rows);
    }
  );
});

/* -------------------- ACCEDER A MÉTODO LEARN -------------------- */
router.get("/metodo-learn", authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.query(
    `SELECT citas.*, cursos.titulo
     FROM citas
     JOIN cursos ON citas.curso_id = cursos.id
     WHERE citas.user_id = ? AND cursos.id = 10
     ORDER BY fecha ASC, hora ASC`,
    [userId],
    (err, citas) => {
      if (err) return res.status(500).send("Error al cargar las citas");

      res.render("metodo_learn", { usuario: req.user, citas });
    }
  );
});

module.exports = router;
