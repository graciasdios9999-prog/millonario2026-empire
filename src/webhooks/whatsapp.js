/**
 * WhatsApp Business Webhook Handler - V20
 * Incoming webhook for two-way communication.
 * Credentials exclusively from process.env via lib/config.
 */

'use strict';

const express = require('express');
const axios = require('axios');

let autonomousSelfStudy;
try {
  ({ autonomousSelfStudy } = require('../../lib/selfStudyAgent'));
} catch (e) {
  autonomousSelfStudy = null;
}

let CREDENTIALS;
try {
  CREDENTIALS = require('../../lib/config');
} catch (e) {
  CREDENTIALS = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'empire-verify-token'
  };
}

const router = express.Router();

router.get('/webhook-whatsapp', (req, res) => {
  const VERIFY_TOKEN = CREDENTIALS.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'empire-verify-token';
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
  } else {
    res.sendStatus(400);
  }
});

router.post('/webhook-whatsapp', async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const messageBody = message.text ? message.text.body.toUpperCase().trim() : '';

      console.log(`📨 WhatsApp message from ${from}: ${messageBody}`);

      if (messageBody.includes('SÍ') || messageBody.includes('YES') || messageBody.includes('EJECUTA')) {
        console.log('✅ User approved MAX execution - Triggering self-study cycle');
        try {
          if (autonomousSelfStudy) {
            await autonomousSelfStudy();
          }
          await sendWhatsAppReply(from, `✅ Ejecutando ciclo. Reporte completo pronto.`);
        } catch (err) {
          await sendWhatsAppReply(from, `Error al ejecutar: ${err.message}`);
        }
      } else if (messageBody.includes('NO') || messageBody.includes('PAUSA')) {
        console.log('⏸️ User paused execution');
        await sendWhatsAppReply(from, '⏸️ Ejecución pausada. El Empire está en modo seguro.');
      } else if (messageBody.includes('ESTADO') || messageBody.includes('STATUS')) {
        await sendWhatsAppReply(from, '🧠 Empire V20 activo. ¿Quieres el reporte completo?');
      } else {
        await sendWhatsAppReply(from, 'Recibido. Comandos: SÍ / EJECUTA / ESTADO / PAUSA');
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function sendWhatsAppReply(to, message) {
  const token = CREDENTIALS.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = CREDENTIALS.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log('WhatsApp reply skipped (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID):', message);
    return;
  }
  try {
    await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: message }
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (e) {
    console.error('Error sending WhatsApp reply:', e.message);
  }
}

module.exports = router;
