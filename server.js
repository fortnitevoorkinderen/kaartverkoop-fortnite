require('dotenv').config();
const express = require('express');
const mollieClient = require('@mollie/api-client').createMollieClient;
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Mollie API-key ophalen
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;
console.log("🔐 API KEY IS:", MOLLIE_API_KEY);

if (!MOLLIE_API_KEY) {
  throw new Error("❌ MOLLIE_API_KEY ontbreekt! Voeg deze toe in Render → Environment.");
}

const mollie = mollieClient({ apiKey: MOLLIE_API_KEY });

// ✅ CORS-instellingen
const allowedOrigins = [
  'https://www.fortnitevoorkinderen.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Niet toegestaan door CORS'));
    }
  }
}));

// ✅ Middleware
app.use(bodyParser.json());
app.use('/webhook', express.urlencoded({ extended: true }));
app.use(express.static('public')); // Zorgt dat je HTML en assets werken

// ✅ STAP 1: Betaling starten
app.post('/start-payment', async (req, res) => {
  const { aantal, telefoon, email, leeftijden, postcode } = req.body;
  const prijsPerKaartje = 10;
  const totaalBedrag = (parseInt(aantal) * prijsPerKaartje).toFixed(2);
  const factuurNummer = 'FG-' + Date.now();

  try {
    const payment = await mollie.payments.create({
      amount: {
        currency: 'EUR',
        value: totaalBedrag
      },
      description: `Real-Life Fortnite kaartje(s): ${aantal}x`,
      redirectUrl: 'https://fortnitevoorkinderen.com/bedankt.html',
      webhookUrl: 'https://fortnitevoorkinderen.onrender.com/webhook',
      metadata: {
        aantal,
        telefoon,
        email,
        leeftijden,
        postcode,
        factuurNummer
      }
    });

    res.json({ url: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('❌ Fout bij betaling aanmaken:', err);
    res.status(500).send('Fout bij betaling aanmaken');
  }
});

// ✅ STAP 2: Mollie Webhook
app.post('/webhook', async (req, res) => {
  console.log('🔔 Webhook ontvangen van Mollie:', req.body);
  const paymentId = req.body.id;

  try {
    const payment = await mollie.payments.get(paymentId);

    if (payment.status === 'paid') {
      const { aantal, telefoon, email, leeftijden, postcode, factuurNummer } = payment.metadata;
      const totaalBedrag = (parseInt(aantal) * 10).toFixed(2);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailToOrganizer = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: '📩 Nieuwe Kaartverkoop – Real-Life Fortnite',
        text: `✅ Nieuwe bestelling ontvangen:

Aantal kaartjes: ${aantal}
Totaalbedrag: €${totaalBedrag}
Postcode: ${postcode}
Leeftijden: ${leeftijden}
Telefoon: ${telefoon}
E-mailadres klant: ${email}
Factuurnummer: ${factuurNummer}`
      };

      const mailToCustomer = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎟️ Bevestiging Real-Life Fortnite – Factuur ${factuurNummer}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ccc;">
            <h1 style="color: #333;">🎫 Bevestiging van je bestelling</h1>
            <p>Bedankt voor je aanmelding voor het <strong>Real-Life Fortnite Event</strong>!</p>
            <hr>
            <h2 style="color: #555;">🧾 Factuurgegevens</h2>
            <p><strong>Factuurnummer:</strong> ${factuurNummer}</p>
            <p><strong>Aantal kaartjes:</strong> ${aantal}</p>
            <p><strong>Totaalbedrag:</strong> €${totaalBedrag}</p>
            <p><strong>Leeftijden kinderen:</strong> ${leeftijden}</p>
            <p><strong>Postcode:</strong> ${postcode}</p>
            <p><strong>Telefoonnummer:</strong> ${telefoon}</p>
            <p><strong>E-mailadres:</strong> ${email}</p>
            <hr>
            <p>We nemen binnenkort contact met je op over de exacte tijd en locatie van het evenement.</p>
            <p style="color: #888;">Met vriendelijke groet,<br><strong>Team Fortnite Games</strong></p>
          </div>
        `
      };

      await transporter.sendMail(mailToOrganizer);
      await transporter.sendMail(mailToCustomer);
      console.log('📧 Bevestigingsmails verzonden');
    } else {
      console.log(`ℹ️ Betaling niet voltooid. Status: ${payment.status}`);
    }

    res.status(200).end();
  } catch (err) {
    console.error('❌ Fout bij webhookverwerking:', err);
    res.status(500).end();
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server draait op poort ${PORT}`);
});



