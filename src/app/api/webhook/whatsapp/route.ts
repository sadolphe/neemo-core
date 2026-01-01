import { NextRequest } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

// Phase 1: Simple Connectivity Test
// Si ça marche, on restaure la DB et l'IA.

export async function GET() {
    return new Response("OK", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function POST(req: NextRequest) {
    const twiml = new MessagingResponse();

    // Réponse IMMEDIATE et GARANTIE
    twiml.message("🎉 Connexion Réussie ! Le serveur Vercel a reçu votre message.");

    return new Response(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
    });
}
