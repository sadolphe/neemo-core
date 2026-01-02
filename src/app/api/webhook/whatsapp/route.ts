import { NextRequest } from 'next/server';
import twilio from 'twilio';

// Plus de TwiML automatique (trop silencieux).
// On passe en mode "Pilote Manuel" pour catcher les erreurs.

export async function GET() {
    return new Response("Neemo Webhook Active", { status: 200 });
}

export async function POST(req: NextRequest) {
    // 1. Initialisation du Client API (Nécessaire pour avoir les erreurs de retour)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    // Le numéro du BOT (celui qui envoie)
    const botNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    console.log("🔥 [WEBHOOK] Requête reçue...");

    try {
        const text = await req.text();
        const params = new URLSearchParams(text);

        const body = params.get('Body') || '';
        const from = params.get('From') || ''; // Le numéro du Client
        const numMedia = parseInt(params.get('NumMedia') || '0');

        console.log(`📩 Message de ${from} : "${body}"`);

        // --- LOGIQUE DU BOT (Simplifiée pour l'exemple, mais incluant votre logique métier) ---
        let replyText = "";

        // Imports dynamiques pour ne pas alourdir le démarrage
        const { supabaseAdmin } = await import('@/lib/supabase');
        // const { interpretVoiceCommand } = await import('@/services/ai-processing'); // Décommentez pour IA

        if (body.toLowerCase().trim() === 'ping') {
            replyText = "🏓 Pong ! (Envoyé via API Securisée)";
        } else {
            // ICI : Votre logique Multi-boutique / IA normale
            // Pour l'instant, on fait un écho simple pour tester la robustesse
            const { data: shops } = await supabaseAdmin.from('shops').select('name').eq('phone', from);
            if (shops && shops.length > 0) {
                replyText = `👋 Bonjour ${shops[0].name} ! J'ai bien reçu : "${body}"`;
            } else {
                replyText = `❓ Numéro inconnu. Inscrivez-vous !`;
            }
        }

        // --- ENVOI ACTIF AVEC GESTION D'ERREUR ---
        if (replyText) {
            console.log(`📤 Tentative d'envoi vers ${from}...`);
            await client.messages.create({
                body: replyText,
                from: botNumber, // "whatsapp:+1415..."
                to: from
            });
            console.log("✅ Message envoyé avec SUCCÈS !");
        }

        // On répond TOUJOURS 200 OK à Twilio pour qu'il arrête de spammer,
        // même si on a eu une erreur d'envoi (qu'on a loggée).
        return new Response("OK", { status: 200 });

    } catch (e: any) {
        // C'EST ICI QUE LA MAGIE OPÈRE 🪄
        console.error("❌ ERREUR CRITIQUE TWILIO :");

        if (e.code === 63038) {
            console.error("⚠️ QUOTA LIMIT EXCEEDED (50 messages/jour). Upgradez le compte !");
        } else if (e.code === 21211) {
            console.error("⚠️ Numéro invalide (ou Sandbox non rejointe).");
        } else {
            console.error(`Code: ${e.code} | Message: ${e.message}`);
        }

        // On ne crash pas le webhook, on log juste l'erreur
        return new Response("Error handled", { status: 200 });
    }
}
