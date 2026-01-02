import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase';
import { transcribeAudio, interpretVoiceCommand } from '@/services/ai-processing';
import { findOrCreateCustomer, updateCustomerBalance } from '@/app/actions/karnach';

export async function GET() {
    return new Response("Neemo Webhook Active", { status: 200 });
}

export async function POST(req: NextRequest) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);
    const botNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    console.log("🔥 [WEBHOOK] Request received...");

    try {
        const text = await req.text();
        const params = new URLSearchParams(text);

        const body = params.get('Body') || '';
        const from = params.get('From') || '';
        const numMedia = parseInt(params.get('NumMedia') || '0');
        const mediaUrl = params.get('MediaUrl0');
        const mediaType = params.get('MediaContentType0');

        console.log(`📩 Message from ${from}`);

        // 1. Identify Shop via Phone Number
        // Note: 'from' is "whatsapp:+212...", database might store "+212..." or local format.
        // Ideally we normalize. For MVP assuming exact match or standard format.
        const cleanPhone = from.replace('whatsapp:', '');
        const { data: shops } = await supabaseAdmin.from('shops').select('id, name').eq('phone', cleanPhone);

        if (!shops || shops.length === 0) {
            await client.messages.create({
                body: "🚫 Numéro non reconnu. Inscrivez-vous sur Neemo !",
                from: botNumber,
                to: from
            });
            return new Response("OK", { status: 200 });
        }

        const shop = shops[0];
        let replyText = "";

        // 2. Transcribe or Use Text
        let commandText = body;
        if (numMedia > 0 && mediaUrl && mediaType?.startsWith('audio/')) {
            console.log("🎤 Voice note detected. Transcribing...");
            try {
                commandText = await transcribeAudio(mediaUrl);
                console.log(`📝 Transcribed: "${commandText}"`);
            } catch (err) {
                console.error("Transcription failed", err);
                commandText = ""; // Fallback
                replyText = "⚠️ Désolé, je n'ai pas pu écouter l'audio.";
            }
        }

        // 3. Interpret Command
        if (commandText) {
            const interpretation = await interpretVoiceCommand(commandText);
            console.log("🧠 Intent:", interpretation);

            const { intent, value, reply } = interpretation;
            replyText = reply; // Default AI reply

            // 4. Execute Logic based on Intent
            if (intent === 'KARNACH_DEBT' || intent === 'KARNACH_PAYMENT') {
                try {
                    // Expect value to be JSON string: { "customer": "Name", "amount": 20 }
                    // Sometimes GPT returns object directly if we asked for JSON mode, but `interpretVoiceCommand` parses it.
                    // Wait, interpretVoiceCommand returns JSON.parse(content).
                    // So `value` might be the object itself if I mapped it that way in prompt?
                    // In prompt I said: "Map to Value: JSON string". 
                    // Actually, `interpretVoiceCommand` return type says `value?: string`.
                    // OpenAI usually returns a string value in the field if instructed.
                    // Let's parse it if it's a string, or handle if it's already object (unlikely given TS type).

                    let data: any = value;
                    if (typeof value === 'string') {
                        try { data = JSON.parse(value); } catch (e) { console.error("JSON parse error", e); }
                    }

                    if (data && data.customer && data.amount) {
                        // Find/Create Customer
                        const custRes = await findOrCreateCustomer(shop.id, data.customer);
                        if (custRes.success && custRes.data) {
                            const customer = custRes.data;
                            const amount = Number(data.amount);

                            // Logic:
                            // DEBT: Add Debt -> Negative Balance (e.g. -20)
                            // PAYMENT: Pay Debt -> Positive/Restore Balance (e.g. +20)

                            const finalAmount = intent === 'KARNACH_DEBT' ? -amount : amount;
                            const type = intent === 'KARNACH_DEBT' ? 'SALE' : 'DEBT_PAYMENT';

                            const updateRes = await updateCustomerBalance(shop.id, customer.id, finalAmount, type);

                            if (updateRes.success) {
                                const newSolde = updateRes.newBalance;
                                const icon = intent === 'KARNACH_DEBT' ? '🔴' : '🟢';
                                replyText = `${icon} C'est noté chef !\n👤 Client : ${customer.name}\n💰 Solde : ${newSolde} Dh`;
                            } else {
                                replyText = "❌ Erreur lors de la mise à jour du solde.";
                            }
                        } else {
                            replyText = "❌ Impossible de trouver ou créer ce client.";
                        }
                    }
                } catch (actionErr) {
                    console.error("Action Error", actionErr);
                    replyText = "⚠️ Erreur technique lors de l'opération Karnach.";
                }
            }
        }

        // 5. Send Reply
        if (replyText) {
            await client.messages.create({
                body: replyText,
                from: botNumber,
                to: from
            });
        }

        return new Response("OK", { status: 200 });

    } catch (e: any) {
        console.error("❌ WEBHOOK ERROR:", e);
        return new Response("Error handled", { status: 200 });
    }
}
