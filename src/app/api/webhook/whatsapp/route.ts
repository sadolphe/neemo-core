import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

export async function GET() {
    // Diagnostic : Retourne du TwiML même en GET pour tester si Twilio accepte le protocole
    const twiml = new MessagingResponse();
    twiml.message("Diagnostic: Webhook Neemo accessible via GET. Utilisez POST pour le fonctionnement normal.");

    return new Response(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
    });
}

export async function POST(req: NextRequest) {
    const twiml = new MessagingResponse();

    try {
        console.log(`[Neemo] Request received: ${req.method}`);

        // 1. Parsing IMMÉDIAT
        const formData = await req.formData();
        const body = (formData.get('Body') as string) || '';
        const from = (formData.get('From') as string) || '';
        const numMedia = parseInt(formData.get('NumMedia') as string || '0');

        console.log(`[Neemo] Incoming: from=${from}, body="${body}", media=${numMedia}`);

        // 2. TEST DE CONNECTIVITÉ (Ping)
        if (body.toLowerCase().trim() === 'ping') {
            twiml.message("🏓 Pong ! Neemo est en ligne et prêt à vous aider.");
            return new Response(twiml.toString(), {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        // 3. Imports LOURDS (Seulement si nécessaire)
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { transcribeAudio, interpretVoiceCommand, analyzeInvoiceImage } = await import('@/services/ai-processing');

        // Helper: Sélection de boutique
        const handleSelection = async (text: string) => {
            console.log(`[Neemo] Handling selection for ${from}`);
            const { data: shops, error: shopsErr } = await supabaseAdmin.from('shops').select('slug, name').eq('phone', from);

            if (shopsErr) {
                console.error(`[Neemo] Shops fetch error: ${shopsErr.message}`);
                throw new Error("Erreur base de données (shops)");
            }

            const userShops = shops || [];

            if (userShops.length === 0) {
                console.log(`[Neemo] No shops found for ${from}`);
                twiml.message(`⚠️ Aucun magasin trouvé pour ce numéro.`);
                return { slug: null, shops: [], responded: true };
            }

            if (userShops.length === 1) {
                console.log(`[Neemo] Single shop found: ${userShops[0].slug}`);
                return { slug: userShops[0].slug, shops: userShops };
            }

            // Multi-shop
            const { data: sess } = await supabaseAdmin.from('merchant_sessions').select('active_shop_slug').eq('phone', from).maybeSingle();
            const low = text.toLowerCase().trim();

            if (low === 'menu' || low === 'changer' || low === 'boutique') {
                await supabaseAdmin.from('merchant_sessions').delete().eq('phone', from);
                let msg = "🏪 *Vos Boutiques* :\n\n";
                userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                msg += "\nRépondez par le chiffre pour choisir.";
                twiml.message(msg);
                return { slug: null, shops: userShops, responded: true };
            }

            if (sess?.active_shop_slug) {
                console.log(`[Neemo] Active session: ${sess.active_shop_slug}`);
                return { slug: sess.active_shop_slug, shops: userShops };
            }

            const idx = parseInt(low) - 1;
            if (!isNaN(idx) && userShops[idx]) {
                await supabaseAdmin.from('merchant_sessions').upsert({
                    phone: from,
                    active_shop_slug: userShops[idx].slug,
                    last_interaction: new Date().toISOString()
                });
                twiml.message(`✅ Session activée : *${userShops[idx].name}*.\nQue voulez-vous faire ?`);
                return { slug: userShops[idx].slug, shops: userShops, responded: true };
            }

            console.log(`[Neemo] Prompting for shop selection`);
            let msg = "🏪 *Plusieurs boutiques trouvées* :\n\n";
            userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
            msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
            twiml.message(msg);
            return { slug: null, shops: userShops, responded: true };
        };

        // Helper: Exécution commande
        const runCmd = async (cmd: any, slug: string, multi: boolean) => {
            console.log(`[Neemo] Executing command on ${slug}: ${cmd.intent}`);

            if (multi) {
                await supabaseAdmin.from('merchant_sessions').upsert({
                    phone: from,
                    active_shop_slug: slug,
                    last_interaction: new Date().toISOString()
                });
            }

            if (cmd.intent === 'UPDATE_STATUS') {
                await supabaseAdmin.from('shops').update({
                    status: cmd.value,
                    updated_at: new Date().toISOString()
                }).eq('slug', slug);
                twiml.message(`✅ ${cmd.reply}`);
            } else if (cmd.intent === 'UPDATE_HOURS') {
                await supabaseAdmin.from('shops').update({
                    hours: cmd.value,
                    updated_at: new Date().toISOString()
                }).eq('slug', slug);
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
                if (selection.responded) return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                if (selection.slug) {
                    const cmd = await interpretVoiceCommand(txt);
                    await runCmd(cmd, selection.slug, selection.shops.length > 1);
                }
            }
        } else {
            const selection = await handleSelection(body);
            if (selection.responded) return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });

            if (selection.slug) {
                const cmd = await interpretVoiceCommand(body);
                console.log(`[Neemo] Interpreted intent: ${cmd.intent}`);
                await runCmd(cmd, selection.slug, selection.shops.length > 1);
            }
        }

        console.log(`[Neemo] Sending success TwiML response`);
        return new Response(twiml.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (e) {
        console.error('[Neemo] Webhook Error Trace:', e);
        const errTwiml = new MessagingResponse();
        errTwiml.message("❌ Un petit souci technique côté Neemo. Essayez 'ping' pour tester.");

        return new Response(errTwiml.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });
    }
}
