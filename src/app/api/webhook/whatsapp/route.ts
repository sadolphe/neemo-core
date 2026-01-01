import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

export async function GET() {
    // Check: 2026-01-02 00:10
    return new Response("Neemo Webhook is ACTIVE. Use POST for WhatsApp.", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function POST(req: NextRequest) {
    const twiml = new MessagingResponse();

    try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { transcribeAudio, interpretVoiceCommand, analyzeInvoiceImage } = await import('@/services/ai-processing');

        /**
         * Handles shop selection and session management.
         */
        const handleShopSelection = async (from: string, body: string, twiml: any) => {
            const { data: shops } = await supabaseAdmin
                .from('shops')
                .select('slug, name')
                .eq('phone', from);

            const userShops = shops || [];

            if (userShops.length === 0) {
                twiml.message(`⚠️ Aucun magasin trouvé pour ${from}.\nInscrivez-vous sur : neemo-core.vercel.app/merchant/onboarding`);
                return { targetSlug: null, userShops, sessionResponse: new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } }) };
            }

            if (userShops.length === 1) {
                return { targetSlug: userShops[0].slug, userShops };
            }

            // Multi-shop logic
            const { data: session } = await supabaseAdmin
                .from('merchant_sessions')
                .select('active_shop_slug')
                .eq('phone', from)
                .maybeSingle();

            const lowBody = body.toLowerCase().trim();

            if (lowBody === 'menu' || lowBody === 'changer') {
                await supabaseAdmin.from('merchant_sessions').delete().eq('phone', from);
                let msg = "🏪 *Vos Boutiques* :\n\n";
                userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
                twiml.message(msg);
                return { targetSlug: null, userShops, sessionResponse: new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } }) };
            }

            if (session?.active_shop_slug) {
                return { targetSlug: session.active_shop_slug, userShops };
            }

            // Check for numeric selection
            const selectionIndex = parseInt(lowBody) - 1;
            if (!isNaN(selectionIndex) && userShops[selectionIndex]) {
                const selectedShop = userShops[selectionIndex];
                await supabaseAdmin.from('merchant_sessions').upsert({
                    phone: from,
                    active_shop_slug: selectedShop.slug,
                    last_interaction: new Date().toISOString()
                });
                twiml.message(`✅ Vous pilotez maintenant : *${selectedShop.name}*.\nQue voulez-vous faire ?`);
                return { targetSlug: selectedShop.slug, userShops, sessionResponse: new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } }) };
            }

            // No session and no selection: ask to choose
            let msg = "🏪 *Plusieurs boutiques trouvées* :\n\n";
            userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
            msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
            twiml.message(msg);
            return { targetSlug: null, userShops, sessionResponse: new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } }) };
        };

        /**
         * Executes the AI-interpreted command on the target shop.
         */
        const executeCommand = async (command: any, targetSlug: string, from: string, hasMultipleShops: boolean, twiml: any) => {
            // Refresh session if multiple shops
            if (hasMultipleShops) {
                await supabaseAdmin.from('merchant_sessions').upsert({
                    phone: from,
                    active_shop_slug: targetSlug,
                    last_interaction: new Date().toISOString()
                });
            }

            if (command.intent === 'UPDATE_STATUS') {
                const { error } = await supabaseAdmin
                    .from('shops')
                    .update({ status: command.value, updated_at: new Date().toISOString() })
                    .eq('slug', targetSlug);

                if (error) throw new Error(`DB Error: ${error.message}`);
                twiml.message(`✅ ${command.reply}`);

            } else if (command.intent === 'UPDATE_HOURS') {
                const { error } = await supabaseAdmin
                    .from('shops')
                    .update({ hours: command.value, updated_at: new Date().toISOString() })
                    .eq('slug', targetSlug);

                if (error) throw new Error(`DB Error: ${error.message}`);
                twiml.message(`🕒 ${command.reply}`);
            } else {
                twiml.message(command.reply || `👋 J'ai bien reçu votre message. Comment puis-je vous aider ?`);
            }
        };

        // 1. Parsing de la requête entrante
        const formData = await req.formData();
        const body = (formData.get('Body') as string) || '';
        const from = (formData.get('From') as string) || '';
        const numMedia = parseInt(formData.get('NumMedia') as string || '0');

        console.log(`[Neemo] Webhook call: ${from} -> ${body} (${numMedia} media)`);

        // TEST DE CONNECTIVITÉ (Ping)
        if (body.toLowerCase().trim() === 'ping') {
            twiml.message("🏓 Pong ! Neemo est en ligne et prêt à vous aider.");
            return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        if (numMedia > 0) {
            const mediaUrl = formData.get('MediaUrl0') as string;
            const mediaType = formData.get('MediaContentType0') as string;

            if (mediaType.startsWith('image/')) {
                try {
                    const data = await analyzeInvoiceImage(mediaUrl);
                    twiml.message(`🧾 Facture analysée !\nFournisseur: ${data.fournisseur || 'Inconnu'}\nTotal: ${data.montant_total || '?'} DH\n\nArticles: ${data.Items?.length || 0}`);
                } catch (e) {
                    console.error('[Neemo] Image analysis error:', e);
                    twiml.message("⚠️ Je n'arrive pas à lire cette facture.");
                }
            } else if (mediaType.startsWith('audio/')) {
                const text = await transcribeAudio(mediaUrl);
                const command = await interpretVoiceCommand(text);
                const selection = await handleShopSelection(from, text, twiml);

                if (selection.sessionResponse) return selection.sessionResponse;

                if (selection.targetSlug) {
                    await executeCommand(command, selection.targetSlug, from, selection.userShops.length > 1, twiml);
                } else {
                    twiml.message(`🎙️ J'ai entendu : "${text}"`);
                }
            } else {
                twiml.message("📁 Fichier reçu. Envoyez une image ou un vocal.");
            }
        } else {
            // Logic Texte
            const selection = await handleShopSelection(from, body, twiml);
            if (selection.sessionResponse) return selection.sessionResponse;

            if (selection.targetSlug) {
                const command = await interpretVoiceCommand(body);
                await executeCommand(command, selection.targetSlug, from, selection.userShops.length > 1, twiml);
            }
        }

        return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });

    } catch (error) {
        console.error('[Neemo] Critical Webhook Error:', error);
        const errorTwiml = new MessagingResponse();
        errorTwiml.message("❌ Neemo a un petit problème technique. Réessayez dans un instant.");
        return new NextResponse(errorTwiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
    }
}
