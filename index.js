const express = require('express');
const twilio = require('twilio');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const conversations = {};

const contexteBusiness = `Tu es l'assistant WhatsApp d'un commerce à Brazzaville.
Tu aides les clients à passer commande, tu es chaleureux et naturel.
Tu réponds UNIQUEMENT aux questions liées au commerce.
Quand le client confirme clairement sa commande (dit oui, d'accord, etc.), 
demande-lui son adresse de livraison.
Une fois qu'il donne son adresse, remercie-le et dis que la commande est enregistrée.`;

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
  const reponse = result.response.text();

  conversations[numero].push({ role: 'model', parts: [{ text: reponse }] });
  return reponse;
}

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

const commandesEnAttente = {};

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

const motsOui = ['oui', 'ouais', 'bien sûr', 'bien sur', 'évidemment', 'evidemment', 'exact', 'correct', 'ok', "d'accord", 'affirmatif'];
const motsNon = ['non', 'annule', 'pas maintenant'];

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const text = req.body.Body.trim();
  const texteMinuscule = text.toLowerCase();
  console.log(`Message reçu de ${from}: ${text}`);

  let reponse;
  const etat = commandesEnAttente[from];
  const estOui = motsOui.some(mot => texteMinuscule.includes(mot));
  const estNon = motsNon.some(mot => texteMinuscule.includes(mot));

  if (!etat) {
    commandesEnAttente[from] = { step: 'demande' };
    reponse = "Bonjour ! 😊 Que puis-je faire pour vous ?";
  } else if (etat.step === 'demande') {
    commandesEnAttente[from] = { step: 'quantite', produit: text };
    reponse = "Bien sûr, que voulez-vous exactement ?";
  } else if (etat.step === 'quantite') {
    const commandeComplete = `${etat.produit} - ${text}`;
    commandesEnAttente[from] = { step: 'confirmation', produit: commandeComplete };
    reponse = `Bien, je confirme votre choix : "${commandeComplete}" ?`;
  } else if (etat.step === 'confirmation') {
    if (estOui) {
      commandesEnAttente[from] = { step: 'adresse', produit: etat.produit };
      reponse = "Une question supplémentaire : à quelle adresse devrions-nous vous livrer ?";
    } else if (estNon) {
      delete commandesEnAttente[from];
      reponse = "D'accord, on annule. N'hésitez pas à me réécrire si besoin.";
    } else {
      reponse = "Je n'ai pas bien compris, pouvez-vous confirmer par oui ou non ?";
    }
  } else if (etat.step === 'adresse') {
    await ajouterCommande(from, etat.produit, text);
    delete commandesEnAttente[from];
    reponse = "Merci ! Nous vous disons à très bientôt 😊";
  }

  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: from,
    body: reponse
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Serveur démarré sur le port 3000'));