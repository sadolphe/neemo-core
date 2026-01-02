'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { updateCustomerBalance } from './karnach';

export interface CartItem {
    id?: string; // Product ID (if from DB)
    name: string;
    price: number;
    quantity: number;
}

export async function processSale(
    shopId: string,
    items: CartItem[],
    paymentMethod: 'CASH' | 'KARNACH',
    customerId?: string
) {
    if (!shopId || items.length === 0) return { error: "Panier vide ou Shop ID manquant" };

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. Transaction Logic
    if (paymentMethod === 'KARNACH') {
        if (!customerId) return { error: "Client requis pour paiement Karnach" };

        // Use existing Karnach action to update balance + log transaction
        // "Adding Debt" = Negative Amount change (if we follow previous logic: Balance < 0 means debt)
        // Wait, logic in Karnach UI was: 
        // - Debt Button -> updateCustomerBalance(..., -amount, 'SALE')
        // So here we should do the same.

        const res = await updateCustomerBalance(shopId, customerId, -totalAmount, 'SALE', items);
        if (res.error) return { error: res.error };

    } else {
        // CASH PAYMENT
        // Just log the transaction
        const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
                shop_id: shopId,
                total_amount: totalAmount,
                type: 'SALE', // standard sale
                items: items
            });

        if (txError) return { error: "Erreur enregistrement transaction: " + txError.message };
    }

    // 2. Stock Update Logic (Decrease Quantities)
    // This is tricky because products are stored in a JSONB array column 'products' in 'shops' table.
    // We need to fetch current products, update in memory, and save back.
    // Race conditions are possible here but acceptable for MVP.

    const { data: shop, error: fetchError } = await supabaseAdmin
        .from('shops')
        .select('products')
        .eq('id', shopId)
        .single();

    if (fetchError || !shop) return { error: "Shop not found for stock update" };

    const currentProducts: any[] = shop.products || [];
    let stockUpdated = false;

    // Map cart items to product array
    // We match by Name because ID might not be stable or present in JSON
    // Ideally we should have unique IDs. 
    // In `StockReconciliation`, we didn't enforce IDs.
    // In `InventoryPage`, we use array index.
    // Let's match by NAME (Case insensitive) for now.

    const updatedProducts = currentProducts.map(p => {
        const cartItem = items.find(i => i.name.toLowerCase() === p.name.toLowerCase());
        if (cartItem) {
            stockUpdated = true;
            // FIXED: Handle potential non-numeric values safely
            const currentQty = parseFloat(p.quantity);
            const safeCurrentQty = isNaN(currentQty) ? 0 : currentQty;

            const newQty = Math.max(0, safeCurrentQty - cartItem.quantity);
            return { ...p, quantity: newQty };
        }
        return p;
    });

    if (stockUpdated) {
        const { error: updateError } = await supabaseAdmin
            .from('shops')
            .update({ products: updatedProducts })
            .eq('id', shopId);


        if (updateError) console.error("Stock update failed", updateError);
        else {
            const { checkAndAlertLowStock } = await import('@/services/alerting');

            // FIXED Logic: Only alert if we CROSSED the threshold descending (Old > 5 AND New <= 5)
            // This prevents alerts for items that were already low or uninitialized (0/NaN).
            const lowStockItems = updatedProducts.filter(newP => {
                const cartItem = items.find(i => i.name.toLowerCase() === newP.name.toLowerCase());
                if (!cartItem) return false; // Item not touched in this sale

                const oldP = currentProducts.find(cp => cp.name.toLowerCase() === newP.name.toLowerCase());
                const oldQty = parseFloat(oldP?.quantity);
                const newQty = Number(newP.quantity);

                // Smart Check: 
                // 1. Must be numeric (not NaN)
                // 2. Old Quantity MUST have been > 5 (Healthy)
                // 3. New Quantity MUST be <= 5 (Critical)
                const wasHealthy = !isNaN(oldQty) && oldQty > 5;
                const isNowCritical = !isNaN(newQty) && newQty <= 5;

                return wasHealthy && isNowCritical;
            });

            if (lowStockItems.length > 0) {
                checkAndAlertLowStock(shopId, lowStockItems).catch(console.error);
            }

            revalidatePath(`/merchant/pos`);
            revalidatePath(`/merchant/dashboard`);
            revalidatePath(`/merchant/inventory`);

            return { success: true, lowStockItems };
        }
    }

    revalidatePath(`/merchant/pos`);
    revalidatePath(`/merchant/dashboard`);
    revalidatePath(`/merchant/inventory`);

    return { success: true };
}
