import { NextRequest } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

export async function GET() {
    const twiml = new MessagingResponse();
    twiml.message("Diagnostic GET: Webhook Neemo OK.");
    return new Response(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
    });
}

export async function POST(req: NextRequest) {
    console.log("[Neemo] Naked POST received");

    // TEST ULTIME : Réponse immédiate sans aucun calcul
    const twiml = new MessagingResponse();
    twiml.message("🤖 Test Direct: Si vous voyez ce message, la connexion Twilio-Vercel est parfaite !");

    const response = new Response(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
    });

    // On essaie quand même de parser en arrière-plan pour les logs, mais sans bloquer la réponse
    req.formData().then(async (formData) => {
        const body = (formData.get('Body') as string) || '';
        const from = (formData.get('From') as string) || '';
        console.log(`[Neemo] Async Log: from=${from}, body="${body}"`);

        // Commande 'ping' spéciale pour restaurer le code complet plus tard
        if (body.toLowerCase().trim() === 'reset') {
            console.log("[Neemo] Reset command received via logs");
        }
    }).catch(e => console.error("[Neemo] Async Parse Error:", e));

    return response;
}
