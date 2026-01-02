'use client';

import { useState } from 'react';
import { updateShopProducts } from '@/app/actions/merchant';

interface Product {
    name: string;
    price: string;
    image: string;
}

interface ProductManagerProps {
    shop: any;
    onUpdate: () => void;
}

export default function ProductManager({ shop, onUpdate }: ProductManagerProps) {
    const [products, setProducts] = useState<Product[]>(shop.products || []);
    const [isSaving, setIsSaving] = useState(false);

    // New Product Form State
    const [newProduct, setNewProduct] = useState<Product>({ name: '', price: '', image: '📦' });
    const [isAdding, setIsAdding] = useState(false);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProduct.name || !newProduct.price) return;

        setIsSaving(true);
        const updatedProducts = [...products, newProduct];

        // Call Server Action
        const result = await updateShopProducts(shop.id, shop.slug, updatedProducts);

        setIsSaving(false);
        if (result.error) {
            console.error(result.error);
            alert('Erreur ajout produit');
        } else {
            setProducts(updatedProducts);
            setNewProduct({ name: '', price: '', image: '📦' });
            setIsAdding(false);
            onUpdate();
        }
    };

    const handleDeleteProduct = async (index: number) => {
        if (!confirm('Voulez-vous supprimer ce produit ?')) return;

        setIsSaving(true);
        const updatedProducts = products.filter((_, i) => i !== index);

        const result = await updateShopProducts(shop.id, shop.slug, updatedProducts);

        setIsSaving(false);
        if (result.error) {
            alert('Erreur suppression');
        } else {
            setProducts(updatedProducts);
            onUpdate();
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800">📦 Mes Produits ({products.length})</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100"
                >
                    {isAdding ? 'Annuler' : '+ Ajouter'}
                </button>
            </div>

            {/* Formulaire d'ajout rapide */}
            {isAdding && (
                <form onSubmit={handleAddProduct} className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                            type="text"
                            placeholder="Nom du produit (ex: Coca)"
                            className="p-2 border rounded-lg"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Prix (ex: 10.00)"
                            className="p-2 border rounded-lg"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
                    >
                        {isSaving ? 'Ajout...' : 'Valider l\'ajout'}
                    </button>
                </form>
            )}

            {/* Liste des produits */}
            <div className="space-y-3">
                {products.length === 0 ? (
                    <p className="text-slate-400 text-center py-4 text-sm">Aucun produit. Ajoutez-en un !</p>
                ) : (
                    products.map((p, i) => (
                        <ProductRow
                            key={i}
                            product={p}
                            index={i}
                            isSaving={isSaving}
                            onDelete={() => handleDeleteProduct(i)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ProductRow({ product, index, isSaving, onDelete }: { product: Product, index: number, isSaving: boolean, onDelete: () => void }) {
    const [showConfirm, setShowConfirm] = useState(false);

    if (showConfirm) {
        return (
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100 animate-in fade-in">
                <span className="font-bold text-red-700 text-sm">Supprimer {product.name} ?</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowConfirm(false)}
                        className="px-3 py-1 bg-white text-slate-600 text-xs font-bold rounded-lg border hover:bg-slate-50"
                        disabled={isSaving}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onDelete}
                        className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                        disabled={isSaving}
                    >
                        {isSaving ? '...' : 'Confirmer'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{product.image || '📦'}</span>
                <div>
                    <div className="font-bold text-slate-800">{product.name}</div>
                    <div className="text-sm text-slate-500">{product.price} DH</div>
                </div>
            </div>
            <button
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                title="Supprimer"
            >
                🗑️
            </button>
        </div>
    );
}
