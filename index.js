const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const SPREADSHEET_ID = '1xR-bJ4J1lYwqRCfiQEkXHxas0kEII9x-UiH1Vq3RKlg';
const commandesEnAttente = {};
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function ajouterMessage(numero, message) {
  try {
    console.log('DEBUT ajout Sheets');
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log('Sheets chargé, titre:', doc.title);
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Date: new Date().toLocaleString('fr-FR'),
      'Numéro client': numero,
      Message: message,
      Statut: 'Nouveau'
    });
    console.log('Ligne ajoutée avec succès');
  } catch (err) {
    console.log('ERREUR SHEETS:', err.message);
  }
}async function ajouterMessage(numero, message) {
  try {
    console.log('DEBUT ajout Sheets');
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log('Sheets chargé, titre:', doc.title);
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Date: new Date().toLocaleString('fr-FR'),
      'Numéro client': numero,
      Message: message,
      Statut: 'Nouveau'
    });
    console.log('Ligne ajoutée avec succès');
  } catch (err) {
    console.log('ERREUR SHEETS:', err.message);
  }
}async function ajouterMessage(numero, message) {
  try {
    console.log('DEBUT ajout Sheets');
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log('Sheets chargé, titre:', doc.title);
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Date: new Date().toLocaleString('fr-FR'),
      'Numéro client': numero,
      Message: message,
      Statut: 'Nouveau'
    });
    console.log('Ligne ajoutée avec succès');
  } catch (err) {
    console.log('ERREUR SHEETS:', err.message);
  }
}
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
  const text = req.body.Body.trim();
  console.log(`Message reçu de ${from}: ${text}`);

  let reponse;
  const etat = commandesEnAttente[from];

  if (!etat) {
    commandesEnAttente[from] = { step: 'accueil_fait' };
    reponse = "Bonjour ! 👋 Que puis-je faire pour vous aider ?";
  } else if (etat.step === 'accueil_fait') {
    commandesEnAttente[from] = { step: 'confirmation', produit: text };
    reponse = `Vous avez écrit : "${text}". Voulez-vous confirmer cette commande ? Répondez OUI pour valider, ou NON pour annuler.`;
  } else if (etat.step === 'confirmation') {
    if (text.toLowerCase() === 'oui') {
      commandesEnAttente[from] = { step: 'adresse', produit: etat.produit };
      reponse = "Parfait ! Quelle est votre adresse de livraison ?";
    } else if (text.toLowerCase() === 'non') {
      delete commandesEnAttente[from];
      reponse = "D'accord, commande annulée. N'hésitez pas à me réécrire si besoin.";
    } else {
      reponse = "Répondez OUI pour confirmer ou NON pour annuler.";
    }
  } else if (etat.step === 'adresse') {
    await ajouterCommande(from, etat.produit, text);
    delete commandesEnAttente[from];
    reponse = "Votre commande a bien été enregistrée avec votre adresse ! Merci 🙏";
  }

  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: from,
    body: reponse
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Serveur démarré sur le port 3000'));