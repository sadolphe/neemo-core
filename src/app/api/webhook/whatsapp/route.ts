import { NextRequest, NextResponse } from 'next/server';
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
        // 1. Parsing IMMÉDIAT
        const formData = await req.formData();
        const body = (formData.get('Body') as string) || '';
        const from = (formData.get('From') as string) || '';
        const numMedia = parseInt(formData.get('NumMedia') as string || '0');

        console.log(`[Neemo] POST received: ${from} -> ${body}`);

        // 2. TEST DE CONNECTIVITÉ (Avant tout import lourd)
        if (body.toLowerCase().trim() === 'ping') {
            twiml.message("🏓 Pong ! Neemo est en ligne et prêt à vous aider.");
            return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // 3. Imports LOURDS (Seulement si nécessaire)
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { transcribeAudio, interpretVoiceCommand, analyzeInvoiceImage } = await import('@/services/ai-processing');

        // Helper: Sélection de boutique
        const handleSelection = async (text: string) => {
            const { data: shops } = await supabaseAdmin.from('shops').select('slug, name').eq('phone', from);
            const userShops = shops || [];

            if (userShops.length === 0) {
                twiml.message(`⚠️ Aucun magasin trouvé pour ${from}.`);
                return { slug: null, shops: [] };
            }

            if (userShops.length === 1) return { slug: userShops[0].slug, shops: userShops };

            // Multi-shop
            const { data: sess } = await supabaseAdmin.from('merchant_sessions').select('active_shop_slug').eq('phone', from).maybeSingle();
            const low = text.toLowerCase().trim();

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

        // Helper: Exécution commande
        const runCmd = async (cmd: any, slug: string, multi: boolean) => {
            if (multi) await supabaseAdmin.from('merchant_sessions').upsert({ phone: from, active_shop_slug: slug, last_interaction: new Date().toISOString() });

            if (cmd.intent === 'UPDATE_STATUS') {
                await supabaseAdmin.from('shops').update({ status: cmd.value, updated_at: new Date().toISOString() }).eq('slug', slug);
                twiml.message(`✅ ${cmd.reply}`);
            } else if (cmd.intent === 'UPDATE_HOURS') {
                await supabaseAdmin.from('shops').update({ hours: cmd.value, updated_at: new Date().toISOString() }).eq('slug', slug);
                twiml.message(`🕒 ${cmd.reply}`);
            } else {
                twiml.message(cmd.reply || `👋 J'ai reçu : "${body}"`);
            }
        };

        // 4. LOGIQUE PRINCIPALE
        if (numMedia > 0) {
            const mediaUrl = formData.get('MediaUrl0') as string;
            const mediaType = formData.get('MediaContentType0') as string;

            if (mediaType.startsWith('image/')) {
                const data = await analyzeInvoiceImage(mediaUrl);
                twiml.message(`🧾 Facture: ${data.fournisseur || 'Inconnu'} (${data.montant_total || '?'} DH)`);
            } else if (mediaType.startsWith('audio/')) {
                const txt = await transcribeAudio(mediaUrl);
                const selection = await handleSelection(txt);
                if (selection.responded) return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                if (selection.slug) {
                    const cmd = await interpretVoiceCommand(txt);
                    await runCmd(cmd, selection.slug, selection.shops.length > 1);
                }
            }
        } else {
            const selection = await handleSelection(body);
            if (selection.responded) return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
            if (selection.slug) {
                const cmd = await interpretVoiceCommand(body);
                await runCmd(cmd, selection.slug, selection.shops.length > 1);
            }
        }

        return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });

    } catch (e) {
        console.error('[Neemo] Webhook Error:', e);
        const errTwiml = new MessagingResponse();
        errTwiml.message("❌ Un petit souci technique. Réessaye plus tard.");
        return new NextResponse(errTwiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
    }
}
