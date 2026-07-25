const express = require('express');
const twilio = require('twilio');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886";
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const text = req.body.Body;
  console.log(`Message reçu de ${from}: ${text}`);

  const reponse = "Merci pour votre message ! Nous vous répondrons bientôt.";

  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: from,
    body: reponse
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Serveur démarré sur le port 3000'));