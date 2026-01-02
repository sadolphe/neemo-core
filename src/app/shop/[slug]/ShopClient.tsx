'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type Product = {
    name: string;
    price: number | string;
    quantity: number | string;
    image_url?: string;
    category?: string;
};

type Shop = {
    name: string;
    slug: string;
    phone: string;
    coverColor: string;
    products: Product[];
    status: string;
    category: string;
    address: string;
    hours: string;
};

// Helper to get decimal part
function playlistDecimal(price: string | number) {
    const p = Number(price).toFixed(2);
    return p.split('.')[1];
}

export default function ShopClient({ shop }: { shop: any }) {
    const [filter, setFilter] = useState('');
    const [cart, setCart] = useState<{ name: string; price: number; quantity: number }[]>([]);
    const [showCartModal, setShowCartModal] = useState(false);

    const products = shop.products || [];

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(filter.toLowerCase()) &&
            (Number(p.quantity) || 0) > 0 // Only show available items
        );
    }, [products, filter]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(p => p.name === product.name);
            const price = Number(product.price) || 0;
            if (existing) {
                return prev.map(p => p.name === product.name ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { name: product.name, price, quantity: 1 }];
        });
    };

    const removeFromCart = (productName: string) => {
        setCart(prev => {
            const existing = prev.find(p => p.name === productName);
            if (existing && existing.quantity > 1) {
                return prev.map(p => p.name === productName ? { ...p, quantity: p.quantity - 1 } : p);
            }
            return prev.filter(p => p.name !== productName);
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const checkoutUrl = useMemo(() => {
        const cleanPhone = shop.phone.replace('whatsapp:', '').replace('+', '');

        if (cart.length === 0) {
            return `https://wa.me/${cleanPhone}?text=Bonjour ${shop.name}, je voudrais commander...`;
        }

        let msg = `Bonjour ${shop.name}, je voudrais commander :\n`;
        cart.forEach(item => {
            msg += `- ${item.quantity}x ${item.name} (${(item.price * item.quantity).toFixed(2)} DH)\n`;
        });
        msg += `\n*Total: ${cartTotal.toFixed(2)} DH*\nMerci !`;

        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }, [cart, shop.name, shop.phone, cartTotal]);

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 pb-32">

            {/* 1. Hero Showcase (Compact & Functional) */}
            <div className={`h-24 w-full bg-gradient-to-r ${shop.coverColor || 'from-slate-800 to-slate-900'} relative`}>
                {/* Avatar floating */}
                <div className="absolute -bottom-10 left-6">
                    <div className="w-20 h-20 rounded-full bg-white p-1 shadow-md z-10">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-3xl border border-slate-200">
                            🏪
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Shop Info (Below Hero) */}
            <div className="pt-12 px-6 pb-2">
                <h1 className="text-xl font-bold text-slate-900 leading-tight">{shop.name}</h1>
                <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{shop.category}</span>
                    <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Ouvert</span>
                </p>
            </div>

            {/* 3. Address & Hours (Compact) */}
            <div className="px-6 flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-6 mt-2">
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <span>📍</span> {shop.address}
                </div>
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <span>🕒</span> {shop.hours}
                </div>
            </div>

            {/* 3. Slim Search (Compact) */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 py-2 px-4 shadow-sm">
                <div className="relative flex items-center bg-slate-100 rounded-lg px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white border border-transparent focus-within:border-blue-200">
                    <span className="text-slate-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Chercher..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-sm ml-2 placeholder:text-slate-400 text-slate-700 h-full py-0.5"
                    />
                    {filter && (
                        <button onClick={() => setFilter('')} className="text-slate-400 text-xs bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
                    )}
                </div>
            </div>

            {/* 4. Product Grid (High Density 4-Cols) */}
            <div className="px-2 py-3">
                <div className="grid grid-cols-4 gap-2">
                    {filteredProducts.map((product, idx) => {
                        const inCart = cart.find(c => c.name === product.name);
                        return (
                            <div key={idx} className="group bg-white rounded-lg p-1.5 border border-slate-100 shadow-sm relative active:scale-95 transition-transform">
                                <div className="aspect-square bg-slate-50 rounded-lg mb-1 flex items-center justify-center text-xl relative overflow-hidden">
                                    {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : '📦'}

                                    {/* Qty Badge */}
                                    {inCart && (
                                        <div className="absolute top-0.5 right-0.5 bg-green-600 text-white text-[9px] font-bold px-1 rounded-sm shadow-sm ring-1 ring-white">
                                            {inCart.quantity}
                                        </div>
                                    )}
                                </div>

                                <div className="font-semibold text-slate-800 leading-none mb-1 line-clamp-2 text-[10px] h-5 tracking-tight">
                                    {product.name}
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-slate-500 font-bold text-[10px]">
                                        {Math.floor(Number(product.price))}<span className="text-[8px] align-top">.{playlistDecimal(product.price)}</span>
                                    </div>

                                    <button
                                        onClick={() => addToCart(product)}
                                        className={`w-5 h-5 rounded  flex items-center justify-center shadow-sm transition-colors text-[10px] ${inCart ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white'}`}
                                    >
                                        {inCart ? '+' : '+'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="text-center py-10 opacity-50 text-xs">
                        <p>Aucun produit.</p>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Cart (Clearer UX) */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-5">
                    <button
                        onClick={() => setShowCartModal(true)}
                        className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between active:scale-95 transition-transform"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center font-bold text-blue-400">
                                {cartCount}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold">Voir le panier</span>
                                <span className="text-xs text-slate-400">Total: {cartTotal.toFixed(2)} DH</span>
                            </div>
                        </div>
                        <div className="bg-white/10 p-2 rounded-full">
                            <span className="text-xl">👉</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Cart Modal Details */}
            {showCartModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" onClick={() => setShowCartModal(false)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">🛒 Votre Panier</h2>
                            <button onClick={() => setShowCartModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-900">{item.name}</div>
                                        <div className="text-xs text-slate-500">{item.price} DH/unité</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1">
                                        <button onClick={() => removeFromCart(item.name)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md text-slate-600 shadow-sm">-</button>
                                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => addToCart(item as Product)} className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-md text-white shadow-sm">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-slate-500 font-medium">Total à payer</span>
                                <span className="text-3xl font-black text-slate-900">{cartTotal.toFixed(2)} <span className="text-sm text-slate-400">DH</span></span>
                            </div>
                            <Link
                                href={checkoutUrl}
                                target="_blank"
                                onClick={() => setShowCartModal(false)}
                                className="w-full bg-[#25D366] text-slate-900 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-[#1ef06f] transition-all"
                            >
                                Envoyer sur WhatsApp 🚀
                            </Link>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
