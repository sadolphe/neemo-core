import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import twilio from 'twilio';

// Helper to calculate margin
function calculateMargin(buyingPrice: string | number, sellingPrice: string | number) {
    const buy = Number(buyingPrice) || 0;
    const sell = Number(sellingPrice) || 0;
    if (sell === 0) return 0;
    return ((sell - buy) / sell) * 100;
}

export async function GET(req: NextRequest) {
    // Basic security: Check for a CRON_SECRET if deployed, or allow local dev
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //    return new Response('Unauthorized', { status: 401 });
    // }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const botNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    const client = twilio(accountSid, authToken);

    console.log("⏰ [CRON] Starting Stock Check...");

    // 1. Fetch all shops with their products
    const { data: shops, error } = await supabaseAdmin
        .from('shops')
        .select('id, name, phone, products');

    if (error || !shops) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }

    const results = [];

    // 2. Iterate shops
    for (const shop of shops) {
        if (!shop.phone || !shop.products || !Array.isArray(shop.products)) continue;

        const products: any[] = shop.products;
        const lowStockItems = products.filter(p => {
            // Default to 0 if quantity missing
            const qty = Number(p.quantity) || 0;
            return qty <= 5;
        });

        if (lowStockItems.length > 0) {
            // Format WhatsApp Message
            let msg = `🚨 *Alerte Stock ${shop.name}*\n\nIl est temps de commander :\n`;

            lowStockItems.forEach(p => {
                const qty = Number(p.quantity) || 0;
                const margin = calculateMargin(p.buying_price, p.price);

                msg += `- ${p.name} (Reste: ${qty})`;

                if (margin < 20 && p.price > 0) {
                    msg += ` ⚠️ Marge faible (${margin.toFixed(0)}%)`;
                }
                msg += '\n';
            });

            msg += `\nRépondez avec une photo de facture pour mettre à jour ! 📸`;

            // Send Message
            try {
                // Ensure phone has whatsapp prefix
                const to = shop.phone.startsWith('whatsapp:') ? shop.phone : `whatsapp:${shop.phone}`;

                await client.messages.create({
                    body: msg,
                    from: botNumber,
                    to: to
                });
                results.push({ shop: shop.name, status: 'Sent', items: lowStockItems.length });
            } catch (err: any) {
                console.error(`Failed to send alert to ${shop.name}`, err);
                results.push({ shop: shop.name, status: 'Failed', error: err.message });
            }
        } else {
            results.push({ shop: shop.name, status: 'No Alert Needed' });
        }
    }

    return NextResponse.json({ success: true, results });
}
