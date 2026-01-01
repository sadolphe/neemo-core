import { supabaseAdmin } from './src/lib/supabase';

async function checkShops() {
    const { data, error } = await supabaseAdmin.from('shops').select('name, phone, slug');
    if (error) {
        console.error('Error fetching shops:', error);
        return;
    }
    console.log('--- SHOPS IN DB ---');
    data?.forEach(s => console.log(`- ${s.name}: ${s.phone} (${s.slug})`));
}

checkShops();
