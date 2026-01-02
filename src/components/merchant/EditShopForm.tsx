'use client';

import { useState } from 'react';
import { updateShopInfo } from '@/app/actions/merchant';

interface EditShopFormProps {
    shop: any;
    onUpdate: () => void;
}

export default function EditShopForm({ shop, onUpdate }: EditShopFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: shop.name || '',
        description: shop.description || '',
        status: shop.status || 'closed',
        hours: shop.hours || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const result = await updateShopInfo(shop.id, shop.slug, formData);

        setIsLoading(false);

        if (result.error) {
            alert('Erreur: ' + result.error);
        } else {
            alert('✅ Informations mises à jour !');
            onUpdate();
        }
    };

    const toggleStatus = async () => {
        const newStatus = formData.status === 'open' ? 'closed' : 'open';
        setFormData({ ...formData, status: newStatus });

        // Optimistic UI update
        // Then call server action
        await updateShopInfo(shop.id, shop.slug, { ...formData, status: newStatus });
        onUpdate();
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800">🏪 Informations Boutique</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Status Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-medium text-slate-700">Statut Actuel</span>
                    <button
                        type="button"
                        onClick={toggleStatus}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${formData.status === 'open'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                    >
                        {formData.status === 'open' ? '🟢 OUVERT' : '🔴 FERMÉ'}
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la boutique</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Bio)</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-500"
                        placeholder="Ex: Spécialiste des produits frais..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horaires (Texte libre)</label>
                    <input
                        type="text"
                        name="hours"
                        value={formData.hours}
                        onChange={handleChange}
                        className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-500"
                        placeholder="Ex: 8h00 - 20h00, 7j/7"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                </button>
            </form>
        </div>
    );
}
