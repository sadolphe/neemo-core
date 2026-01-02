'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// --- CUSTOMERS ---

export async function getCustomers(shopId: string) {
    if (!shopId) return { error: "Shop ID missing" };

    const { data, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching customers:", error);
        return { error: error.message };
    }

    return { success: true, data };
}

export async function createCustomer(shopId: string, name: string, phone?: string) {
    if (!shopId || !name) return { error: "Missing required fields" };

    const { data, error } = await supabaseAdmin
        .from('customers')
        .insert({
            shop_id: shopId,
            name,
            phone,
            balance: 0
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating customer:", error);
        return { error: error.message };
    }

    revalidatePath(`/merchant/karnach`);
    return { success: true, data };
}

// --- TRANSACTIONS & BALANCE ---

export async function updateCustomerBalance(
    shopId: string,
    customerId: string,
    amount: number, // Positive for Credit, Negative for Debt/Payment
    type: 'SALE' | 'CREDIT_ADD' | 'DEBT_PAYMENT',
    items?: any[]
) {
    if (!shopId || !customerId) return { error: "Missing ID" };

    // 1. Get current balance
    const { data: customer, error: fetchError } = await supabaseAdmin
        .from('customers')
        .select('balance')
        .eq('id', customerId)
        .single();

    if (fetchError || !customer) return { error: "Customer not found" };

    const newBalance = Number(customer.balance) + Number(amount);

    // 2. Update Customer Balance
    const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', customerId);

    if (updateError) return { error: "Failed to update balance" };

    // 3. Log Transaction
    const { error: logError } = await supabaseAdmin
        .from('transactions')
        .insert({
            shop_id: shopId,
            customer_id: customerId,
            total_amount: Math.abs(amount), // Log absolute value
            type: type,
            items: items || null
        });

    if (logError) console.error("Transaction log failed (Balance updated though)", logError);

    revalidatePath(`/merchant/karnach`);
    return { success: true, newBalance };
}

export async function findOrCreateCustomer(shopId: string, name: string) {
    if (!shopId || !name) return { error: "Missing required fields" };

    // 1. Try to find existing customer (Case insensitive)
    const { data: existing, error: findError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .ilike('name', name)
        .maybeSingle();

    if (existing) {
        return { success: true, data: existing };
    }

    // 2. Create if not found
    // If name is very short or generic, maybe append (WhatsApp)? 
    // For now, let's keep it clean.
    return await createCustomer(shopId, name);
}
