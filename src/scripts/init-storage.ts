import { supabaseAdmin } from '../lib/supabase';

async function initStorage() {
    console.log("Initializing 'vision-uploads' bucket...");

    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
        console.error("Error listing buckets:", listError);
        return;
    }

    const exists = buckets.find(b => b.name === 'vision-uploads');

    if (!exists) {
        console.log("Bucket not found. Creating...");
        const { data, error } = await supabaseAdmin.storage.createBucket('vision-uploads', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png'],
            fileSizeLimit: 6000000 // 6MB
        });

        if (error) {
            console.error("Failed to create bucket:", error);
        } else {
            console.log("✅ Bucket 'vision-uploads' created successfully.");
        }
    } else {
        console.log("✅ Bucket 'vision-uploads' already exists.");
    }
}

initStorage();
