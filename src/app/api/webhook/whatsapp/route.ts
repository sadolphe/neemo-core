import { NextRequest } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

export async function GET() {
    return new Response("Neemo Webhook is ACTIVE. Use POST for WhatsApp.", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function POST(req: NextRequest) {
    const twiml = new MessagingResponse();

    try {
        // 1. Parsing super-robuste (req.formData() peut parfois poser problème sur Edge/Serverless)
        const text = await req.text();
        const params = new URLSearchParams(text);

        const body = params.get('Body') || '';
        const from = params.get('From') || '';
        const numMedia = parseInt(params.get('NumMedia') || '0');

        console.log(`[Neemo] POST Raw: ${text.substring(0, 100)}...`);
        console.log(`[Neemo] Parsed: from=${from}, body="${body}"`);

        // 2. Réponse de secours immédiate pour 'ping'
        if (body.toLowerCase().trim() === 'ping') {
            twiml.message("🏓 Pong ! Neemo est en ligne et reçoit vos messages.");
            return new Response(twiml.toString(), {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        // 3. Imports LOURDS (Seulement si nécessaire)
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { transcribeAudio, interpretVoiceCommand, analyzeInvoiceImage } = await import('@/services/ai-processing');

        // Helper: Sélection de boutique
        const handleSelection = async (textStr: string) => {
            const { data: shops } = await supabaseAdmin.from('shops').select('slug, name').eq('phone', from);
            const userShops = shops || [];

            if (userShops.length === 0) {
                twiml.message(`⚠️ Aucun magasin trouvé pour ce numéro.`);
                return { slug: null, shops: [], responded: true };
            }

            if (userShops.length === 1) return { slug: userShops[0].slug, shops: userShops };

            const { data: sess } = await supabaseAdmin.from('merchant_sessions').select('active_shop_slug').eq('phone', from).maybeSingle();
            const low = textStr.toLowerCase().trim();

            if (low === 'menu' || low === 'changer') {
                await supabaseAdmin.from('merchant_sessions').delete().eq('phone', from);
                let msg = "🏪 *Vos Boutiques* :\n\n";
                userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                msg += "\nRépondez par le chiffre pour choisir.";
                twiml.message(msg);
                return { slug: null, shops: userShops, responded: true };
            }

            if (sess?.active_shop_slug) return { slug: sess.active_shop_slug, shops: userShops };

            const idx = parseInt(low) - 1;
            if (!isNaN(idx) && userShops[idx]) {
                await supabaseAdmin.from('merchant_sessions').upsert({ phone: from, active_shop_slug: userShops[idx].slug, last_interaction: new Date().toISOString() });
                twiml.message(`✅ Session : *${userShops[idx].name}*.\nQue voulez-vous faire ?`);
                return { slug: userShops[idx].slug, shops: userShops, responded: true };
            }

            let msg = "🏪 *Choix boutique* :\n\n";
            userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
            twiml.message(msg);
            return { slug: null, shops: userShops, responded: true };
        };

        // 4. Logique Principale
        if (numMedia > 0) {
            const mediaUrl = params.get('MediaUrl0') || '';
            const mediaType = params.get('MediaContentType0') || '';

            if (mediaType.startsWith('image/')) {
                const data = await analyzeInvoiceImage(mediaUrl);
                twiml.message(`🧾 Facture: ${data.fournisseur || 'Inconnu'} (${data.montant_total || '?'} DH)`);
            } else if (mediaType.startsWith('audio/')) {
                const audioTxt = await transcribeAudio(mediaUrl);
                const sel = await handleSelection(audioTxt);
                if (!sel.responded && sel.slug) {
                    const cmd = await interpretVoiceCommand(audioTxt);
                    if (cmd.intent === 'UPDATE_STATUS') {
                        await supabaseAdmin.from('shops').update({ status: cmd.value, updated_at: new Date().toISOString() }).eq('slug', sel.slug);
                    } else if (cmd.intent === 'UPDATE_HOURS') {
                        await supabaseAdmin.from('shops').update({ hours: cmd.value, updated_at: new Date().toISOString() }).eq('slug', sel.slug);
                    }
                    twiml.message(cmd.reply);
                }
            }
        } else {
            const sel = await handleSelection(body);
            if (!sel.responded && sel.slug) {
                const cmd = await interpretVoiceCommand(body);
                if (cmd.intent === 'UPDATE_STATUS') {
                    await supabaseAdmin.from('shops').update({ status: cmd.value, updated_at: new Date().toISOString() }).eq('slug', sel.slug);
                } else if (cmd.intent === 'UPDATE_HOURS') {
                    await supabaseAdmin.from('shops').update({ hours: cmd.value, updated_at: new Date().toISOString() }).eq('slug', sel.slug);
                }
                twiml.message(cmd.reply);
            }
        }

        return new Response(twiml.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (e) {
        console.error('[Neemo] Webhook Error:', e);
        const errTw = new MessagingResponse();
        errTw.message("❌ Erreur technique. Essayez plus tard.");
        return new Response(errTw.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });
    }
}
