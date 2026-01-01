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

                    // --- LOGIQUE MULTI-BOUTIQUES (identique au texte) ---

                    const { data: shops } = await supabaseAdmin
                        .from('shops')
                        .select('slug, name')
                        .eq('phone', from);

                    const userShops = shops || [];
                    console.log(`[DEBUG] Phone: ${from}, Shops found: ${userShops.length}`);

                    if (userShops.length === 0) {
                        twiml.message(`⚠️ Aucun magasin trouvé pour ce numéro (${from}).\nInscrivez-vous sur : neemo-core.vercel.app/merchant/onboarding`);
                        return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                    }

                    let targetSlug = null;

                    if (userShops.length === 1) {
                        targetSlug = userShops[0].slug;
                        console.log(`[DEBUG] Single shop mode: ${targetSlug}`);
                    } else {
                        const { data: session } = await supabaseAdmin
                            .from('merchant_sessions')
                            .select('active_shop_slug')
                            .eq('phone', from)
                            .maybeSingle();

                        console.log(`[DEBUG] Multi-shop mode. Session found:`, session);

                        if (session?.active_shop_slug) {
                            targetSlug = session.active_shop_slug;
                            console.log(`[DEBUG] Using session slug: ${targetSlug}`);
                        } else {
                            let msg = "🏪 *Plusieurs boutiques trouvées* :\n\n";
                            userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                            msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
                            twiml.message(msg);
                            return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                        }
                    }

                    // --- EXECUTION COMMANDE ---

                    // Refresh session timestamp
                    if (userShops.length > 1 && targetSlug) {
                        await supabaseAdmin.from('merchant_sessions').upsert({
                            phone: from,
                            active_shop_slug: targetSlug,
                            last_interaction: new Date().toISOString()
                        });
                    }

                    if (command.intent === 'UPDATE_STATUS') {
                        const { error } = await supabaseAdmin
                            .from('shops')
                            .update({
                                status: command.value,
                                updated_at: new Date().toISOString()
                            })
                            .eq('slug', targetSlug);

                        if (error) throw new Error(`DB Error: ${error.message}`);
                        twiml.message(`✅ ${command.reply}`);

                    } else if (command.intent === 'UPDATE_HOURS') {
                        const { error } = await supabaseAdmin
                            .from('shops')
                            .update({
                                hours: command.value,
                                updated_at: new Date().toISOString()
                            })
                            .eq('slug', targetSlug);

                        if (error) throw new Error(`DB Error: ${error.message}`);
                        twiml.message(`🕒 ${command.reply}`);
                    } else {
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

                // --- LOGIQUE MULTI-BOUTIQUES (AVANT L'IA) ---

                // 1. Lister les shops du numéro
                const { data: shops } = await supabaseAdmin
                    .from('shops')
                    .select('slug, name')
                    .eq('phone', from);

                const userShops = shops || [];

                if (userShops.length === 0) {
                    twiml.message(`⚠️ Aucun magasin trouvé pour ce numéro (${from}).\nInscrivez-vous sur : neemo-core.vercel.app/merchant/onboarding`);
                    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                }

                let targetSlug = null;

                if (userShops.length === 1) {
                    targetSlug = userShops[0].slug;
                } else {
                    // Gestion Multi-Boutiques
                    const { data: session } = await supabaseAdmin
                        .from('merchant_sessions')
                        .select('active_shop_slug')
                        .eq('phone', from)
                        .maybeSingle();

                    const messageText = body.toLowerCase().trim();

                    // Commande de reset
                    if (messageText === 'menu' || messageText === 'changer') {
                        await supabaseAdmin.from('merchant_sessions').delete().eq('phone', from);
                        let msg = "🏪 *Vos Boutiques* :\n\n";
                        userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                        msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
                        twiml.message(msg);
                        return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                    }

                    // Si session existe, on l'utilise
                    if (session?.active_shop_slug) {
                        targetSlug = session.active_shop_slug;
                    } else {
                        // Pas de session : vérifier si c'est une sélection (1, 2...)
                        const selectionIndex = parseInt(messageText) - 1;
                        if (!isNaN(selectionIndex) && userShops[selectionIndex]) {
                            const selectedShop = userShops[selectionIndex];
                            // Upsert Session
                            await supabaseAdmin.from('merchant_sessions').upsert({
                                phone: from,
                                active_shop_slug: selectedShop.slug,
                                last_interaction: new Date().toISOString()
                            });
                            twiml.message(`✅ Vous pilotez maintenant : *${selectedShop.name}*.\nQue voulez-vous faire ?`);
                            return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                        }

                        // Pas de session ET pas de sélection valide : demander de choisir
                        let msg = "🏪 *Plusieurs boutiques trouvées* :\n\n";
                        userShops.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
                        msg += "\nRépondez par le chiffre (ex: 1) pour choisir.";
                        twiml.message(msg);
                        return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
                    }
                }

                // --- INTERPRETATION IA (Seulement si on a un targetSlug) ---

                // Utilisation directe du texte reçu
                const command = await interpretVoiceCommand(body);
                console.log(`[Neemo] Text Intent: ${command.intent}, Value: ${command.value}`);

                // Refresh session timestamp
                if (userShops.length > 1 && targetSlug) {
                    await supabaseAdmin.from('merchant_sessions').upsert({
                        phone: from,
                        active_shop_slug: targetSlug,
                        last_interaction: new Date().toISOString()
                    });
                }

                if (command.intent === 'UPDATE_STATUS') {
                    const { error } = await supabaseAdmin
                        .from('shops')
                        .update({
                            status: command.value,
                            updated_at: new Date().toISOString()
                        })
                        .eq('slug', targetSlug); // TARGET SLUG

                    if (error) throw new Error(`DB Error: ${error.message}`);
                    twiml.message(`✅ ${command.reply}`);

                } else if (command.intent === 'UPDATE_HOURS') {
                    const { error } = await supabaseAdmin
                        .from('shops')
                        .update({
                            hours: command.value,
                            updated_at: new Date().toISOString()
                        })
                        .eq('slug', targetSlug); // TARGET SLUG

                    if (error) throw new Error(`DB Error: ${error.message}`);
                    twiml.message(`🕒 ${command.reply}`);
                } else {
                    // Si l'IA ne comprend pas (intent 'OTHER'), on garde le message d'accueil
                    twiml.message(`👋 Marhba ! J'ai bien reçu : "${body}".\n\n(Envoyez une commande claire comme "Ferme le magasin" ou une photo de facture)`);
                }
            } catch (e) {
                console.error('[Neemo] Text Error:', e);
                twiml.message(`⚠️ Erreur (Texte): ${e instanceof Error ? e.message : 'Inconnue'}`);
            }
        }

        console.log(`[Neemo] Final TwiML: ${twiml.toString()}`);

        // 3. Retour de la réponse XML
        return new NextResponse(twiml.toString(), {
            headers: {
                'Content-Type': 'text/xml',
            },
        });
    } catch (error) {
        console.error('[Neemo] Critical Error:', error);
        // Fallback TwiML even for critical errors so the user sees SOMETHING
        const errorTwiml = new MessagingResponse();
        errorTwiml.message("❌ Neemo a un petit problème technique. Réessayez dans un instant.");
        return new NextResponse(errorTwiml.toString(), {
            headers: { 'Content-Type': 'text/xml' },
        });
    }
}
