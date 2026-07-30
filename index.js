const express = require('express');
const twilio = require('twilio');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886";
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

const SPREADSHEET_ID = '1xR-bJ4J1lYwqRCfiQEkXHxas0kEII9x-UiH1Vq3RKlg';
const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

async function compterCommandes(numero) {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  return rows.filter(row => row.get('Numéro client') === numero).length;
}

async function ajouterCommande(numero, produit, adresse) {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const nbCommandes = await compterCommandes(numero);
    const statut = nbCommandes >= 3 ? 'Régulier' : 'Nouveau';
    await sheet.addRow({
      Date: new Date().toLocaleString('fr-FR'),
      'Numéro client': numero,
      Produit: produit,
      Adresse: adresse,
      Statut: statut
    });
    console.log('Commande ajoutée avec succès');
  } catch (err) {
    console.log('ERREUR SHEETS:', err.message);
  }
}

const conversations = {};

const contexteBusiness = `Tu es l'assistant WhatsApp d'un commerce à Brazzaville.
Tu aides les clients à passer commande, tu es chaleureux et naturel.
Tu réponds UNIQUEMENT aux questions liées au commerce.
Quand le client confirme clairement sa commande, demande-lui son adresse de livraison.
Une fois qu'il donne son adresse, remercie-le, dis que la commande est enregistrée,
et termine TOUJOURS ta réponse par ce code caché exact sur une nouvelle ligne :
[COMMANDE_COMPLETE: produit=XXX; adresse=YYY]
en remplaçant XXX par le produit commandé et YYY par l'adresse donnée.`;

async function genererReponse(numero, message) {
  if (!conversations[numero]) {
    conversations[numero] = [];
  }
  conversations[numero].push({ role: 'user', parts: [{ text: message }] });

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: contexteBusiness }] },
      { role: 'model', parts: [{ text: "Compris, je suis prêt à aider les clients." }] },
      ...conversations[numero].slice(0, -1)
    ]
  });

  const result = await chat.sendMessage(message);
  let reponse = result.response.text();

  const match = reponse.match(/\[COMMANDE_COMPLETE: produit=(.*?); adresse=(.*?)\]/);
  if (match) {
    await ajouterCommande(numero, match[1], match[2]);
    reponse = reponse.replace(/\[COMMANDE_COMPLETE:.*?\]/, '').trim();
  }

  conversations[numero].push({ role: 'model', parts: [{ text: reponse }] });
  return reponse;
}

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const text = req.body.Body.trim();
  console.log(`Message reçu de ${from}: ${text}`);

  const reponse = await genererReponse(from, text);
  console.log(`Réponse Gemini: ${reponse}`);

  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: from,
    body: reponse
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Serveur démarré sur le port 3000'));