const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "brazzabot2026";
const ACCESS_TOKEN = "EAAZACf0aCDkUBR3VBZCpriZABfq4yhxlkhuIeIxVLZABYL6nY5Ih647kZBpUIT8QqCbZBRYn0MNgXZCCCLmQcRJ0xGZCKgx1L3waieJ1nYqiuM0SM8aZAGhpid18G88gVJMgaR6iDxJV6yDn8L0yvqZBpafW3ZAsHZAy4lDqCIxgGdvXK7u9ZAaHuROx6OJYNckWsrE0qsOU1ZAIVGHmTlXJIDsskat0ZARdRnlEpXPwkqZAD2Yx73M6kWVHJq3EXTsHD0ICZBUk4WXZBpVJBizB5hv0o4qOhMkAZDZD";
const PHONE_NUMBER_ID = "1207662285767480";

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const text = message.text?.body;

    console.log(`Message reçu de ${from}: ${text}`);

    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: "Merci pour votre message ! Nous vous répondrons bientôt." }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Serveur démarré sur le port 3000'));