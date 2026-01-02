'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

import EditShopForm from '@/components/merchant/EditShopForm';
import ProductManager from '@/components/merchant/ProductManager';

function DashboardContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug');
    const [shop, setShop] = useState<any>(null);
    const [shopUrl, setShopUrl] = useState<string>('');
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Hack to force refresh

    useEffect(() => {
        if (!slug) return;

        // Construct full URL relative to current domain
        const url = `${window.location.origin}/shop/${slug}`;
        setShopUrl(url);

        // Fetch Shop Data
        async function fetchShop() {
            const { data } = await supabase
                .from('shops')
                .select('*') // Select ALL fields for editing
                .eq('slug', slug)
                .single();
            if (data) setShop(data);
        }
        fetchShop();
    }, [slug, refreshTrigger]);

    const handleUpdate = () => {
        setRefreshTrigger(prev => prev + 1); // Trigger re-fetch
    };

    if (!slug) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto print:hidden">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            👋 {shop ? shop.name : 'Mon Magasin'}
                        </h1>
                        <p className="text-slate-500">
                            Tableau de Bord Commerçant
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-3">
                        <Link
                            href={`/shop/${slug}`}
                            target="_blank"
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                            Voir ma Vitrine 🚀
                        </Link>
                    </div>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">

                    {/* COLONNE GAUCHE : Gestion Info & Produits */}
                    <div className="lg:col-span-2 space-y-8">
                        {shop && (
                            <>
                                <EditShopForm shop={shop} onUpdate={handleUpdate} />
                                <ProductManager shop={shop} onUpdate={handleUpdate} />
                            </>
                        )}
                    </div>

                    {/* COLONNE DROITE : QR Code & Outils */}
                    <div className="space-y-6">

                        {/* Carte QR Code */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center sticky top-6 z-10">
                            <h2 className="font-bold text-slate-800 mb-4">📢 Votre QR Code</h2>

                            <div className="bg-white p-2 border-2 border-slate-900 rounded-xl mb-4 shadow-sm">
                                {shopUrl && (
                                    <QRCodeSVG
                                        value={shopUrl}
                                        size={180}
                                        level="H"
                                        includeMargin={true}
                                    />
                                )}
                            </div>

                            <p className="text-xs text-slate-400 mb-4">
                                Scannez pour tester ou imprimez pour votre vitrine.
                            </p>

                            <button
                                onClick={() => window.print()}
                                className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex justify-center gap-2 items-center"
                            >
                                🖨️ Imprimer l'affiche
                            </button>

                            <div className="mt-6 w-full pt-6 border-t border-slate-100">
                                <h3 className="text-sm font-bold text-slate-500 mb-2 text-left">LIEN DIRECT</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={shopUrl}
                                        className="bg-slate-100 border-none text-slate-600 text-xs rounded-lg p-3 w-full font-mono"
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(shopUrl)}
                                        className="bg-blue-100 text-blue-600 px-3 rounded-lg font-bold hover:bg-blue-200 text-xs"
                                    >
                                        COPIER
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Carte Inventaire (NEW) */}
                        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-200">
                            <h2 className="font-bold text-lg mb-2">📦 Stock & Factures</h2>
                            <p className="text-slate-400 text-sm mb-4">Gérez votre stock par IA : scannez vos factures ou vos rayons.</p>
                            <Link
                                href={`/merchant/inventory?slug=${slug}`}
                                className="block w-full bg-white text-slate-900 text-center py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                            >
                                Gérer mon Stock ✨
                            </Link>
                        </div>

                        {/* Carte Caisse Express (NEW) */}
                        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-200">
                            <h2 className="font-bold text-lg mb-2">🏪 Caisse Express</h2>
                            <p className="text-slate-400 text-sm mb-4">Encaissez rapidement (Cash ou Crédit).</p>
                            <Link
                                href={`/merchant/pos?slug=${slug}`}
                                className="block w-full bg-white text-slate-900 text-center py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                            >
                                Ouvrir la Caisse 🏧
                            </Link>
                        </div>

                        {/* Carte Karnach (NEW) */}
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg shadow-blue-200">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="font-bold text-lg">📒 Karnach Digital</h2>
                                <span className="text-xs bg-white/20 px-2 py-1 rounded font-bold">Nouveau</span>
                            </div>
                            <p className="text-blue-100 text-sm mb-4">Gérez les crédits, dettes et la monnaie de vos clients.</p>
                            <Link
                                href={`/merchant/karnach?slug=${slug}`}
                                className="block w-full bg-white text-blue-900 text-center py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors"
                            >
                                Ouvrir mon Karnach 📖
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION IMPRESSION (Visible uniquement à l'impression via CSS) */}
            <div id="poster-section" className="hidden print:flex flex-col items-center justify-center min-h-screen text-center p-10 bg-white">
                <div className="border-4 border-slate-900 p-12 rounded-3xl w-full max-w-2xl mx-auto">
                    <h1 className="text-5xl font-black text-slate-900 mb-4">{shop ? shop.name : ''}</h1>
                    <p className="text-2xl text-slate-600 mb-10 font-medium">Consultez les produits & Commandez 👇</p>

                    <div className="bg-white p-4 inline-block rounded-2xl mb-10">
                        {shopUrl && (
                            <QRCodeSVG
                                value={shopUrl}
                                size={400} // Grand format pour l'impression
                                level="H"
                                includeMargin={true}
                            />
                        )}
                    </div>

                    <div className="text-left bg-slate-50 p-6 rounded-2xl mx-auto max-w-lg mb-10">
                        <ol className="list-decimal list-inside text-xl space-y-3 font-medium text-slate-800">
                            <li>Ouvrez l'appareil photo 📷</li>
                            <li>Scannez le QR Code</li>
                            <li>Découvrez notre boutique ! 🛍️</li>
                        </ol>
                    </div>

                    <div className="text-slate-400 font-bold tracking-widest uppercase text-sm">
                        Propulsé par Neemo
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    /* On cache explicitement tous les éléments Next.js par défaut si besoin */
                    nav, footer, header {
                        display: none !important;
                    }
                    
                    /* Le poster prend toute la place */
                    #poster-section {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 9999;
                        background: white;
                    }

                    @page {
                        size: auto;
                        margin: 0mm;
                    }
                    body {
                        background: white;
                    }
                }
            `}</style>
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
