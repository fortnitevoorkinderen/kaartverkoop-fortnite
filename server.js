require('dotenv').config();
const express = require('express');
const mollieClient = require('@mollie/api-client').createMollieClient;
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;
if (!MOLLIE_API_KEY) {
  throw new Error("❌ MOLLIE_API_KEY ontbreekt in .env of Render");
}
const mollie = mollieClient({ apiKey: MOLLIE_API_KEY });

// ✅ CORS
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
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ✅ Betaling starten
app.post('/start-payment', async (req, res) => {
  const { aantal, telefoon, email, leeftijden, postcode } = req.body;
  const totaal = (parseInt(aantal) * 10).toFixed(2);
  const factuurNummer = 'FG-' + Date.now();

  try {
    const payment = await mollie.payments.create({
      amount: {
        currency: 'EUR',
        value: totaal
      },
      description: `Fortnite kaartje(s): ${aantal}x`,
      redirectUrl: 'https://fortnitevoorkinderen.com/bedankt.html',
      webhookUrl: 'https://fortnitevoorkinderen.onrender.com/webhook',
      metadata: { aantal, telefoon, email, leeftijden, postcode, factuurNummer }
    });

    res.json({ url: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('❌ Mollie fout:', err.message);
    res.status(500).send('Fout bij betaling starten');
  }
});

// ✅ Webhook Mollie
app.post('/webhook', async (req, res) => {
  const paymentId = req.body.id;

  try {
    const payment = await mollie.payments.get(paymentId);

    if (payment.status === 'paid') {
      const { aantal, telefoon, email, leeftijden, postcode, factuurNummer } = payment.metadata;
      const totaal = (parseInt(aantal) * 10).toFixed(2);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: '✅ Nieuwe Fortnite Aanmelding',
        text: `
Aantal kaartjes: ${aantal}
Totaalbedrag: €${totaal}
Postcode: ${postcode}
Leeftijden: ${leeftijden}
Telefoon: ${telefoon}
E-mail: ${email}
Factuurnummer: ${factuurNummer}
        `
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎫 Bevestiging Real-Life Fortnite – Factuur ${factuurNummer}`,
        html: `
          <div style="font-family:sans-serif; padding:20px;">
            <h2>Bedankt voor je aanmelding!</h2>
            <p><strong>Aantal kaartjes:</strong> ${aantal}</p>
            <p><strong>Totaal:</strong> €${totaal}</p>
            <p><strong>Leeftijden:</strong> ${leeftijden}</p>
            <p><strong>Postcode:</strong> ${postcode}</p>
            <p><strong>Telefoon:</strong> ${telefoon}</p>
            <hr>
            <p>We nemen contact met je op over tijd & locatie van het event.</p>
            <p style="color:gray;">Factuurnummer: ${factuurNummer}</p>
          </div>
        `
      });

      console.log('📧 Mails verzonden');
    }

    res.status(200).end();
  } catch (err) {
    console.error('❌ Webhook fout:', err.message);
    res.status(500).end();
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server draait op poort ${PORT}`);
});




