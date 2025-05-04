const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('📩 Webhook recibido!');

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Error al verificar el webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook verificado:', event.type);

  // Manejo de evento checkout.session.completed (Pago completado)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const customerEmail = session.customer_email;
      const priceIds = session.metadata.price_ids ? JSON.parse(session.metadata.price_ids) : [];
      console.log('Precio IDs:', priceIds);

      if (!priceIds.length) {
        console.warn('⚠️ No hay priceIds en metadata. Webhook de prueba o datos incompletos.');
        return res.status(200).json({ received: true });
      }

      // Verificar o insertar el usuario basado en el correo
      const [usuarioRows] = await db.query('SELECT id, tipo FROM usuarios WHERE email = ?', [customerEmail]);
      let usuario = usuarioRows[0];

      if (!usuario) {
        // Si el usuario no existe, lo creamos con el tipo de curso que adquirió
        const [result] = await db.query('INSERT INTO usuarios (email, tipo) VALUES (?, ?)', [customerEmail, 'gratis']);
        usuario = { id: result.insertId };
      }

      // Procesar los cursos comprados
      for (const priceId of priceIds) {
        const [cursoRows] = await db.query('SELECT id, tipo FROM cursos WHERE stripe_price_id = ?', [priceId]);
        const curso = cursoRows[0];

        if (!curso) {
          console.warn(`⚠️ Curso no encontrado con priceId: ${priceId}`);
          continue;
        }

        // Verificar si el pago ya fue registrado para este usuario y curso
        const [existe] = await db.query(
          'SELECT * FROM pagos WHERE usuario_id = ? AND curso_id = ?',
          [usuario.id, curso.id]
        );

        if (existe.length === 0) {
          await db.query(
            'INSERT INTO pagos (usuario_id, curso_id, stripe_session_id, estado, fecha, fecha_pago, estado_pago) VALUES (?, ?, ?, ?, NOW(), NOW(), ?)',
            [usuario.id, curso.id, session.id, 'completado', 'completado']
          );
          console.log(`✅ Curso ${curso.id} agregado al usuario ${usuario.id}`);
        } else {
          console.log(`ℹ️ El usuario ${usuario.id} ya tenía el curso ${curso.id}`);
        }
      }

      res.json({ received: true });

    } catch (err) {
      console.error('❌ Error al guardar pago desde webhook:', err);
      return res.status(500).send('Error procesando webhook');
    }
  }

  // Manejo de evento invoice.payment_failed (Pago recurrente fallido)
  else if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const customerEmail = invoice.customer_email;
    console.log('⚠️ El pago de la factura falló:', customerEmail);

    // Actualizar el estado del pago en la base de datos como fallido
    await db.query(
      'UPDATE pagos SET estado_pago = ? WHERE stripe_session_id = ?',
      ['fallido', invoice.id]
    );
    
    res.json({ received: true });
  }

  // Manejo de evento invoice.payment_succeeded (Pago recurrente exitoso)
  else if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const customerEmail = invoice.customer_email;
    console.log('✅ El pago recurrente se completó correctamente:', customerEmail);

    // Aquí puedes actualizar el estado del pago o enviar un correo confirmando el pago exitoso
    await db.query(
      'UPDATE pagos SET estado_pago = ? WHERE stripe_session_id = ?',
      ['completado', invoice.id]
    );
    
    res.json({ received: true });
  }

  // Manejo de evento customer.subscription.created (Suscripción creada)
  else if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object;
    const customerEmail = subscription.customer_email;
    console.log('✅ Suscripción creada para:', customerEmail);

    // Registrar o actualizar suscripción del usuario
    const [usuarioRows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [customerEmail]);
    let usuario = usuarioRows[0];

    if (!usuario) {
      const [result] = await db.query('INSERT INTO usuarios (email, tipo) VALUES (?, ?)', [customerEmail, 'membresia']);
      usuario = { id: result.insertId };
    }

    // Aquí puedes agregar la lógica para asociar suscripciones con cursos si es necesario
    res.json({ received: true });
  }

  // Manejo de evento customer.subscription.updated (Suscripción actualizada)
  else if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const customerEmail = subscription.customer_email;
    console.log('✅ Suscripción actualizada para:', customerEmail);

    // Manejar cambios en la suscripción, como cambios en el plan o método de pago
    res.json({ received: true });
  }

  // Manejo de evento customer.subscription.deleted (Suscripción cancelada)
  else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerEmail = subscription.customer_email;
    console.log('⚠️ Suscripción cancelada para:', customerEmail);

    // Actualizar estado de pago y acceso a cursos si la suscripción es cancelada
    await db.query(
      'UPDATE pagos SET estado_pago = ? WHERE stripe_session_id = ?',
      ['cancelado', subscription.id]
    );
    
    res.json({ received: true });
  }

  // Si el evento no está en los eventos manejados, solo responde con éxito
  else {
    res.json({ received: true });
  }
});

module.exports = router;
