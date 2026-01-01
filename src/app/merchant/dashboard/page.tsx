'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function DashboardContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug');
    const [shop, setShop] = useState<any>(null);
    const [shopUrl, setShopUrl] = useState<string>('');

    useEffect(() => {
        if (!slug) return;

        // Construct full URL relative to current domain
        const url = `${window.location.origin}/shop/${slug}`;
        setShopUrl(url);

        // Fetch Shop Name
        async function fetchShop() {
            const { data } = await supabase
                .from('shops')
                .select('name, category')
                .eq('slug', slug)
                .single();
            if (data) setShop(data);
        }
        fetchShop();
    }, [slug]);

    if (!slug) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {shop ? shop.name : 'Mon Magasin'}
                        </h1>
                        <p className="text-slate-500">Dashboard Commerçant</p>
                    </div>
                    <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                        ABONNEMENT ACTIF ✅
                    </div>
                </header>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Carte QR Code */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
                        <h2 className="text-xl font-bold mb-6 text-slate-800">Votre QR Code Unique</h2>

                        <div className="bg-white p-2 border-2 border-slate-900 rounded-lg mb-6">
                            {shopUrl && (
                                <QRCodeSVG
                                    value={shopUrl}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                />
                            )}
                        </div>

                        <p className="text-sm text-slate-500 mb-6 px-4">
                            Imprimez ce code et collez-le sur votre vitrine. Vos clients le scannent pour commander.
                        </p>

                        <button
                            onClick={() => window.print()}
                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors w-full"
                        >
                            🖨️ Imprimer la fiche
                        </button>
                    </div>

                    {/* Carte Actions */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-2">Lien Direct</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={shopUrl}
                                    className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg p-3 w-full"
                                />
                                <button
                                    onClick={() => navigator.clipboard.writeText(shopUrl)}
                                    className="bg-blue-100 text-blue-600 px-4 rounded-lg font-bold hover:bg-blue-200"
                                >
                                    COPIER
                                </button>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-lg text-white">
                            <h3 className="font-bold text-lg mb-2">Voir ma Boutique en ligne</h3>
                            <p className="opacity-90 text-sm mb-4">Vérifiez à quoi ressemble votre vitrine pour vos clients.</p>
                            <Link
                                href={`/shop/${slug}`}
                                target="_blank"
                                className="block text-center bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors"
                            >
                                Ouvrir ma vitrine 🚀
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Chargement du dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
