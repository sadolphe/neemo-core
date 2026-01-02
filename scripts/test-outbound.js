
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

console.log("ENV VARS LOADED:", process.env.TWILIO_ANSWER_URL ? "YES" : "NO");
console.log("ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID ? "OK" : "MISSING");
console.log("WHATSAPP_NUMBER:", process.env.TWILIO_WHATSAPP_NUMBER);

const rawFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Fallback temporaire
const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;
const to = 'whatsapp:+33635442364';

console.log(`[TEST] Envoi de: ${from} vers: ${to}`);

client.messages
    .create({
        body: '👋 Hello ! Ceci est un test DIRECT via API (hors webhook). Si tu reçois ça, la connexion sortante marche.',
        from: from,
        to: to
    })
    .then((message) => console.log(`✅ Succès ! SID: ${message.sid}`))
    .catch((error) => {
        console.error('❌ Echec Total :');
        console.error(error);
    });
