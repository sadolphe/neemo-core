'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateShopInfo(shopId: string, slug: string, data: { name: string, description: string, hours: string, status: string }) {
    console.log(`[ACTION] Updating shop ${shopId}...`);

    // Validation basique
    if (!shopId) return { error: "Shop ID missing" };

    const { error } = await supabaseAdmin
        .from('shops')
        .update({
            name: data.name,
            description: data.description,
            hours: data.hours,
            status: data.status,
            updated_at: new Date().toISOString()
        })
        .eq('id', shopId);

    if (error) {
        console.error("[ACTION ERROR]", error);
        return { error: error.message };
    }

    // On revalide le cache pour que le dashboard et la vitrine se mettent à jour
    revalidatePath(`/merchant/dashboard`);
    revalidatePath(`/shop/${slug}`);

    return { success: true };
}

export async function updateShopProducts(shopId: string, slug: string, products: any[]) {
    console.log(`[ACTION] Updating products for ${shopId}...`);

    const { error } = await supabaseAdmin
        .from('shops')
        .update({
            products: products,
            updated_at: new Date().toISOString()
        })
        .eq('id', shopId);

    if (error) {
        console.error("[ACTION ERROR]", error);
        return { error: error.message };
    }

    revalidatePath(`/merchant/dashboard`);
    revalidatePath(`/shop/${slug}`);

    return { success: true };
}

export async function getUploadParams(fileName: string) {
    console.log(`[ACTION] Generating Signed URL for ${fileName}...`);

    // Create a strict path
    // Note: createSignedUploadUrl creates a URL that allows uploading ONE file to that path.
    const { data, error } = await supabaseAdmin
        .storage
        .from('vision-uploads')
        .createSignedUploadUrl(fileName);

    if (error) {
        console.error("Presign Error:", error);
        return { error: error.message };
    }

    return { success: true, data };
}
