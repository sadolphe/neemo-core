'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { processSale, CartItem } from '@/app/actions/pos';
import { getCustomers } from '@/app/actions/karnach';

function PosContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug');
    const [shop, setShop] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [filter, setFilter] = useState('');

    // Checkout Modals
    const [showPayModal, setShowPayModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState<{ type: 'CASH' | 'KARNACH', amount: number } | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Low Stock Alert State
    const [lowStockItems, setLowStockItems] = useState<any[]>([]); // Items to show in alert

    useEffect(() => {
        if (slug) {
            async function loadData() {
                const { data: s } = await supabase.from('shops').select('*').eq('slug', slug).single();
                if (s) {
                    setShop(s);
                    setProducts(s.products || []);

                    // Preload customers for Karnach payment
                    const cRes = await getCustomers(s.id);
                    if (cRes.success) setCustomers(cRes.data || []);
                }
            }
            loadData();
        }
    }, [slug]);

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.name === product.name);
            if (existing) {
                return prev.map(item => item.name === product.name ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { name: product.name, price: Number(product.price) || 0, quantity: 1 }];
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckout = async (method: 'CASH' | 'KARNACH') => {
        if (!shop) return;
        setIsProcessing(true);

        const currentTotal = cartTotal; // Capture for modal
        const res = await processSale(
            shop.id,
            cart,
            method,
            method === 'KARNACH' ? selectedCustomer : undefined
        );

        setIsProcessing(false);

        if (res.success) {
            // Optimistically update stock
            setProducts(prev => prev.map(p => {
                const soldItem = cart.find(c => c.name === p.name);
                if (soldItem) {
                    return { ...p, quantity: Math.max(0, Number(p.quantity) - soldItem.quantity) };
                }
                return p;
            }));

            setShowPayModal(false);
            setShowSuccessModal({ type: method, amount: currentTotal });
            setCart([]);
            setSelectedCustomer('');


            // Auto-close after 3 seconds
            setTimeout(() => {
                setShowSuccessModal(null);
                // If there are low stock items, they will appear because showSuccessModal becomes null
            }, 2000); // Reduced to 2s for faster flow

            if (res.lowStockItems && res.lowStockItems.length > 0) {
                console.log("⚠️ Low Stock Items Logic:", res.lowStockItems);
                setLowStockItems(res.lowStockItems);
            } else {
                console.log("✅ No Low Stock Items returned");
            }
        } else {
            alert("Erreur: " + res.error);
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

    if (!slug) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="h-screen flex flex-col md:flex-row bg-slate-100 overflow-hidden">

            {/* LEFT: PRODUCT GRID */}
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                <header className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <Link href={`/merchant/dashboard?slug=${slug}`} className="p-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm">
                            ⬅️
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900">🏪 Caisse</h1>
                    </div>
                    <input
                        type="text"
                        placeholder="🔍 Chercher produit..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-white px-4 py-3 rounded-xl border border-slate-200 w-64 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-slate-900 placeholder:text-slate-500 font-medium"
                    />
                </header>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 md:pb-0">
                    {filteredProducts.map((p, idx) => (
                        <button
                            key={idx}
                            onClick={() => addToCart(p)}
                            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all text-left flex flex-col h-32 justify-between active:scale-95"
                        >
                            <span className="font-bold text-slate-800 line-clamp-2 leading-tight">{p.name}</span>
                            <div className="flex justify-between items-end w-full">
                                <span className="text-xs text-slate-400 font-medium">Stock: {Number(p.quantity) || 0}</span>
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{p.price} dh</span>
                            </div>
                        </button>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400">
                            Aucun produit trouvé.
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: CART & CHECKOUT */}
            <div className="w-full md:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-[50vh] md:h-screen fixed bottom-0 md:relative z-20 rounded-t-3xl md:rounded-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 md:bg-white rounded-t-3xl md:rounded-none">
                    <h2 className="font-bold text-xl">🛒 Panier ({cart.length})</h2>
                    <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wide">
                        Vider
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <div className="font-bold text-sm text-slate-900">{item.name}</div>
                                <div className="text-xs text-slate-500">{item.quantity} x {item.price} dh</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900">{(item.quantity * item.price).toFixed(2)}</span>
                                <button onClick={() => removeFromCart(i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                            <span className="text-4xl">🛍️</span>
                            <span className="text-sm">Panier vide</span>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-slate-500 font-medium">Total à payer</span>
                        <span className="text-4xl font-black text-slate-900">{cartTotal.toFixed(2)} <span className="text-lg font-bold text-slate-400">DH</span></span>
                    </div>

                    <button
                        onClick={() => setShowPayModal(true)}
                        disabled={cart.length === 0}
                        className="w-full bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Payer {cartTotal > 0 && `${cartTotal} DH`} 💸
                    </button>
                </div>
            </div>

            {/* PAYMENT MODAL */}
            {showPayModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 shadow-2xl">
                        <h2 className="text-2xl font-black mb-2 text-center text-slate-900">Choix du Paiement</h2>
                        <p className="text-center text-slate-500 mb-8">Total: <span className="font-bold text-slate-900">{cartTotal} DH</span></p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button
                                onClick={() => handleCheckout('CASH')}
                                disabled={isProcessing}
                                className="bg-green-100 hover:bg-green-200 border-2 border-green-200 text-green-700 p-6 rounded-2xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <span className="text-3xl">💵</span>
                                <span className="font-bold">Espèces</span>
                            </button>
                            <button
                                onClick={() => selectedCustomer ? handleCheckout('KARNACH') : document.getElementById('cust-select')?.focus()}
                                disabled={isProcessing || !selectedCustomer}
                                className={`p-6 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedCustomer
                                    ? 'bg-red-100 hover:bg-red-200 border-red-200 text-red-700 cursor-pointer'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                <span className="text-3xl">📒</span>
                                <span className="font-bold">Karnach</span>
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assigner à un client (Pour Karnach)</label>
                            <select
                                id="cust-select"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                            >
                                <option value="">Choisir un client...</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <button onClick={() => setShowPayModal(false)} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600">
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white rounded-3xl p-10 animate-in zoom-in-95 shadow-2xl flex flex-col items-center text-center pointer-events-auto">
                        <div className="text-6xl mb-4 animate-bounce">
                            {showSuccessModal.type === 'CASH' ? '💰' : '📒'}
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">
                            {showSuccessModal.type === 'CASH' ? 'Vente Enregistrée !' : 'Dette Notée !'}
                        </h2>
                        <p className="text-xl text-slate-500 font-bold">
                            {showSuccessModal.amount.toFixed(2)} DH
                        </p>
                    </div>
                </div>
            )}

            {/* LOW STOCK WARNING MODAL */}
            {/* We can show it after success modal closes, OR show it if it exists. 
                Let's use a separate state 'lowStockItems' 
            */}
            {showSuccessModal === null && lowStockItems.length > 0 && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 animate-in zoom-in-95 shadow-2xl max-w-md w-full border-4 border-yellow-400">
                        <div className="text-center mb-6">
                            <div className="text-5xl mb-2">⚠️</div>
                            <h2 className="text-2xl font-black text-slate-900">Stock Critique !</h2>
                            <p className="text-slate-500">Pensez à recommander ces produits :</p>
                        </div>

                        <div className="bg-yellow-50 rounded-xl p-4 mb-6 border border-yellow-200 max-h-60 overflow-y-auto">
                            {lowStockItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center py-2 border-b border-yellow-200 last:border-0">
                                    <span className="font-bold text-slate-800">{item.name}</span>
                                    <span className="bg-white px-2 py-1 rounded text-xs font-bold text-red-600 border border-red-200">
                                        Reste: {Number(item.quantity) || 0}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setLowStockItems([])}
                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 rounded-xl transition-colors"
                        >
                            C'est noté !
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PosPage() {
    return (
        <Suspense fallback={<div>Chargement Caisse...</div>}>
            <PosContent />
        </Suspense>
    );
}
