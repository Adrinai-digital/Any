const { google } = require("googleapis");

const raw = process.env.GOOGLE_CREDENTIALS_JSON;

console.log("GCJ len=", raw?.length, "start=", JSON.stringify((raw||"").slice(0, 10)));

if (!raw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON en .env");

const auth = new google.auth.GoogleAuth({
 credentials: JSON.parse(raw),
 scopes: ["https://www.googleapis.com/auth/calendar"],
});

async function addCalendarEvent({ fecha, hora, nombre, telefono }) {
 const calendar = google.calendar({ version: "v3", auth });

 const start = new Date(`${fecha}T${hora}:00`);
 const end = new Date(start.getTime() + 30 * 60 * 1000);

 return calendar.events.insert({
 calendarId: process.env.GCAL_CALENDAR_ID,
 requestBody: {
 summary: `Cita: ${nombre}`,
 description: `Teléfono: ${telefono}`,
 start: { dateTime: start.toISOString(), timeZone: "Europe/Madrid" },
 end: { dateTime: end.toISOString(), timeZone: "Europe/Madrid" },
 },
 });
}

module.exports = { addCalendarEvent };