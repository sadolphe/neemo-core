-- Enable RLS
alter table storage.objects enable row level security;

-- Policy: Allow Public Read (So GPT-4o can see the image)
create policy "Public Access Vision"
on storage.objects for select
to public
using ( bucket_id = 'vision-uploads' );

-- Policy: Allow Uploads (Anon/Auth for now to simplify MVP)
create policy "Allow Uploads Vision"
on storage.objects for insert
to public
with check ( bucket_id = 'vision-uploads' );
