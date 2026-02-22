const nodemailer = require("nodemailer");

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
    to: "tucorreo@gmail.com",
    subject: "Nueva cita agendada",
    html: `
      <p>Se ha agendado una cita:</p>
      <p>Usuario: ${cita.nombre} (${cita.email})</p>
      <p>Teléfono: ${cita.telefono}</p>
      <p>Curso: ${cita.curso_id}</p>
      <p>Fecha: ${cita.fecha}</p>
      <p>Hora: ${cita.hora}</p>
    `,
  });
}

module.exports = { enviarAviso };