import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ShopClient from './ShopClient';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    return [];
}

type Props = {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ShopPage(props: Props) {
    const params = await props.params;
    const { slug } = params;

    // Fetch shop data from Supabase
    const { data: shop, error } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error || !shop) {
        console.error('[Neemo] Shop Not Found:', error);
        return notFound();
    }

    return <ShopClient shop={shop} />;
}
