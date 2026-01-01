import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

export async function POST(req: NextRequest) {
    try {
        // 1. Parsing de la requête entrante (FormData de Twilio)
        const formData = await req.formData();
        const body = formData.get('Body') as string;
        const from = formData.get('From') as string;

        console.log(`[Neemo] Message received from ${from}: ${body}`);

        // 2. Construction de la réponse TwiML
        const twiml = new MessagingResponse();
        const numMedia = parseInt(formData.get('NumMedia') as string || '0');

        if (numMedia > 0) {
            const mediaUrl = formData.get('MediaUrl0') as string;
            const mediaType = formData.get('MediaContentType0') as string;

            if (mediaType.startsWith('image/')) {
                // Flux Oeil (Vision)
                // Note: En production, il faut passer par une Queue (Inngest/Bull) pour éviter le timeout Vercel (10s).
                // Pour le MVP "Démo", on tente le await direct.
                try {
                    const { analyzeInvoiceImage } = await import('@/services/ai-processing');
                    const data = await analyzeInvoiceImage(mediaUrl);

                    twiml.message(`🧾 Facture analysée !\nFournisseur: ${data.fournisseur || 'Inconnu'}\nTotal: ${data.montant_total || '?'} DH\n\nArticles: ${data.Items?.length || 0}`);
                } catch (e) {
                    console.error(e);
                    twiml.message("⚠️ Je n'arrive pas à lire cette facture.");
                }

            } else if (mediaType.startsWith('audio/')) {
                // Flux Oreille (Whisper + Intent)
                try {
                    const { transcribeAudio, interpretVoiceCommand } = await import('@/services/ai-processing');
                    const { supabaseAdmin } = await import('@/lib/supabase');

                    // 1. Transcription (Audio -> Texte)
                    const text = await transcribeAudio(mediaUrl);
                    console.log(`[Neemo] Transcribed: "${text}"`);

                    // 2. Interprétation (Texte -> Action)
                    const command = await interpretVoiceCommand(text);
                    console.log(`[Neemo] Intent: ${command.intent}, Value: ${command.value}`);

                    if (command.intent === 'UPDATE_STATUS') {
                        const { error } = await supabaseAdmin
                            .from('shops')
                            .update({ status: command.value }) // Ne touche PLUS aux horaires
                            .eq('phone', from);

                        if (error) throw new Error(`DB Error: ${error.message}`);
                        twiml.message(`✅ ${command.reply}`);

                    } else if (command.intent === 'UPDATE_HOURS') {
                        const { error } = await supabaseAdmin
                            .from('shops')
                            .update({ hours: command.value })
                            .eq('phone', from);

                        if (error) throw new Error(`DB Error: ${error.message}`);
                        twiml.message(`🕒 ${command.reply}`);
                    } else {
                        // Fallback (Simple écho)
                        twiml.message(`🎙️ J'ai entendu : "${text}"`);
                    }

                } catch (e) {
                    console.error(e);
                    twiml.message("⚠️ Je n'arrive pas à écouter ce message.");
                }
            } else {
                twiml.message("📁 Fichier reçu. Envoyez une image ou un vocal.");
            }

        } else {
            // Logic Texte (Traité comme une commande vocale)
            try {
                const { interpretVoiceCommand } = await import('@/services/ai-processing');
                const { supabaseAdmin } = await import('@/lib/supabase');

                // Utilisation directe du texte reçu
                const command = await interpretVoiceCommand(body);
                console.log(`[Neemo] Text Intent: ${command.intent}, Value: ${command.value}`);

                if (command.intent === 'UPDATE_STATUS') {
                    const { error } = await supabaseAdmin
                        .from('shops')
                        .update({ status: command.value })
                        .eq('phone', from);

                    if (error) throw new Error(`DB Error: ${error.message}`);
                    twiml.message(`✅ ${command.reply}`);

                } else if (command.intent === 'UPDATE_HOURS') {
                    const { error } = await supabaseAdmin
                        .from('shops')
                        .update({ hours: command.value })
                        .eq('phone', from);

                    if (error) throw new Error(`DB Error: ${error.message}`);
                    twiml.message(`🕒 ${command.reply}`);
                } else {
                    // Si l'IA ne comprend pas (intent 'OTHER'), on garde le message d'accueil
                    twiml.message(`👋 Marhba ! J'ai bien reçu : "${body}".\n\n(Envoyez une commande claire comme "Ferme le magasin" ou une photo de facture)`);
                }
            } catch (e) {
                console.error(e);
                twiml.message("⚠️ Je n'arrive pas à comprendre ce message.");
            }
        }

        // 3. Retour de la réponse XML
        return new NextResponse(twiml.toString(), {
            headers: {
                'Content-Type': 'text/xml',
            },
        });
    } catch (error) {
        console.error('[Neemo] Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
