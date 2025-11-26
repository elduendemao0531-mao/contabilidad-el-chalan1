import miLogo from './milogo.png';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { 
  LucidePackage, LucideDollarSign, LucideBarChart3, LucidePlus, 
  LucideCoins, LucideArrowDown, LucideArrowUp, LucideScale, 
  LucideArrowLeftRight, LucideListChecks, LucideDownload, 
  LucideSearch, LucideLayoutDashboard, LucideWifiOff
} from 'lucide-react';

// --- TU CONFIGURACIÓN ORIGINAL DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCrTZ7HBx_b-f-wLmsynEdV2f8jwrqwZAg",
  authDomain: "billares-el-chalan.firebaseapp.com",
  projectId: "billares-el-chalan",
  storageBucket: "billares-el-chalan.firebasestorage.app",
  messagingSenderId: "878650764638",
  appId: "1:878650764638:web:312e798ba952d87703f3cf"
};

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- RUTA CENTRALIZADA (Persistencia de datos) ---
const MAIN_DATA_PATH = "billares_data/sede_principal"; 

// --- UTILIDAD PARA EXPORTAR A CSV ---
const exportToCSV = (data, headers, filename) => {
    if (!data || !data.length) return;
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(fieldName => {
                let value = row[fieldName] !== undefined ? row[fieldName] : '';
                if (typeof value === 'string') value = `"${value.replace(/"/g, '""')}"`;
                return value;
            }).join(',')
        )
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const App = () => {
    const [view, setView] = useState('cash_input');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [globalMsg, setGlobalMsg] = useState({ text: '', type: '' });
    
    // Datos
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]); 
    const [dailyCashInputs, setDailyCashInputs] = useState([]); 
    const [transactions, setTransactions] = useState([]); 
    const [cutsHistory, setCutsHistory] = useState([]); 
    const [stockInflows, setStockInflows] = useState([]); 

    const [selectedCut, setSelectedCut] = useState(null);

    // Helpers
    const showMessage = (text, type = 'success') => {
        setGlobalMsg({ text, type });
        setTimeout(() => setGlobalMsg({ text: '', type: '' }), 5000);
    };

    const handleError = (e, context = 'guardar') => {
        console.error(`Error al ${context}:`, e);
        let msg = `Error al ${context}.`;
        if (e.code === 'permission-denied') msg = 'Error de Permisos: Revisa las Reglas en Firebase Console.';
        else if (e.code === 'unavailable') msg = 'Sin conexión a internet.';
        else if (e.message) msg = `Error: ${e.message}`;
        setGlobalMsg({ text: msg, type: 'error' });
        // Auto-limpiar error después de 7 segundos
        setTimeout(() => setGlobalMsg({ text: '', type: '' }), 7000);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
    
    const formatDateShort = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        return timestamp.toDate().toLocaleDateString('es-CO', { year: 'numeric', month: 'numeric', day: 'numeric' });
    };

    const isCodeUnique = useCallback((code, excludeId = null) => {
        return !products.some(p => p.code === code && p.id !== excludeId);
    }, [products]);

    // --- 1. Autenticación ---
    useEffect(() => {
        signInAnonymously(auth).catch((error) => handleError(error, 'conectar servidor'));
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    // --- 2. Carga de Datos ---
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        
        const errorHandler = (err) => console.error("Error en lectura:", err);

        const unsubscribes = [
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'inventory')), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data(), cost: Number(d.data().cost||0), price: Number(d.data().price||0), stock: Number(d.data().stock||0) }))), errorHandler),
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'sales')), s => setSales(s.docs.map(d => ({ id: d.id, ...d.data(), quantity: Number(d.data().quantity||0), amount: Number(d.data().amount||0), cogs: Number(d.data().cogs||0) }))), errorHandler),
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'daily_cash_inputs')), s => setDailyCashInputs(s.docs.map(d => ({ id: d.id, ...d.data(), totalCashCollected: Number(d.data().totalCashCollected||0), tiempoValue: Number(d.data().tiempoValue||0), productSalesCash: Number(d.data().productSalesCash||0) })).sort((a,b)=>b.date-a.date)), errorHandler),
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'transactions')), s => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data(), amount: Number(d.data().amount||0) }))), errorHandler),
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'cuts_history')), s => setCutsHistory(s.docs.map(d => ({ id: d.id, ...d.data() }))), errorHandler),
            onSnapshot(query(collection(db, MAIN_DATA_PATH, 'stock_inflows')), s => setStockInflows(s.docs.map(d => ({ id: d.id, ...d.data(), quantity: Number(d.data().quantity||0) }))), errorHandler)
        ];
        
        setLoading(false);
        return () => unsubscribes.forEach(u => u());
    }, [user]);

    // --- VISTAS ---

    const InventoryView = () => {
        const [isAdding, setIsAdding] = useState(false);
        const [editingProduct, setEditingProduct] = useState(null);
        
        const handleSaveProduct = async (data) => {
            const { name, code, cost, price, stock, id } = data;
            if (!name || !code || isNaN(Number(cost)) || isNaN(Number(price)) || isNaN(Number(stock))) {
                handleError({ message: 'Completa todos los campos.' }, 'validar formulario'); return;
            }
            if (!isCodeUnique(code, id)) {
                handleError({ message: 'El código ya existe.' }, 'validar código'); return;
            }

            try {
                const productData = { 
                    name: name.trim(), code: code.trim(), 
                    cost: Number(cost), price: Number(price), stock: Number(stock),
                    updatedBy: user.uid, updatedAt: Timestamp.now()
                };
                
                if (id) {
                    await updateDoc(doc(db, MAIN_DATA_PATH, 'inventory', id), productData);
                    showMessage(`Producto actualizado.`); setEditingProduct(null);
                } else {
                    await addDoc(collection(db, MAIN_DATA_PATH, 'inventory'), { ...productData, createdAt: Timestamp.now() });
                    showMessage(`Producto agregado.`); setIsAdding(false);
                }
            } catch (e) { handleError(e, 'guardar producto'); }
        };

        const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + (p.stock * p.cost), 0), [products]);

        const ProductForm = ({ initialData, onSave, onCancel }) => {
            const [form, setForm] = useState({ 
                name: initialData?.name||'', code: initialData?.code||'', 
                cost: initialData?.cost||'', price: initialData?.price||'', stock: initialData?.stock||'' 
            });
            return (
                <div className="bg-white p-4 rounded-xl shadow-lg space-y-3 border-2 border-indigo-200 animate-fade-in">
                    <h3 className="font-bold text-lg">{initialData ? 'Editar' : 'Nuevo'} Producto</h3>
                    <input className="w-full p-2 border rounded" placeholder="Nombre" value={form.name} onChange={e=>setForm({...form, name: e.target.value})}/>
                    <input className="w-full p-2 border rounded" placeholder="Código" value={form.code} onChange={e=>setForm({...form, code: e.target.value})} disabled={!!initialData}/>
                    <div className="grid grid-cols-2 gap-2">
                        <input className="w-full p-2 border rounded" type="number" placeholder="Costo" value={form.cost} onChange={e=>setForm({...form, cost: e.target.value})}/>
                        <input className="w-full p-2 border rounded" type="number" placeholder="Precio" value={form.price} onChange={e=>setForm({...form, price: e.target.value})}/>
                    </div>
                    <input className="w-full p-2 border rounded" type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({...form, stock: e.target.value})}/>
                    <div className="flex gap-2">
                        <button onClick={()=>onSave({...form, id: initialData?.id})} className="flex-1 bg-green-600 text-white py-2 rounded">Guardar</button>
                        <button onClick={onCancel} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                    </div>
                </div>
            );
        };

        return (
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucidePackage className="mr-2 h-5 w-5" /> Inventario</h2>
                    <button onClick={() => {
                        const data = products.map(p => ({ Nombre: p.name, Codigo: p.code, Costo: p.cost, Precio: p.price, Stock: p.stock }));
                        exportToCSV(data, ['Nombre', 'Codigo', 'Costo', 'Precio', 'Stock'], 'Inventario');
                    }} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center font-bold border border-green-200">
                        <LucideDownload className="h-3 w-3 mr-1"/> Excel
                    </button>
                </div>
                
                <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-semibold text-indigo-500">Valor Total (Costo)</p>
                        <p className="text-xl font-extrabold text-indigo-900">{formatCurrency(totalStockValue)}</p>
                    </div>
                    <p className="text-xs text-gray-400">{products.length} Refs.</p>
                </div>

                {(editingProduct || isAdding) ? 
                    <ProductForm initialData={editingProduct} onSave={handleSaveProduct} onCancel={() => { setEditingProduct(null); setIsAdding(false); }} /> 
                    : 
                    <button onClick={() => setIsAdding(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow flex justify-center items-center">
                        <LucidePlus className="mr-2 h-5 w-5" /> Agregar Producto
                    </button>
                }

                <div className="space-y-2 mt-4 pb-20">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-xl shadow-sm border-l-4 flex justify-between items-center" style={{borderColor: p.stock<=5?'#ef4444':'#22c55e'}}>
                            <div>
                                <p className="font-bold text-gray-800">{p.name}</p>
                                <p className="text-xs text-gray-500">COD: {p.code} | Costo: {formatCurrency(p.cost)}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold">{p.stock} unid.</p>
                                <button onClick={()=>setEditingProduct(p)} className="text-indigo-500 text-xs mt-1 underline">Editar</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const StockInflowView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [prodId, setProdId] = useState('');
        const [qty, setQty] = useState('');
        
        const handleIn = async () => {
            if(!prodId || !qty || qty<=0) return;
            const p = products.find(x=>x.id===prodId);
            try {
                await addDoc(collection(db, MAIN_DATA_PATH, 'stock_inflows'), {
                    productId: prodId, productName: p.name, quantity: Number(qty), date: Timestamp.fromDate(new Date(date)), registeredAt: Timestamp.now(), userId: user.uid
                });
                await updateDoc(doc(db, MAIN_DATA_PATH, 'inventory', prodId), { stock: p.stock + Number(qty) });
                showMessage(`Ingreso registrado: ${qty} x ${p.name}`); setQty('');
            } catch(e){ handleError(e, 'registrar entrada'); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideArrowUp className="mr-2" /> Ingreso Stock</h2>
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
                    <select value={prodId} onChange={e=>setProdId(e.target.value)} className="w-full p-2 border rounded">
                        <option value="">Seleccionar Producto...</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                    </select>
                    <input type="number" placeholder="Cantidad" value={qty} onChange={e=>setQty(e.target.value)} className="w-full p-2 border rounded"/>
                    <button onClick={handleIn} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Registrar Entrada</button>
                </div>
            </div>
        );
    };

    const StockOutflowView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [prodId, setProdId] = useState('');
        const [endStock, setEndStock] = useState('');
        
        const p = products.find(x=>x.id===prodId);
        const sold = p && endStock!=='' ? p.stock - Number(endStock) : 0;
        const rev = p && sold>0 ? sold*p.price : 0;

        const handleOut = async () => {
            if(!prodId || endStock==='') return;
            if(Number(endStock) > p.stock) { handleError({message: 'Stock final mayor al inicial'}, 'validar stock'); return; }
            try {
                if(sold > 0) {
                    await addDoc(collection(db, MAIN_DATA_PATH, 'sales'), {
                        productId: prodId, productName: p.name, quantity: sold, unitPrice: p.price, unitCost: p.cost,
                        amount: rev, cogs: sold*p.cost, date: Timestamp.fromDate(new Date(date)), registeredAt: Timestamp.now(), userId: user.uid
                    });
                }
                await updateDoc(doc(db, MAIN_DATA_PATH, 'inventory', prodId), { stock: Number(endStock) });
                showMessage(`Egreso registrado. Vendidos: ${sold}`); setEndStock('');
            } catch(e){ handleError(e, 'registrar salida'); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideArrowLeftRight className="mr-2" /> Egreso Stock (Conteo)</h2>
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
                    <select value={prodId} onChange={e=>{setProdId(e.target.value); setEndStock('');}} className="w-full p-2 border rounded">
                        <option value="">Seleccionar Producto...</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} (Inicial: {p.stock})</option>)}
                    </select>
                    {p && (
                        <>
                            <input type="number" placeholder="Stock Final Contado" value={endStock} onChange={e=>setEndStock(e.target.value)} className="w-full p-2 border rounded"/>
                            <div className="text-sm bg-gray-50 p-2 rounded">
                                <p>Vendidos Calc: <strong>{sold > 0 ? sold : 0}</strong></p>
                                <p>Venta Neta: <strong>{formatCurrency(rev)}</strong></p>
                            </div>
                        </>
                    )}
                    <button onClick={handleOut} disabled={!prodId || endStock===''} className="w-full bg-red-600 text-white py-2 rounded font-bold disabled:opacity-50">Confirmar Conteo</button>
                </div>
            </div>
        );
    };

    const CashInputView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [cash, setCash] = useState('');
        const [timeVal, setTimeVal] = useState('');

        const handleSave = async () => {
            if(!date || !cash || !timeVal) return;
            if(dailyCashInputs.some(d=>formatDateShort(d.date) === formatDateShort(Timestamp.fromDate(new Date(date))))) {
                handleError({message: 'Ya existe registro para esta fecha.'}, 'validar fecha'); return;
            }
            try {
                await addDoc(collection(db, MAIN_DATA_PATH, 'daily_cash_inputs'), {
                    date: Timestamp.fromDate(new Date(date)), totalCashCollected: Number(cash), tiempoValue: Number(timeVal),
                    productSalesCash: Number(cash)-Number(timeVal), savedAt: Timestamp.now(), userId: user.uid
                });
                showMessage('Caja guardada correctamente.'); setCash(''); setTimeVal('');
            } catch(e){ handleError(e, 'guardar caja'); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideCoins className="mr-2" /> Registro Efectivo</h2>
                <div className="bg-white p-4 rounded-xl shadow space-y-3 border-2 border-green-200">
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
                    <input type="number" placeholder="Dinero Físico Total" value={cash} onChange={e=>setCash(e.target.value)} className="w-full p-2 border rounded"/>
                    <input type="number" placeholder="Valor 'Tiempo'" value={timeVal} onChange={e=>setTimeVal(e.target.value)} className="w-full p-2 border rounded"/>
                    <p className="text-sm font-bold text-right text-gray-700">Prod. Físico: {formatCurrency(Number(cash)-Number(timeVal))}</p>
                    <button onClick={handleSave} className="w-full bg-green-600 text-white py-2 rounded font-bold">Guardar Caja</button>
                </div>
                <div className="space-y-1 pb-16">
                    <h3 className="font-bold text-sm text-gray-600">Historial Reciente</h3>
                    {dailyCashInputs.slice(0,3).map(d=><div key={d.id} className="bg-white p-2 rounded text-sm border flex justify-between"><span>{formatDateShort(d.date)}</span><span>T: {formatCurrency(d.totalCashCollected)}</span></div>)}
                </div>
            </div>
        );
    };

    const TransactionsView = () => {
        const [type, setType] = useState('Expense');
        const [desc, setDesc] = useState('');
        const [amt, setAmt] = useState('');
        
        const handleSave = async () => {
            if(!desc || !amt) return;
            try {
                await addDoc(collection(db, MAIN_DATA_PATH, 'transactions'), {
                    type, description: desc, amount: Number(amt), date: Timestamp.now(), userId: user.uid
                });
                showMessage('Transacción guardada.'); setDesc(''); setAmt('');
            } catch (e) { handleError(e, 'guardar transacción'); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideDollarSign className="mr-2" /> Gastos / Otros</h2>
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <select value={type} onChange={e=>setType(e.target.value)} className="w-full p-2 border rounded">
                        <option value="Expense">Gasto</option><option value="Income">Otro Ingreso (Máquinas)</option>
                    </select>
                    <input className="w-full p-2 border rounded" placeholder="Descripción" value={desc} onChange={e=>setDesc(e.target.value)}/>
                    <input className="w-full p-2 border rounded" type="number" placeholder="Monto" value={amt} onChange={e=>setAmt(e.target.value)}/>
                    <button onClick={handleSave} className={`w-full text-white py-2 rounded font-bold ${type==='Expense'?'bg-red-500':'bg-green-500'}`}>Guardar</button>
                </div>
            </div>
        );
    };

    const CutDetailView = () => {
        if (!selectedCut) return <div className="p-4">No hay corte seleccionado.</div>;
        const breakdown = selectedCut.productBreakdown || [];

        return (
            <div className="p-4 pb-24">
                <button onClick={() => setView('pl_report')} className="mb-4 text-indigo-600 font-bold flex items-center">
                    &larr; Volver a Reportes
                </button>
                
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideListChecks className="mr-2" /> Detalle de Corte</h2>
                        <p className="text-sm text-gray-500">{formatDateShort(selectedCut.startDate)} - {formatDateShort(selectedCut.endDate)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50 text-indigo-900 font-bold">
                                <tr>
                                    <th className="p-2">Prod</th>
                                    <th className="p-2 text-center">In</th>
                                    <th className="p-2 text-center">Out</th>
                                    <th className="p-2 text-right">$$</th>
                                    <th className="p-2 text-center">Stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {breakdown.length === 0 ? (
                                    <tr><td colSpan="5" className="p-4 text-center text-gray-500">Sin detalles.</td></tr>
                                ) : (
                                    breakdown.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-2 font-medium text-gray-800 text-xs">{item.name}</td>
                                            <td className="p-2 text-center text-blue-600">{item.inflows > 0 ? `+${item.inflows}` : '-'}</td>
                                            <td className="p-2 text-center text-red-600 font-bold">{item.sold > 0 ? item.sold : '-'}</td>
                                            <td className="p-2 text-right text-xs">{formatCurrency(item.revenue)}</td>
                                            <td className="p-2 text-center text-gray-500">{item.stockAtCut}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-2">
                    <p className="font-bold text-gray-700 mb-2">Resumen General</p>
                    <div className="flex justify-between"><span>Venta Prod:</span> <span className="font-bold">{formatCurrency(selectedCut.totalRevenueProduct)}</span></div>
                    <div className="flex justify-between"><span>Tiempo:</span> <span className="font-bold">{formatCurrency(selectedCut.totalTiempo)}</span></div>
                    <div className="flex justify-between"><span>Gastos:</span> <span className="font-bold text-red-500">-{formatCurrency(selectedCut.totalExpenses)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-gray-300"><span>Ganancia Neta:</span> <span className="font-bold text-indigo-700">{formatCurrency(selectedCut.actualNominaPaid ? (selectedCut.totalRevenueProduct - selectedCut.totalCogs + selectedCut.totalOtherIncome + (selectedCut.totalTiempo||0) - selectedCut.totalExpenses - selectedCut.actualNominaPaid) : 0)}</span></div>
                </div>
            </div>
        );
    };

    const ReportsView = () => {
        const today = new Date().toISOString().split('T')[0];
        const [startDate, setStartDate] = useState(today);
        const [endDate, setEndDate] = useState(today);
        const [isSavingCut, setIsSavingCut] = useState(false);
        const [finalNominaInput, setFinalNominaInput] = useState('');

        const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
        const endTimestamp = endDate ? Timestamp.fromDate(new Date(new Date(endDate).setHours(23, 59, 59))) : null;

        const reportMetrics = useMemo(() => {
            if (!startTimestamp || !endTimestamp) return {};
            const fSales = sales.filter(s => s.date.toMillis() >= startTimestamp.toMillis() && s.date.toMillis() <= endTimestamp.toMillis());
            const fCash = dailyCashInputs.filter(c => c.date.toMillis() >= startTimestamp.toMillis() && c.date.toMillis() <= endTimestamp.toMillis());
            const fTrans = transactions.filter(t => t.date.toMillis() >= startTimestamp.toMillis() && t.date.toMillis() <= endTimestamp.toMillis());
            const fInflows = stockInflows.filter(i => i.date.toMillis() >= startTimestamp.toMillis() && i.date.toMillis() <= endTimestamp.toMillis());

            const totalRevenueProduct = fSales.reduce((sum, s) => sum + s.amount, 0);
            const totalCogs = fSales.reduce((sum, s) => sum + s.cogs, 0);
            const totalTiempo = fCash.reduce((sum, c) => sum + c.tiempoValue, 0);
            const totalPhysicalProductCash = fCash.reduce((sum, c) => sum + c.productSalesCash, 0);
            const diff = totalPhysicalProductCash - totalRevenueProduct;
            const suggestedNomina = totalTiempo + (totalRevenueProduct * 0.03);
            const otherIncome = fTrans.filter(t => t.type === 'Income').reduce((sum, e) => sum + e.amount, 0);
            const expenses = fTrans.filter(t => t.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);

            const breakdown = products.map(prod => {
                const pSales = fSales.filter(s => s.productId === prod.id);
                const pInflows = fInflows.filter(i => i.productId === prod.id);
                const soldQty = pSales.reduce((sum, s) => sum + s.quantity, 0);
                const revenue = pSales.reduce((sum, s) => sum + s.amount, 0);
                return {
                    id: prod.id, name: prod.name, stockAtCut: prod.stock, inflows: pInflows.reduce((sum, i) => sum + i.quantity, 0),
                    sold: soldQty, revenue: revenue, profit: revenue - pSales.reduce((sum, s) => sum + s.cogs, 0)
                };
            }).filter(p => p.sold > 0 || p.inflows > 0);

            return {
                totalRevenueProduct, totalCogs, totalPhysicalProductCash, diff, suggestedNomina, totalTiempo, otherIncome, expenses,
                dailyCashCount: fCash.length, productBreakdown: breakdown
            };
        }, [sales, dailyCashInputs, transactions, stockInflows, products, startDate, endDate]);

        const handleSaveCut = async () => {
            const m = reportMetrics;
            if (!m.dailyCashCount || !finalNominaInput) { handleError({message: 'Revisa fechas y nómina'}, 'validar corte'); return; }

            let cashAdjustment = m.diff < 0 ? Math.abs(m.diff) : 0;
            const actualNominaPaid = Number(finalNominaInput) - cashAdjustment;

            const cutData = {
                startDate: startTimestamp, endDate: endTimestamp, cutDate: Timestamp.now(), userId: user.uid,
                reconciliationDifference: m.diff, totalPhysicalProductCash: m.totalPhysicalProductCash,
                totalRevenueProduct: m.totalRevenueProduct, totalCogs: m.totalCogs,
                totalOtherIncome: m.otherIncome, totalExpenses: m.expenses, totalTiempo: m.totalTiempo,
                suggestedNomina: m.suggestedNomina, inputtedNomina: Number(finalNominaInput),
                cashAdjustment, actualNominaPaid, productBreakdown: m.productBreakdown
            };

            try {
                const docRef = await addDoc(collection(db, MAIN_DATA_PATH, 'cuts_history'), cutData);
                showMessage('Corte guardado.'); setIsSavingCut(false); setFinalNominaInput('');
                setSelectedCut({ id: docRef.id, ...cutData });
                setView('cut_detail');
            } catch (e) { handleError(e, 'guardar corte'); }
        };

        return (
            <div className="p-4 space-y-6 pb-20">
                <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideFileText className="mr-2" /> Nuevo Corte</h2>

                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border rounded text-xs"/>
                        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border rounded text-xs"/>
                    </div>
                </div>

                {reportMetrics.totalRevenueProduct !== undefined && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-400">
                                <p className="text-xs text-gray-500">Dinero Físico</p>
                                <p className="font-bold text-lg">{formatCurrency(reportMetrics.totalPhysicalProductCash)}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow border-l-4 border-indigo-400">
                                <p className="text-xs text-gray-500">Venta Sistema</p>
                                <p className="font-bold text-lg">{formatCurrency(reportMetrics.totalRevenueProduct)}</p>
                            </div>
                        </div>
                        
                        <div className={`p-4 rounded-xl shadow border-l-4 ${reportMetrics.diff >= 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'} flex justify-between items-center`}>
                            <div><p className="font-bold">Diferencia</p><p className="text-xl font-black">{formatCurrency(Math.abs(reportMetrics.diff))} {reportMetrics.diff>=0?'(Sobra)':'(Falta)'}</p></div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow space-y-3 border-2 border-pink-100">
                            <p className="text-sm font-semibold text-gray-600">Nómina Sugerida: {formatCurrency(reportMetrics.suggestedNomina)}</p>
                            <input type="number" placeholder="Pagar Nómina" value={finalNominaInput} onChange={e=>setFinalNominaInput(e.target.value)} className="w-full p-2 border rounded"/>
                            <button onClick={()=>setIsSavingCut(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Guardar Corte</button>
                        </div>
                        
                        {isSavingCut && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                                    <h3 className="font-bold text-lg mb-2">¿Confirmar?</h3>
                                    <p className="text-sm text-gray-600 mb-4">Esto cerrará la caja del periodo seleccionado.</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveCut} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Si</button>
                                        <button onClick={()=>setIsSavingCut(false)} className="flex-1 bg-gray-300 py-2 rounded">No</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const PLView = () => {
        const sortedCuts = [...cutsHistory].sort((a,b)=>b.cutDate-a.cutDate);
        return (
            <div className="p-4 pb-24 space-y-4">
                <div className="flex justify-between items-center">
                     <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideBarChart3 className="mr-2" /> Historial</h2>
                </div>
                
                <div className="space-y-3">
                    {sortedCuts.length === 0 && <p className="text-center text-gray-500">No hay cortes registrados.</p>}
                    {sortedCuts.map(cut => (
                        <div key={cut.id} className="bg-white p-3 rounded-xl shadow border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-indigo-900">{formatDateShort(cut.cutDate)}</p>
                                    <p className="text-xs text-gray-500">{formatDateShort(cut.startDate)} - {formatDateShort(cut.endDate)}</p>
                                </div>
                                <button onClick={() => { setSelectedCut(cut); setView('cut_detail'); }} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center">
                                    <LucideSearch className="h-3 w-3 mr-1"/> Ver
                                </button>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2 border-gray-100">
                                <span>Ganancia:</span>
                                <span className="font-bold text-green-600">
                                    {formatCurrency((cut.totalRevenueProduct - cut.totalCogs + cut.totalOtherIncome + (cut.totalTiempo||0) - cut.totalExpenses - cut.actualNominaPaid))}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (loading) return (
            <div className="min-h-screen flex flex-col items-center justify-center text-indigo-600 font-bold p-10 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p>Cargando Billares...</p>
                <p className="text-xs text-gray-400 font-normal mt-2">Si esto tarda mucho, revisa tu internet.</p>
            </div>
        );
        
        if (!user) return (
             <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center space-y-4">
                <LucideWifiOff className="h-16 w-16 text-gray-300"/>
                <h2 className="text-xl font-bold text-gray-700">Sin conexión al servidor</h2>
                <p className="text-sm text-gray-500">No se pudo autenticar. Verifica tu internet o la configuración de Firebase (Auth Anónimo habilitado).</p>
                <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold">Reintentar</button>
            </div>
        );

        switch (view) {
            case 'inventory': return <InventoryView />;
            case 'stock_inflow': return <StockInflowView />;
            case 'stock_outflow': return <StockOutflowView />;
            case 'cash_input': return <CashInputView />;
            case 'reports': return <ReportsView />;
            case 'pl_report': return <PLView />;
            case 'cut_detail': return <CutDetailView />;
            case 'transactions': return <TransactionsView />;
            default: return <CashInputView />;
        }
    };

    const NavItem = ({ name, icon: Icon, label }) => (
        <button onClick={()=>setView(name)} className={`flex flex-col items-center p-2 min-w-[50px] ${view===name?'text-indigo-600':'text-gray-400'}`}>
            <Icon className="h-5 w-5"/>
            <span className="text-[9px] font-bold mt-1">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            {globalMsg.text && (
                <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded shadow-lg text-white text-center font-bold text-sm animate-bounce ${globalMsg.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
                    {globalMsg.text}
                </div>
            )}
            <header className="bg-indigo-700 p-4 shadow-lg text-white flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-extrabold flex items-center"><LucideLayoutDashboard className="mr-2"/> El Chalán</h1>
                    <p className="text-[10px] opacity-75">Contabilidad Central</p>
                </div>
                {user && <div className="text-[10px] bg-indigo-800 px-2 py-1 rounded flex items-center"><div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div> Online</div>}
            </header>
            
            <main>{renderContent()}</main>
            
            <nav className="fixed bottom-0 w-full bg-white border-t flex justify-between px-2 py-2 shadow-2xl overflow-x-auto z-50">
                <NavItem name="inventory" icon={LucidePackage} label="Inv" />
                <NavItem name="stock_inflow" icon={LucideArrowUp} label="Entrar" />
                <NavItem name="stock_outflow" icon={LucideArrowDown} label="Salir" />
                <NavItem name="cash_input" icon={LucideCoins} label="Caja" />
                <NavItem name="reports" icon={LucideScale} label="Corte" />
                <NavItem name="pl_report" icon={LucideBarChart3} label="P&L" />
                <NavItem name="transactions" icon={LucideDollarSign} label="Gasto" />
            </nav>
        </div>
    );
};

export default App;
