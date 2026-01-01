import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    return [];
}

// Mock Data pour le prototype
// En production, ça viendra de Supabase : await supabase.from('shops').select('*').eq('slug', params.slug)
import { supabase } from '@/lib/supabase';

// Mock Data pour le prototype (Removed) replaced by Supabase
// ...

type Props = {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Helper pour formater "Il y a X min"
function getRelativeTime(dateString?: string) {
    if (!dateString) return "Récemment";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "À l'instant";
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
    return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
}

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

    // Clean phone number for wa.me link (remove 'whatsapp:' and '+')
    const cleanPhone = shop.phone.replace('whatsapp:', '').replace('+', '');
    const whatsappLink = `https://wa.me/${cleanPhone}?text=Bonjour ${shop.name}, je voudrais commander...`;
    const lastUpdate = getRelativeTime(shop.updated_at);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">

            {/* Hero Cover */}
            <div className={`h-48 w-full bg-gradient-to-r ${shop.coverColor} relative`}>
                <div className="absolute -bottom-10 left-6">
                    {/* Profile Avatar Placeholder */}
                    <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                        <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-3xl">
                            🏪
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-6 pt-12 pb-20">

                {/* Header Info */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{shop.name}</h1>
                        <p className="text-sm text-slate-500 font-medium">{shop.category}</p>
                    </div>
                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${shop.status === 'open' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {shop.status === 'open' ? 'OUVERT 🟢' : 'FERMÉ 🔴'}
                    </div>
                </div>

                {/* Action Bar */}
                <div className="mt-6 flex gap-3">
                    <Link
                        href={whatsappLink}
                        target="_blank"
                        className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        Commander
                    </Link>
                    <button className="bg-white border border-slate-200 text-slate-700 font-semibold p-3 rounded-xl shadow-sm hover:bg-slate-50">
                        📍
                    </button>
                </div>

                {/* Info Cards */}
                <div className="mt-8 space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Horaires</h3>
                        <p className="text-slate-800 font-medium flex items-center gap-2">
                            🕒 {shop.hours}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 italic">
                            Mise à jour par Neemo : {lastUpdate}
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Adresse</h3>
                        <p className="text-slate-800 font-medium">{shop.address}</p>
                    </div>
                </div>

                {/* Featured Products (Mini Vitrine) */}
                {shop.products.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Top Ventes 🔥</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {shop.products.map((p: any, i: number) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                    <div className="text-4xl mb-2">{p.image}</div>
                                    <div className="font-medium text-slate-800 text-sm line-clamp-1">{p.name}</div>
                                    <div className="text-green-600 font-bold text-sm">{p.price} DH</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Branding Footer */}
            <div className="text-center py-6 text-slate-400 text-xs">
                Propulsé par <span className="font-bold text-slate-600">Neemo 🚀</span>
            </div>

        </div>
    );
}
