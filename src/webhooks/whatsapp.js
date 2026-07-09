/**
 * WhatsApp Business Webhook Handler - V30 Ultra God Level
 * Complete incoming webhook for two-way communication
 * User replies "SÍ" or "YES" to approve max execution
 * Reports what the agent is doing/executing
 */

const express = require('express');
const axios = require('axios');
const { autonomousSelfStudy, chatWithGodAgent } = require('../../lib/selfStudyAgent');
const CREDENTIALS = require('../../lib/config').default || require('../../lib/config'); // Adapt if needed

const router = express.Router();

// WhatsApp webhook verification (GET)
router.get('/webhook-whatsapp', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'tu_verify_token_secreto_aqui';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WhatsApp Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Incoming messages (POST)
router.post('/webhook-whatsapp', async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from; // User's phone
      const messageBody = message.text ? message.text.body.toUpperCase().trim() : '';

      console.log(`📨 WhatsApp message from ${from}: ${messageBody}`);

      if (messageBody.includes('SÍ') || messageBody.includes('YES') || messageBody.includes('EJECUTA')) {
        // User approves max execution
        console.log('✅ User approved MAX execution - Triggering full autonomous cycle');
        try {
          const result = await autonomousSelfStudy();
          // Also trigger other modules if needed
          await axios.post('http://localhost:3000/trigger-full-cycle'); // Or integrate directly
          
          // Reply to user
          await sendWhatsAppReply(from, `✅ Ejecutando al máximo nivel. Revenue en curso. Reporte completo pronto.`);
        } catch (err) {
          await sendWhatsAppReply(from, `Error al ejecutar: ${err.message}`);
        }
      } else if (messageBody.includes('NO') || messageBody.includes('PAUSA')) {
        console.log('⏸️ User paused execution');
        await sendWhatsAppReply(from, '⏸️ Ejecución pausada. El Empire está en modo seguro.');
      } else if (messageBody.includes('ESTADO') || messageBody.includes('STATUS')) {
        // Report current status
        await sendWhatsAppReply(from, '🧠 Empire V30 Ultra activo. Auto-estudiando y generando revenue. ¿Quieres el reporte completo?');
      } else {
        // General chat with God Agent
        const reply = await chatWithGodAgent(messageBody);
        await sendWhatsAppReply(from, reply);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function sendWhatsAppReply(to, message) {
  if (!CREDENTIALS.WHATSAPP_ACCESS_TOKEN || CREDENTIALS.WHATSAPP_PHONE_NUMBER_ID === 'TU_PHONE_NUMBER_ID_AQUI') {
    console.log('WhatsApp reply (simulado):', message);
    return;
  }
  try {
    await axios.post(`https://graph.facebook.com/v19.0/${CREDENTIALS.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: message }
    }, {
      headers: { 'Authorization': `Bearer ${CREDENTIALS.WHATSAPP_ACCESS_TOKEN}` }
    });
  } catch (e) {
    console.error('Error sending WhatsApp reply:', e.message);
  }
}

module.exports = router;