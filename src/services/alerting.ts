import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const botNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = twilio(accountSid, authToken);

export async function checkAndAlertLowStock(shopId: string, updatedProducts: any[]) {
    try {
        // 1. Get Shop Info (for Phone Number)
        const { data: shop } = await supabaseAdmin
            .from('shops')
            .select('name, phone')
            .eq('id', shopId)
            .single();

        if (!shop || !shop.phone) return;

        // 2. Identify Low Stock Items
        const lowStockItems = updatedProducts.filter((p: any) => {
            const qty = Number(p.quantity) || 0;
            return qty <= 5;
        });

        if (lowStockItems.length === 0) return;

        // 3. Compose Message
        let msg = `🚨 *Alerte Stock Immédiate - ${shop.name}*\n\nDes produits viennent de passer en stock critique :\n`;

        lowStockItems.forEach((p: any) => {
            msg += `- ${p.name} (Reste: ${p.quantity})\n`;
        });

        msg += `\nPensez au réapprovisionnement !`;

        // 4. Send WhatsApp
        let fromNumber = botNumber || "";
        if (!fromNumber.startsWith('whatsapp:')) {
            fromNumber = `whatsapp:${fromNumber}`;
        }

        const to = shop.phone.startsWith('whatsapp:') ? shop.phone : `whatsapp:${shop.phone}`;

        console.log(`[ALERT] Sending from ${fromNumber} to ${to}`);

        await client.messages.create({
            body: msg,
            from: fromNumber,
            to: to
        });

        return { success: true, sentTo: to, items: lowStockItems.length };

    } catch (error: any) {
        console.error("[ALERT] Failed to send real-time alert:", error);
        return { success: false, error: error.message };
    }
}
