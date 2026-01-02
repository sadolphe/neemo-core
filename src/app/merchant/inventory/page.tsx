'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { analyzeInvoice, analyzeShelf, pingServer } from '@/app/actions/vision';
import StockReconciliation from '@/components/merchant/StockReconciliation';
import { supabase } from '@/lib/supabase';

function InventoryContent() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug');
    const [shopId, setShopId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'stock' | 'invoice' | 'shelf'>('stock');

    const [products, setProducts] = useState<any[]>([]); // Products State

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null); // To store OpenAI result
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // New Error State

    const [testResult, setTestResult] = useState<{ status: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (slug) {
            const fetchShop = async () => {
                const { data, error } = await supabase.from('shops').select('id, products').eq('slug', slug).single();
                if (data) {
                    setShopId(data.id);
                    if (Array.isArray(data.products)) {
                        setProducts(data.products);
                    }
                }
            };
            fetchShop();

            const channel = supabase
                .channel('shop_stock_updates')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops', filter: `slug=eq.${slug}` }, (payload) => {
                    const newProducts = payload.new.products;
                    if (Array.isArray(newProducts)) {
                        setProducts(newProducts);
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [slug]);

    // Update Stock Logic
    const handleUpdateStock = async (index: number, change: number) => {
        if (!shopId) return;

        const currentQty = Number(products[index].quantity) || 0;
        const newQty = Math.max(0, currentQty + change);

        // Optimistic Update
        const updatedProducts = [...products];
        updatedProducts[index].quantity = newQty;
        setProducts(updatedProducts);

        // Update DB
        const { error } = await supabase
            .from('shops')
            .update({ products: updatedProducts })
            .eq('id', shopId);

        if (error) console.error("Stock update failed:", error);
    };

    // Delete Product Logic
    const handleDeleteProduct = async (index: number) => {
        if (!confirm("Voulez-vous vraiment supprimer ce produit définitivement ?")) return;
        if (!shopId) return;

        const updatedProducts = products.filter((_, i) => i !== index);
        setProducts(updatedProducts); // Optimistic

        const { error } = await supabase
            .from('shops')
            .update({ products: updatedProducts })
            .eq('id', shopId);

        if (error) console.error("Delete failed", error);
    };

    const testConnection = async () => {
        setTestResult({ status: 'success', message: 'Connexion en cours...' });
        try {
            const res = await pingServer();
            setTestResult({
                status: 'success',
                message: `✅ Connexion OK (${new Date().toLocaleTimeString()})`
            });
        } catch (e: any) {
            setTestResult({
                status: 'error',
                message: `❌ Echec Connexion: ${e.message || 'Erreur inconnue'}`
            });
        }
    };

    // Helper to resize image
    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1000;
                    const MAX_HEIGHT = 1000;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas to Blob failed'));
                    }, 'image/jpeg', 0.6);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setShowSuccess(false);
        setErrorMessage(null);

        try {
            // 1. Resize/Compress (Client Side)
            const resizedBlob = await resizeImage(file);
            const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });

            // 2. Upload to Supabase Storage (Robust)
            const fileName = `${slug}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('vision-uploads')
                .upload(fileName, resizedFile);

            if (uploadError) {
                console.error("Storage Upload Error:", uploadError);
                throw new Error("Echec de l'envoi de l'image (Storage). Réessayez.");
            }

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('vision-uploads')
                .getPublicUrl(fileName);

            console.log("Image uploaded to:", publicUrl);

            // 4. Send URL to Server Action (No Timeout risk)
            const result = await (activeTab === 'shelf' ? analyzeShelf(publicUrl) : analyzeInvoice(publicUrl));
            console.log("Server Action returned:", result);

            setIsAnalyzing(false);

            if (result.success) {
                setAnalysisResult(result.data);
                setShowSuccess(true);
            } else {
                setErrorMessage(result.error || "L'IA n'a pas pu lire l'image.");
            }
        } catch (err: any) {
            console.error("CATCH BLOCK ERROR:", err);
            setIsAnalyzing(false);
            const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setErrorMessage(msg || "Erreur technique. Vérifiez votre connexion.");
        }
    };

    if (!slug) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/merchant/dashboard?slug=${slug}`}
                            className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                        >
                            ⬅️ Retour
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">📦 Inventaire & Stocks</h1>
                            <p className="text-slate-500">Gérez votre stock par IA ou manuellement</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={testConnection}
                            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1 rounded"
                        >
                            📡 Test Server
                        </button>
                        {testResult && (
                            <div className={`text-xs px-2 py-1 rounded font-bold animate-in fade-in transition-all ${testResult.status === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                {testResult.message}
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex bg-white p-1 rounded-xl border border-slate-200 mb-8 w-fit mx-auto md:mx-0 shadow-sm">
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'stock'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        📋 Vue Stock
                    </button>
                    <button
                        onClick={() => setActiveTab('invoice')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'invoice'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-blue-600'
                            }`}
                    >
                        📄 Scan Facture <span className="text-[10px] bg-blue-100/20 px-1.5 py-0.5 rounded uppercase tracking-wide">IA</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shelf')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'shelf'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-purple-600'
                            }`}
                    >
                        📸 Scan Rayon <span className="text-[10px] bg-purple-100/20 px-1.5 py-0.5 rounded uppercase tracking-wide">IA</span>
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] p-8">
                    {activeTab === 'stock' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                <h3 className="font-bold text-lg text-slate-800">🛒 Stock Actuel ({products.length} articles)</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-xs text-slate-400">Synchronisé en temps réel</span>
                                </div>
                            </div>

                            {products.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                                    <div className="text-4xl bg-slate-50 p-4 rounded-full">📭</div>
                                    <p>Votre stock est vide pour le moment.</p>
                                    <button onClick={() => setActiveTab('invoice')} className="text-blue-600 font-bold hover:underline">
                                        Scanner une facture pour commencer
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {products.map((product: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:bg-white hover:shadow-sm transition-all duration-200 group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-xl shadow-sm overflow-hidden">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : '📦'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{product.name}</h4>
                                                    <p className="text-xs text-slate-500 font-medium">{product.price} MAD</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {/* Edit Quantity Controls */}
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={() => handleUpdateStock(idx, -1)}
                                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-l-lg border border-r-0 border-slate-200 transition-colors font-bold text-lg active:scale-95"
                                                    >
                                                        -
                                                    </button>
                                                    <div className="w-16 h-10 flex items-center justify-center font-mono font-bold bg-white border-y border-slate-200 text-lg">
                                                        {product.quantity || 0}
                                                    </div>
                                                    <button
                                                        onClick={() => handleUpdateStock(idx, 1)}
                                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-r-lg border border-l-0 border-slate-200 transition-colors font-bold text-lg active:scale-95"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDeleteProduct(idx)}
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-all hover:border-red-200"
                                                    title="Supprimer définitivement"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'invoice' && (
                        <div className="text-center max-w-md mx-auto py-10">
                            {isAnalyzing ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="text-6xl">🧠</div>
                                    <h2 className="text-xl font-bold text-slate-900">Analyse de la facture en cours...</h2>
                                    <p className="text-slate-500">Neemo lit les lignes, les prix et les quantités.</p>
                                </div>
                            ) : showSuccess && analysisResult ? (
                                <StockReconciliation
                                    slug={slug!}
                                    shopId={shopId || ''}
                                    detectedProducts={analysisResult.products || []}
                                    onCancel={() => setShowSuccess(false)}
                                    onSuccess={() => {
                                        setShowSuccess(false);
                                        setActiveTab('stock');
                                    }}
                                />
                            ) : (
                                <>
                                    {errorMessage && (
                                        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                            ⚠️ {errorMessage}
                                        </div>
                                    )}
                                    <div className="text-6xl mb-6">🧾</div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Scanner une Facture</h2>
                                    <p className="text-slate-500 mb-8">
                                        Prenez en photo une facture manuscrite ou imprimée.
                                        (Format image uniquement pour l&apos;instant).
                                    </p>
                                    <label className="block w-full border-2 border-dashed border-blue-200 bg-blue-50 rounded-2xl p-10 cursor-pointer hover:bg-blue-100 transition-colors">
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        <span className="text-blue-600 font-bold text-lg">📸 Prendre une Photo (JPG/PNG)</span>
                                        <p className="text-sm text-blue-400 mt-2">Le support PDF arrive bientôt</p>
                                    </label>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'shelf' && (
                        <div className="text-center max-w-md mx-auto py-10">
                            {isAnalyzing ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="text-6xl">👁️</div>
                                    <h2 className="text-xl font-bold text-slate-900">Scan du rayon en cours...</h2>
                                    <p className="text-slate-500">Neemo compte les produits et estime le stock.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="text-6xl mb-6">🧴</div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Scanner un Rayon</h2>
                                    <p className="text-slate-500 mb-8">
                                        Prenez en photo une étagère.
                                        Neemo comptera les articles visibles et estimera le stock.
                                    </p>
                                    <label className="block w-full border-2 border-dashed border-purple-200 bg-purple-50 rounded-2xl p-10 cursor-pointer hover:bg-purple-100 transition-colors">
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        <span className="text-purple-600 font-bold text-lg">📸 Prendre photo ou importer</span>
                                        <p className="text-sm text-purple-400 mt-2">JPG, PNG supportés</p>
                                    </label>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <InventoryContent />
        </Suspense>
    );
}
