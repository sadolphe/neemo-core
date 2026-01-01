import { NextRequest } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

// Neemo Core Production v1.1.2 - Twilio Sync Check
export async function GET() {
    return new Response("OK", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function POST(req: NextRequest) {
    const twiml = new MessagingResponse();

    try {
        // 1. Parsing standard (Le plus fiable pour Twilio)
        const formData = await req.formData();
        const body = (formData.get('Body') as string) || '';
        const from = (formData.get('From') as string) || '';
        const numMedia = parseInt(formData.get('NumMedia') as string || '0');

        console.log(`[Neemo] POST: ${from} -> "${body}"`);

        // 2. Commande de secours interne (Ping)
        if (body.toLowerCase().trim() === 'ping') {
            twiml.message("🏓 Pong ! Neemo v1.1 est en ligne et reçoit vos messages.");
            return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // 3. Imports à la demande (Optimisation froid)
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { transcribeAudio, interpretVoiceCommand, analyzeInvoiceImage } = await import('@/services/ai-processing');

        // Logic Boutique
        const { data: shops } = await supabaseAdmin.from('shops').select('slug, name').eq('phone', from);
        const userShops = shops || [];

        if (userShops.length === 0) {
            twiml.message(`⚠️ Aucun magasin trouvé pour ce numéro : ${from}.\nInscrivez-vous sur : neemo-core.vercel.app/merchant/onboarding`);
            return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // Gestion Multi-Shop
        let targetSlug = userShops[0].slug;
        let multi = userShops.length > 1;

        if (multi) {
            const { data: sess } = await supabaseAdmin.from('merchant_sessions').select('active_shop_slug').eq('phone', from).maybeSingle();
            const lowBody = body.toLowerCase().trim();

            if (lowBody === 'menu' || lowBody === 'changer' || lowBody === 'boutique') {
                await supabaseAdmin.from('merchant_sessions').delete().eq('phone', from);
                let msg = "🏪 *Vos Boutiques* :\n\n";
                userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                msg += "\nRépondez par le chiffre pour choisir.";
                twiml.message(msg);
                return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
            }

            if (!sess?.active_shop_slug) {
                const idx = parseInt(lowBody) - 1;
                if (!isNaN(idx) && userShops[idx]) {
                    await supabaseAdmin.from('merchant_sessions').upsert({ phone: from, active_shop_slug: userShops[idx].slug, last_interaction: new Date().toISOString() });
                    twiml.message(`✅ Vous pilotez maintenant : *${userShops[idx].name}*.\nQue voulez-vous faire ?`);
                    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                } else {
                    let msg = "🏪 *Plusieurs boutiques trouvées* :\n\n";
                    userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                    msg += "\nRépondez par le chiffre pour choisir.";
                    twiml.message(msg);
                    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                }
            }
            targetSlug = sess.active_shop_slug;
        }

        // Exécution commande
        if (numMedia > 0) {
            const mediaUrl = formData.get('MediaUrl0') as string;
            const mediaType = formData.get('MediaContentType0') as string;

            if (mediaType.startsWith('image/')) {
                const dataArr = await analyzeInvoiceImage(mediaUrl);
                twiml.message(`🧾 Facture: ${dataArr.fournisseur || 'Inconnu'} (${dataArr.montant_total || '?'} DH)`);
            } else if (mediaType.startsWith('audio/')) {
                const text = await transcribeAudio(mediaUrl);
                const cmd = await interpretVoiceCommand(text);
                await executeUpdates(supabaseAdmin, targetSlug, cmd, twiml);
            }
        } else {
            const cmd = await interpretVoiceCommand(body);
            await executeUpdates(supabaseAdmin, targetSlug, cmd, twiml);
        }

        return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });

    } catch (e) {
        console.error('[Neemo] Error:', e);
        const err = new MessagingResponse();
        err.message("❌ Un souci technique momentané. Réessayez dans une minute.");
        return new Response(err.toString(), { headers: { 'Content-Type': 'text/xml' } });
    }
}

async function executeUpdates(supabase: any, slug: string, cmd: any, twiml: any) {
    if (cmd.intent === 'UPDATE_STATUS') {
        await supabase.from('shops').update({ status: cmd.value, updated_at: new Date().toISOString() }).eq('slug', slug);
        twiml.message(`✅ ${cmd.reply}`);
    } else if (cmd.intent === 'UPDATE_HOURS') {
        await supabase.from('shops').update({ hours: cmd.value, updated_at: new Date().toISOString() }).eq('slug', slug);
        twiml.message(`🕒 ${cmd.reply}`);
    } else {
        twiml.message(cmd.reply || `🤖 J'ai reçu votre message.`);
    }
}
