import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

// Diagnostic API Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

export async function GET() {
    // Unique ID: 1735773900 (Force Update)
    return new Response(`Neemo Webhook is ACTIVE. [Diagnostic v3]
Account SID: ${accountSid ? '✅ Set' : '❌ Missing'}
Auth Token: ${authToken ? '✅ Set' : '❌ Missing'}
WhatsApp Number: ${twilioNumber || '❌ Missing'}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function POST(req: NextRequest) {
    console.log("[Neemo] Webhook POST call");

    try {
        const text = await req.text();
        const params = new URLSearchParams(text);
        const from = params.get('From') || '';
        const body = params.get('Body') || '';

        console.log(`[Neemo] From: ${from}, Body: ${body}`);

        // TEST 1: TwiML (Réponse classique)
        const twiml = new MessagingResponse();
        twiml.message(`🤖 [TwiML] J'ai bien reçu : "${body}"`);

        // TEST 2: Direct Send via API (Si configuré)
        if (accountSid && authToken && twilioNumber) {
            try {
                const client = twilio(accountSid, authToken);
                await client.messages.create({
                    from: twilioNumber,
                    to: from,
                    body: `🚀 [Direct API] Confirmation de réception pour : "${body}"`
                });
                console.log("[Neemo] Direct API message sent successfully");
            } catch (err: any) {
                console.error("[Neemo] Direct API error:", err.message);
                // On ajoute l'erreur au TwiML pour que l'utilisateur la voie
                twiml.message(`❌ Erreur API Directe: ${err.message}`);
            }
        }

        return new Response(twiml.toString(), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (e: any) {
        console.error("[Neemo] Webhook Critical Error:", e.message);
        return new Response(`<Response><Message>❌ Erreur Critique: ${e.message}</Message></Response>`, {
            status: 500,
            headers: { 'Content-Type': 'text/xml' }
        });
    }
}
