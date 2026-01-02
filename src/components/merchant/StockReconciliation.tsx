'use client';

import { useState } from 'react';
import { updateShopProducts } from '@/app/actions/merchant';
import { supabase } from '@/lib/supabase';

interface Product {
    name: string;
    quantity: number;
    price: string; // This is now Selling Price in our logic
    buying_price?: string; // Captured from Invoice
    _ui_id?: string;
}

interface StockReconciliationProps {
    slug: string;
    shopId: string;
    detectedProducts: Product[];
    onCancel: () => void;
    onSuccess: () => void;
}

export default function StockReconciliation({ slug, shopId, detectedProducts, onCancel, onSuccess }: StockReconciliationProps) {
    // Map initial products. If buying_price is missing (e.g. from existing DB or old scan), default to 0.
    const [products, setProducts] = useState<Product[]>(detectedProducts.map(p => ({
        ...p,
        quantity: Number(p.quantity) || 1,
        buying_price: p.buying_price || "0",
        price: p.price || "0"
    })));
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdateChange = (index: number, field: keyof Product, value: string | number) => {
        const newProducts = [...products];
        newProducts[index] = { ...newProducts[index], [field]: value };
        setProducts(newProducts);
    };

    const handleDelete = (index: number) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    const calculateMargin = (buying: string, selling: string) => {
        const buy = parseFloat(buying.replace(',', '.')) || 0;
        const sell = parseFloat(selling.replace(',', '.')) || 0;
        if (sell === 0) return { percent: 0, alert: 'neutral' };

        const margin = ((sell - buy) / sell) * 100;
        let alert = 'good';
        if (margin < 0) alert = 'critical';
        else if (margin < 20) alert = 'warning';

        return { percent: margin.toFixed(1), alert };
    };

    const handleConfirm = async () => {
        setIsSaving(true);

        try {
            // 1. Fetch current latest stock from DB to avoid overwrites
            const { data: currentShop, error: fetchError } = await supabase
                .from('shops')
                .select('products')
                .eq('id', shopId)
                .single();

            if (fetchError) throw new Error("Impossible de récupérer le stock actuel.");

            const currentProducts: Product[] = Array.isArray(currentShop?.products) ? currentShop.products : [];

            // 2. Smart Merge Logic
            // We create a map of existing products for fast lookup
            const productMap = new Map<string, Product>();
            currentProducts.forEach(p => productMap.set(p.name.toLowerCase().trim(), p));

            // We process the new validated products
            products.forEach(newP => {
                const key = newP.name.toLowerCase().trim();
                const existing = productMap.get(key);

                if (existing) {
                    // MERGE: Update quantity and prices
                    // Logic: Quantity ADDS up (Scan finding) or Replaces? 
                    // For "Invoice Scan" (Receipt), it usually means NEW stock arriving -> ADD.
                    // For "Shelf Scan" (Audit), it usually means CURRENT stock visible -> REPLACE or ADJUST?
                    // Let's assume ADDITION for Safety for now, or maybe we should simply use the new detected quantity if it's an audit.
                    // Given the ambiguity, we'll ADD quantities for now as it's safer for "Restock" scenarios.

                    productMap.set(key, {
                        ...existing,
                        quantity: Number(existing.quantity || 0) + Number(newP.quantity || 0),
                        buying_price: newP.buying_price !== "0" ? newP.buying_price : existing.buying_price,
                        price: newP.price !== "0" ? newP.price : existing.price
                    });
                } else {
                    // NEW: Add to map
                    productMap.set(key, newP);
                }
            });

            // Convert back to array
            const mergedProducts = Array.from(productMap.values());

            // 3. Save
            const result = await updateShopProducts(shopId, slug, mergedProducts);

            setIsSaving(false);
            if (result.success) {
                alert("Stock mis à jour avec succès ! (Fusionné)");
                onSuccess();
            } else {
                alert("Erreur lors de la mise à jour: " + result.error);
            }
        } catch (err: any) {
            setIsSaving(false);
            alert("Erreur technique: " + err.message);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">🧐 Vérification & Marges</h2>
                    <p className="text-slate-400 text-sm">Vérifiez vos prix d'achat et définissez vos prix de vente.</p>
                </div>
                <div className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                    {products.length} Articles détectés
                </div>
            </div>

            <div className="p-0 overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 bg-white z-10">
                        <tr>
                            <th className="p-4 w-1/3">Produit</th>
                            <th className="p-4 w-20 text-center">Qté</th>
                            <th className="p-4 w-24 text-center bg-orange-50/50">Prix Achat</th>
                            <th className="p-4 w-24 text-center bg-green-50/50">Prix Vente</th>
                            <th className="p-4 w-24 text-center">Marge</th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((product, index) => {
                            const margin = calculateMargin(product.buying_price || "0", product.price);
                            return (
                                <tr key={index} className="hover:bg-slate-50 group transition-colors">
                                    <td className="p-4 px-2 md:px-4">
                                        <input
                                            type="text"
                                            value={product.name}
                                            onChange={(e) => handleUpdateChange(index, 'name', e.target.value)}
                                            className="w-full bg-transparent font-bold text-slate-900 border-none focus:ring-0 p-0 placeholder-slate-400"
                                            placeholder="Nom du produit"
                                        />
                                    </td>
                                    <td className="p-4 px-1">
                                        <input
                                            type="number"
                                            value={product.quantity}
                                            onChange={(e) => handleUpdateChange(index, 'quantity', Number(e.target.value))}
                                            className="w-full bg-slate-100 rounded px-2 py-1 font-mono text-center focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </td>
                                    {/* Buying Price Input */}
                                    <td className="p-4 px-1 bg-orange-50/30">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={product.buying_price}
                                                onChange={(e) => handleUpdateChange(index, 'buying_price', e.target.value)}
                                                className="w-full bg-orange-100/50 rounded px-2 py-1 font-mono text-center focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none pl-1"
                                                placeholder="0"
                                            />
                                        </div>
                                    </td>
                                    {/* Selling Price Input */}
                                    <td className="p-4 px-1 bg-green-50/30">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={product.price}
                                                onChange={(e) => handleUpdateChange(index, 'price', e.target.value)}
                                                className="w-full bg-green-100/50 rounded px-2 py-1 font-mono text-center text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-green-500 outline-none pl-1"
                                                placeholder="0"
                                            />
                                        </div>
                                    </td>
                                    {/* Margin Release */}
                                    <td className="p-4 px-1 text-center">
                                        <div className={`text-xs font-bold px-2 py-1 rounded-full border ${margin.alert === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                                            margin.alert === 'warning' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                'bg-green-100 text-green-700 border-green-200'
                                            }`}>
                                            {margin.percent}%
                                        </div>
                                        {margin.alert === 'warning' && (
                                            <div className="text-[10px] text-yellow-600 mt-1">
                                                ⚠️ Marge faible
                                            </div>
                                        )}
                                        {margin.alert === 'critical' && (
                                            <div className="text-[10px] text-red-600 mt-1">
                                                🚨 Perte !
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleDelete(index)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                            title="Supprimer la ligne"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {products.length === 0 && (
                    <div className="p-10 text-center text-slate-400 italic">
                        Aucun produit détecté. Essayez de scanner à nouveau.
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 z-20">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                    Annuler
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={isSaving || products.length === 0}
                    className="px-8 py-2.5 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                >
                    {isSaving ? (
                        <>
                            <span className="animate-spin">⏳</span> Enregistrement...
                        </>
                    ) : (
                        <>
                            ✅ Valider & Ajouter au Stock
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
