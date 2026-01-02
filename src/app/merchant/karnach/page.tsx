'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getCustomers, createCustomer, updateCustomerBalance } from '@/app/actions/karnach';

function KarnachContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug');
    const [shopId, setShopId] = useState<string | null>(null);
    const [customers, setCustomers] = useState<any[]>([]);
    const [filter, setFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // Transaction Modal
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [transactionType, setTransactionType] = useState<'DEBT' | 'PAYMENT' | null>(null);
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (slug) {
            const fetchShopAndCustomers = async () => {
                const { data: shop } = await supabase.from('shops').select('id').eq('slug', slug).single();
                if (shop) {
                    setShopId(shop.id);
                    loadCustomers(shop.id);
                }
            };
            fetchShopAndCustomers();
        }
    }, [slug]);

    const loadCustomers = async (id: string) => {
        setIsLoading(true);
        const res = await getCustomers(id);
        if (res.success) setCustomers(res.data || []);
        setIsLoading(false);
    };

    const handleAddCustomer = async () => {
        if (!shopId || !newCustomerName) return;
        const res = await createCustomer(shopId, newCustomerName, newCustomerPhone);
        if (res.success) {
            setShowAddModal(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
            loadCustomers(shopId); // Reload list
        } else {
            alert("Erreur: " + res.error);
        }
    };

    const handleTransaction = async () => {
        if (!shopId || !selectedCustomer || !amount) return;

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) return;

        // Logic: 
        // DEBT (Client prend sans payer) => Balance decreases (becomes more negative)
        // PAYMENT (Client rembourse) => Balance increases (becomes closer to 0 or positive)
        // CREDIT_ADD (Client laisse la monnaie) => Balance increases

        // Wait... plan says:
        // Positif = Crédit (Client a de l'avance, nous doit rien)
        // Négatif = Dette (Client nous doit)

        // Action: "Ajouter Dette" (Le client prend 20dh de crédit) -> Balance - 20
        // Action: "Rembourser" (Le client donne 20dh) -> Balance + 20

        const finalAmount = transactionType === 'DEBT' ? -val : val;
        const type = transactionType === 'DEBT' ? 'SALE' : 'DEBT_PAYMENT';
        // Note: 'SALE' usually implies products, but here strictly debt accumulation.
        // Let's use 'DEBT_ADD' if type allows, or stick to 'SALE' with 0 items?
        // Let's use 'DEBT_PAYMENT' for positive, and maybe just 'CREDIT_USED' for negative?
        // Schema comment says: 'SALE', 'CREDIT_ADD', 'DEBT_PAYMENT'
        // Let's assume 'SALE' (unpaid) is debt. 'DEBT_PAYMENT' is repayment.

        const res = await updateCustomerBalance(shopId, selectedCustomer.id, finalAmount, type === 'SALE' ? 'SALE' : 'DEBT_PAYMENT');

        if (res.success) {
            setTransactionType(null);
            setSelectedCustomer(null);
            setAmount('');
            loadCustomers(shopId);
        } else {
            alert("Erreur: " + res.error);
        }
    };

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    if (!slug) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            <div className="max-w-xl mx-auto">
                <header className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/merchant/dashboard?slug=${slug}`} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50">
                            ⬅️
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">📒 Karnach</h1>
                            <p className="text-slate-500">Gérez les crédits et dettes clients</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 text-white w-12 h-12 rounded-full font-bold text-2xl shadow-lg hover:bg-blue-700 transition"
                    >
                        +
                    </button>
                </header>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 sticky top-4 z-10">
                    <input
                        type="text"
                        placeholder="🔍 Chercher un client..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500 font-medium"
                    />
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-10 text-slate-400">Chargement...</div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">Aucun client trouvé.</div>
                    ) : (
                        filteredCustomers.map(customer => (
                            <div key={customer.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{customer.name}</h3>
                                    <p className="text-xs text-slate-600 font-medium">{customer.phone || 'Pas de numéro'}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={`text-right ${Number(customer.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        <div className="font-bold text-lg">{Number(customer.balance).toFixed(2)} Dh</div>
                                        <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full inline-block">
                                            {Number(customer.balance) < 0 ? 'DOIT' : 'AVANCE'}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setSelectedCustomer(customer); setTransactionType('DEBT'); }}
                                            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 font-bold"
                                        >
                                            - Dette
                                        </button>
                                        <button
                                            onClick={() => { setSelectedCustomer(customer); setTransactionType('PAYMENT'); }}
                                            className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg border border-green-100 hover:bg-green-100 font-bold"
                                        >
                                            + Paye
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ADD CUSTOMER MODAL */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                            <h2 className="text-xl font-bold mb-4">Nouveau Client</h2>
                            <input
                                type="text" placeholder="Nom (ex: Khalti Fatima)"
                                value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-3 mb-3 text-slate-900 placeholder:text-slate-500 font-medium"
                                autoFocus
                            />
                            <input
                                type="tel" placeholder="Téléphone (Optionnel)"
                                value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-3 mb-6 text-slate-900 placeholder:text-slate-500 font-medium"
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Annuler</button>
                                <button onClick={handleAddCustomer} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Créer</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TRANSACTION MODAL */}
                {transactionType && selectedCustomer && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                            <h2 className="text-xl font-bold mb-1 text-slate-900">
                                {transactionType === 'DEBT' ? '🔴 Ajouter une Dette' : '🟢 Encaisser un Paiement'}
                            </h2>
                            <p className="text-slate-500 text-sm mb-6">Pour <span className="text-slate-900 font-bold">{selectedCustomer.name}</span></p>

                            <div className="relative mb-6">
                                <input
                                    type="number" placeholder="0.00"
                                    value={amount} onChange={e => setAmount(e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-2xl p-4 text-center text-3xl font-bold outline-none focus:border-blue-500 text-slate-900 placeholder:text-slate-300"
                                    autoFocus
                                />
                                <span className="absolute right-8 top-6 text-slate-400 font-bold">DH</span>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => { setTransactionType(null); setAmount(''); }} className="flex-1 py-3 text-slate-500 font-bold">Annuler</button>
                                <button
                                    onClick={handleTransaction}
                                    className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg ${transactionType === 'DEBT' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                >
                                    Valider
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default function KarnachPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <KarnachContent />
        </Suspense>
    );
}
