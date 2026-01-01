import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-');    // Replace multiple - with single -
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, category, address } = body;

        if (!name || !phone) {
            return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
        }

        // Basic Phone Sanitization
        // On attend un format international ex: +2126...
        // On ajoute le préfixe 'whatsapp:' requis par Twilio/Bot
        let formattedPhone = phone.replace(/\s+/g, ''); // enlever espaces
        if (!formattedPhone.startsWith('+')) {
            // Si pas de +, on peut difficilement deviner. On laisse l'utilisateur gérer ou on renvoie une erreur ?
            // Pour le MVP on accepte tel quel, mais on prefixe whatsapp:
        }

        const dbPhone = formattedPhone.startsWith('whatsapp:')
            ? formattedPhone
            : `whatsapp:${formattedPhone}`;

        // Generate Slug
        let baseSlug = slugify(name);
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const slug = `${baseSlug}-${randomSuffix}`;

        const { data, error } = await supabaseAdmin
            .from('shops')
            .insert({
                slug,
                name,
                phone: dbPhone,
                category: category || 'Commerce', // Default category
                address: address || 'Non renseignée',
                products: [], // Empty catalog
                cover_color: 'from-purple-600 to-blue-500' // Default nice gradient
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, shop: data });

    } catch (e: any) {
        console.error('API Create Shop Error:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
