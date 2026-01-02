'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const phone = formData.get('phone') as string;
        const address = formData.get('address') as string;
        const category = formData.get('category') as string;

        try {
            const res = await fetch('/api/merchant/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, address, category }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            // Redirect to dashboard
            router.push(`/merchant/dashboard?slug=${data.shop.slug}`);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-2">🚀</div>
                    <h1 className="text-2xl font-bold text-slate-800">Lancer ma Boutique</h1>
                    <p className="text-slate-500">Rejoignez Neemo en 30 secondes</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nom du magasin</label>
                        <input
                            name="name"
                            type="text"
                            required
                            placeholder="Ex: Épicerie du Soleil"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Numéro WhatsApp</label>
                        <input
                            name="phone"
                            type="tel"
                            required
                            placeholder="Ex: +212600000000 (International)"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        />
                        <p className="text-xs text-slate-400 mt-1">Format international obligatoire (+33..., +212...).</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                        <select name="category" className="w-full p-3 border border-slate-200 rounded-xl bg-white outline-none text-slate-900 font-medium">
                            <option value="Alimentation">Alimentation</option>
                            <option value="Restaurant">Restaurant / Snack</option>
                            <option value="Mode">Mode / Vêtements</option>
                            <option value="Services">Services</option>
                            <option value="Autre">Autre</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adresse (Ville/Quartier)</label>
                        <input
                            name="address"
                            type="text"
                            placeholder="Ex: Maarif, Casablanca"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isLoading ? 'Création en cours...' : 'Créer ma Boutique ✨'}
                    </button>
                </form>
            </div>

            <div className="mt-8 text-center text-slate-400 text-xs">
                Propulsé par Neemo Core
            </div>
        </div>
    );
}
