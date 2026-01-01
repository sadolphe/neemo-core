import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using Service Role for backend admin tasks

if (!supabaseUrl || !supabaseKey) {
    console.warn('[Neemo] Supabase credentials missing. Database features will fail.');
}

// Client Admin pour le Bot (backend side)
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://dummy.supabase.co',
    supabaseKey || 'dummy-key'
);
