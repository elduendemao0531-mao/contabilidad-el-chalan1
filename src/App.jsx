import miLogo from './milogo.png';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { LucidePackage, LucideDollarSign, LucideBarChart3, LucidePlus, LucideX, LucideEdit, LucideFileText, LucideCoins, LucideTrendingUp, LucideArrowDown, LucideArrowUp, LucideScale, LucideArrowLeftRight, LucideBarcode, LucideListChecks, LucideCalculator, LucideAlertTriangle, LucideCalendarSearch, LucideCalendarCheck, LucideDownload, LucideSearch } from 'lucide-react';

// --- Configuración de Firebase y Variables Globales ---
const appId = 'Billares el chalan';
const firebaseConfig = {
  apiKey: "AIzaSyCrTZ7HBx_b-f-wLmsynEdV2f8jwrqwZAg",
  authDomain: "billares-el-chalan.firebaseapp.com",
  projectId: "billares-el-chalan",
  storageBucket: "billares-el-chalan.firebasestorage.app",
  messagingSenderId: "878650764638",
  appId: "1:878650764638:web:312e798ba952d87703f3cf"
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicialización de Firebase
let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase inicializado con éxito.");
    } catch (e) {
        console.error("Error al inicializar Firebase:", e);
    }
}

// --- UTILIDAD PARA EXPORTAR A CSV (EXCEL) ---
const exportToCSV = (data, headers, filename) => {
    if (!data || !data.length) {
        alert("No hay datos para exportar.");
        return;
    }
    
    // Crear el contenido del CSV
    const csvContent = [
        headers.join(','), // Encabezados
        ...data.map(row => 
            headers.map(fieldName => {
                let value = row[fieldName] !== undefined ? row[fieldName] : '';
                // Escapar comillas y manejar strings
                if (typeof value === 'string') {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    // Crear el blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- Componente Principal de la Aplicación ---

const App = () => {
    // --- Estados de la Aplicación ---
    const [view, setView] = useState('cash_input');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Datos
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]); 
    const [dailyCashInputs, setDailyCashInputs] = useState([]); 
    const [transactions, setTransactions] = useState([]); 
    const [cutsHistory, setCutsHistory] = useState([]); 
    const [stockInflows, setStockInflows] = useState([]); 
    const [loading, setLoading] = useState(true);

    // Estado para la vista de Detalle de Corte
    const [selectedCut, setSelectedCut] = useState(null);

    // --- Funciones de Utilidad ---
    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
    const formatDate = (timestamp, includeTime = true) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
             options.hour = '2-digit';
             options.minute = '2-digit';
        }
        return timestamp.toDate().toLocaleDateString('es-CO', options);
    };
    const formatDateShort = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        return timestamp.toDate().toLocaleDateString('es-CO', { year: 'numeric', month: 'numeric', day: 'numeric' });
    };
    const isCodeUnique = useCallback((code, excludeId = null) => {
        return !products.some(p => p.code === code && p.id !== excludeId);
    }, [products]);

    // --- 1. Autenticación y Conexión a Firestore ---

    useEffect(() => {
        if (!auth) return;
        const handleAuth = async () => {
            try {
                if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                else await signInAnonymously(auth);
            } catch (error) { console.error("Error Auth:", error); }
        };
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) { setUserId(user.uid); setIsAuthReady(true); } 
            else { setUserId(null); setIsAuthReady(true); }
        });
        handleAuth();
        return () => unsubscribe();
    }, []);

    // --- 2. Carga de Datos ---

    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;
        setLoading(true);
        const basePath = `artifacts/${appId}/users/${userId}`;
        
        // Listeners
        const unsubs = [
            onSnapshot(query(collection(db, `${basePath}/inventory`)), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data(), cost: Number(d.data().cost||0), price: Number(d.data().price||0), stock: Number(d.data().stock||0) })))),
            onSnapshot(query(collection(db, `${basePath}/sales`)), s => setSales(s.docs.map(d => ({ id: d.id, ...d.data(), quantity: Number(d.data().quantity||0), amount: Number(d.data().amount||0), cogs: Number(d.data().cogs||0) })))),
            onSnapshot(query(collection(db, `${basePath}/daily_cash_inputs`)), s => setDailyCashInputs(s.docs.map(d => ({ id: d.id, ...d.data(), totalCashCollected: Number(d.data().totalCashCollected||0), tiempoValue: Number(d.data().tiempoValue||0), productSalesCash: Number(d.data().productSalesCash||0) })).sort((a,b)=>b.date-a.date))),
            onSnapshot(query(collection(db, `${basePath}/transactions`)), s => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data(), amount: Number(d.data().amount||0) })))),
            onSnapshot(query(collection(db, `${basePath}/cuts_history`)), s => setCutsHistory(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, `${basePath}/stock_inflows`)), s => setStockInflows(s.docs.map(d => ({ id: d.id, ...d.data(), quantity: Number(d.data().quantity||0) }))))
        ];
        
        setLoading(false);
        return () => unsubs.forEach(u => u());
    }, [isAuthReady, userId]);

    // ------------------------------------
    // VISTA 1: INVENTARIO
    // ------------------------------------

    const InventoryView = () => {
        const [isAdding, setIsAdding] = useState(false);
        const [editingProduct, setEditingProduct] = useState(null);
        const [message, setMessage] = useState('');

        const handleExportInventory = () => {
            const dataToExport = products.map(p => ({
                Nombre: p.name,
                Codigo: p.code,
                Costo: p.cost,
                PrecioVenta: p.price,
                StockActual: p.stock,
                ValorTotalStock: p.stock * p.cost
            }));
            exportToCSV(dataToExport, ['Nombre', 'Codigo', 'Costo', 'PrecioVenta', 'StockActual', 'ValorTotalStock'], `Inventario_${new Date().toISOString().split('T')[0]}`);
        };

        const handleSaveProduct = async (data) => {
            const { name, code, cost, price, stock, id } = data;
            if (!name || !code || isNaN(Number(cost)) || isNaN(Number(price)) || isNaN(Number(stock))) {
                setMessage('Error: Completa todos los campos correctamente.'); return;
            }
            if (!isCodeUnique(code, id)) {
                setMessage('Error: El código ya existe.'); return;
            }

            try {
                const productData = { name: name.trim(), code: code.trim(), cost: Number(cost), price: Number(price), stock: Number(stock), userId: userId };
                if (id) {
                    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/inventory`, id), productData);
                    setMessage(`Producto actualizado.`); setEditingProduct(null);
                } else {
                    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/inventory`), { ...productData, createdAt: Timestamp.now() });
                    setMessage(`Producto agregado.`); setIsAdding(false);
                }
                setTimeout(() => setMessage(''), 3000);
            } catch (e) { console.error(e); setMessage('Error al guardar.'); }
        };

        const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + (p.stock * p.cost), 0), [products]);

        const ProductForm = ({ initialData, onSave, onCancel }) => {
            const [form, setForm] = useState({ 
                name: initialData?.name||'', code: initialData?.code||'', 
                cost: initialData?.cost||'', price: initialData?.price||'', stock: initialData?.stock||'' 
            });
            return (
                <div className="bg-white p-4 rounded-xl shadow-lg space-y-3 border-2 border-indigo-200">
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
                    <button onClick={handleExportInventory} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center font-bold border border-green-200">
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

                {message && <div className="bg-blue-100 text-blue-800 p-2 rounded text-sm">{message}</div>}

                {(editingProduct || isAdding) ? 
                    <ProductForm initialData={editingProduct} onSave={handleSaveProduct} onCancel={() => { setEditingProduct(null); setIsAdding(false); }} /> 
                    : 
                    <button onClick={() => setIsAdding(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow flex justify-center items-center">
                        <LucidePlus className="mr-2 h-5 w-5" /> Agregar Producto
                    </button>
                }

                <div className="space-y-2 mt-4">
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

    // --- VISTAS SIMPLIFICADAS (StockInflow, StockOutflow, CashInput, Transactions) ---
    // (Mantenemos la lógica intacta pero condensada para ahorrar espacio y enfocarnos en lo nuevo)

    const StockInflowView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [prodId, setProdId] = useState('');
        const [qty, setQty] = useState('');
        const [msg, setMsg] = useState('');
        const recent = stockInflows.sort((a,b)=>b.registeredAt-a.registeredAt).slice(0,5);

        const handleIn = async () => {
            if(!prodId || !qty || qty<=0) return;
            const p = products.find(x=>x.id===prodId);
            try {
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/stock_inflows`), {
                    productId: prodId, productName: p.name, quantity: Number(qty), date: Timestamp.fromDate(new Date(date)), registeredAt: Timestamp.now(), userId
                });
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/inventory`, prodId), { stock: p.stock + Number(qty) });
                setMsg(`Ingreso registrado: ${qty} x ${p.name}`); setQty('');
            } catch(e){ console.error(e); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideArrowUp className="mr-2" /> Ingreso Stock</h2>
                {msg && <div className="bg-green-100 text-green-800 p-2 rounded text-sm">{msg}</div>}
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
                    <select value={prodId} onChange={e=>setProdId(e.target.value)} className="w-full p-2 border rounded">
                        <option value="">Seleccionar Producto...</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                    </select>
                    <input type="number" placeholder="Cantidad" value={qty} onChange={e=>setQty(e.target.value)} className="w-full p-2 border rounded"/>
                    <button onClick={handleIn} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Registrar Entrada</button>
                </div>
                <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-600">Recientes</h3>
                    {recent.map(r=><div key={r.id} className="bg-white p-2 rounded text-sm border flex justify-between"><span>{r.productName}</span><span className="font-bold text-blue-600">+{r.quantity}</span></div>)}
                </div>
            </div>
        );
    };

    const StockOutflowView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [prodId, setProdId] = useState('');
        const [endStock, setEndStock] = useState('');
        const [msg, setMsg] = useState('');
        
        const p = products.find(x=>x.id===prodId);
        const sold = p && endStock!=='' ? p.stock - Number(endStock) : 0;
        const rev = p && sold>0 ? sold*p.price : 0;
        const recent = sales.sort((a,b)=>b.registeredAt-a.registeredAt).slice(0,5);

        const handleOut = async () => {
            if(!prodId || endStock==='') return;
            if(Number(endStock) > p.stock) { setMsg('Error: Stock final mayor al inicial.'); return; }
            try {
                if(sold > 0) {
                    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/sales`), {
                        productId: prodId, productName: p.name, quantity: sold, unitPrice: p.price, unitCost: p.cost,
                        amount: rev, cogs: sold*p.cost, date: Timestamp.fromDate(new Date(date)), registeredAt: Timestamp.now(), userId
                    });
                }
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/inventory`, prodId), { stock: Number(endStock) });
                setMsg(`Egreso registrado. Vendidos: ${sold}. Stock actual: ${endStock}`); setEndStock('');
            } catch(e){ console.error(e); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideArrowLeftRight className="mr-2" /> Egreso Stock (Conteo)</h2>
                {msg && <div className="bg-blue-100 text-blue-800 p-2 rounded text-sm">{msg}</div>}
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
                <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-600">Ventas Recientes</h3>
                    {recent.map(r=><div key={r.id} className="bg-white p-2 rounded text-sm border flex justify-between"><span>{r.productName} ({r.quantity})</span><span className="font-bold text-red-600">{formatCurrency(r.amount)}</span></div>)}
                </div>
            </div>
        );
    };

    const CashInputView = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [cash, setCash] = useState('');
        const [timeVal, setTimeVal] = useState('');
        const [msg, setMsg] = useState('');

        const handleSave = async () => {
            if(!date || !cash || !timeVal) return;
            // Check dupes
            if(dailyCashInputs.some(d=>formatDateShort(d.date) === formatDateShort(Timestamp.fromDate(new Date(date))))) {
                setMsg('Ya existe registro para esta fecha.'); return;
            }
            try {
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/daily_cash_inputs`), {
                    date: Timestamp.fromDate(new Date(date)), totalCashCollected: Number(cash), tiempoValue: Number(timeVal),
                    productSalesCash: Number(cash)-Number(timeVal), savedAt: Timestamp.now(), userId
                });
                setMsg('Caja guardada.'); setCash(''); setTimeVal('');
            } catch(e){ console.error(e); }
        };

        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800"><LucideCoins className="mr-2" /> Registro Efectivo</h2>
                {msg && <div className="bg-green-100 text-green-800 p-2 rounded text-sm">{msg}</div>}
                <div className="bg-white p-4 rounded-xl shadow space-y-3 border-2 border-green-200">
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded"/>
                    <input type="number" placeholder="Dinero Físico Total" value={cash} onChange={e=>setCash(e.target.value)} className="w-full p-2 border rounded"/>
                    <input type="number" placeholder="Valor 'Tiempo'" value={timeVal} onChange={e=>setTimeVal(e.target.value)} className="w-full p-2 border rounded"/>
                    <p className="text-sm font-bold text-right text-gray-700">Prod. Físico: {formatCurrency(Number(cash)-Number(timeVal))}</p>
                    <button onClick={handleSave} className="w-full bg-green-600 text-white py-2 rounded font-bold">Guardar Caja</button>
                </div>
                <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-600">Historial</h3>
                    {dailyCashInputs.slice(0,5).map(d=><div key={d.id} className="bg-white p-2 rounded text-sm border flex justify-between"><span>{formatDateShort(d.date)}</span><span>T: {formatCurrency(d.totalCashCollected)}</span></div>)}
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
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/transactions`), {
                type, description: desc, amount: Number(amt), date: Timestamp.now(), userId
            });
            setDesc(''); setAmt('');
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

    // ------------------------------------
    // NUEVA VISTA: DETALLE DE CORTE (Reporte Granular)
    // ------------------------------------
    const CutDetailView = () => {
        if (!selectedCut) return <div className="p-4">No hay corte seleccionado.</div>;

        const breakdown = selectedCut.productBreakdown || [];

        const handleExportDetail = () => {
            const dataToExport = breakdown.map(p => ({
                Producto: p.name,
                StockAlMomento: p.stockAtCut,
                Entradas: p.inflows,
                Vendidos: p.sold,
                VentaTotal: p.revenue,
                Ganancia: p.profit
            }));
            exportToCSV(dataToExport, ['Producto', 'StockAlMomento', 'Entradas', 'Vendidos', 'VentaTotal', 'Ganancia'], `Detalle_Corte_${formatDateShort(selectedCut.cutDate)}`);
        };

        return (
            <div className="p-4 pb-24">
                <button onClick={() => setView('pl_report')} className="mb-4 text-indigo-600 font-bold flex items-center">
                    &larr; Volver a Reportes
                </button>
                
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideListChecks className="mr-2" /> Detalle de Corte</h2>
                        <p className="text-sm text-gray-500">
                            {formatDateShort(selectedCut.startDate)} - {formatDateShort(selectedCut.endDate)}
                        </p>
                    </div>
                    <button onClick={handleExportDetail} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg font-bold text-xs flex items-center border border-green-200 shadow-sm">
                        <LucideDownload className="h-4 w-4 mr-1"/> Descargar CSV
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50 text-indigo-900 font-bold">
                                <tr>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3 text-center">Entradas</th>
                                    <th className="p-3 text-center">Vendidos</th>
                                    <th className="p-3 text-right">Venta ($)</th>
                                    <th className="p-3 text-right">Ganancia ($)</th>
                                    <th className="p-3 text-center">Stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {breakdown.length === 0 ? (
                                    <tr><td colSpan="6" className="p-4 text-center text-gray-500">No hay detalles guardados para este corte.</td></tr>
                                ) : (
                                    breakdown.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                            <td className="p-3 text-center text-blue-600">{item.inflows > 0 ? `+${item.inflows}` : '-'}</td>
                                            <td className="p-3 text-center text-red-600 font-bold">{item.sold > 0 ? item.sold : '-'}</td>
                                            <td className="p-3 text-right">{formatCurrency(item.revenue)}</td>
                                            <td className="p-3 text-right text-green-600 font-semibold">{formatCurrency(item.profit)}</td>
                                            <td className="p-3 text-center text-gray-500">{item.stockAtCut}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-2">
                    <p className="font-bold text-gray-700 mb-2">Resumen General del Corte</p>
                    <div className="flex justify-between"><span>Venta Total Productos:</span> <span className="font-bold">{formatCurrency(selectedCut.totalRevenueProduct)}</span></div>
                    <div className="flex justify-between"><span>Ingreso Tiempo:</span> <span className="font-bold">{formatCurrency(selectedCut.totalTiempo)}</span></div>
                    <div className="flex justify-between"><span>Gastos:</span> <span className="font-bold text-red-500">-{formatCurrency(selectedCut.totalExpenses)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-gray-300"><span>Ganancia Neta (Cierre):</span> <span className="font-bold text-indigo-700">{formatCurrency(selectedCut.actualNominaPaid ? (selectedCut.totalRevenueProduct - selectedCut.totalCogs + selectedCut.totalOtherIncome + (selectedCut.totalTiempo||0) - selectedCut.totalExpenses - selectedCut.actualNominaPaid) : 0)}</span></div>
                </div>
            </div>
        );
    };


    // ------------------------------------
    // VISTA 5: CORTES Y RECONCILIACIÓN (MODIFICADA PARA DETALLE)
    // ------------------------------------

    const ReportsView = () => {
        const today = new Date().toISOString().split('T')[0];
        const twoWeeksAgo = new Date(new Date().setDate(new Date().getDate() - 14)).toISOString().split('T')[0];
        const [startDate, setStartDate] = useState(twoWeeksAgo);
        const [endDate, setEndDate] = useState(today);
        const [isSavingCut, setIsSavingCut] = useState(false);
        const [finalNominaInput, setFinalNominaInput] = useState('');
        const [message, setMessage] = useState('');

        const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
        const endTimestamp = endDate ? Timestamp.fromDate(new Date(new Date(endDate).setHours(23, 59, 59))) : null;

        // Calculadora de métricas
        const reportMetrics = useMemo(() => {
            if (!startTimestamp || !endTimestamp) return {};

            // Filtros de fecha
            const fSales = sales.filter(s => s.date.toMillis() >= startTimestamp.toMillis() && s.date.toMillis() <= endTimestamp.toMillis());
            const fCash = dailyCashInputs.filter(c => c.date.toMillis() >= startTimestamp.toMillis() && c.date.toMillis() <= endTimestamp.toMillis());
            const fTrans = transactions.filter(t => t.date.toMillis() >= startTimestamp.toMillis() && t.date.toMillis() <= endTimestamp.toMillis());
            const fInflows = stockInflows.filter(i => i.date.toMillis() >= startTimestamp.toMillis() && i.date.toMillis() <= endTimestamp.toMillis());

            // Totales Generales
            const totalRevenueProduct = fSales.reduce((sum, s) => sum + s.amount, 0);
            const totalCogs = fSales.reduce((sum, s) => sum + s.cogs, 0);
            const totalTiempo = fCash.reduce((sum, c) => sum + c.tiempoValue, 0);
            const totalPhysicalProductCash = fCash.reduce((sum, c) => sum + c.productSalesCash, 0);
            const diff = totalPhysicalProductCash - totalRevenueProduct;
            const suggestedNomina = totalTiempo + (totalRevenueProduct * 0.03);
            const otherIncome = fTrans.filter(t => t.type === 'Income').reduce((sum, e) => sum + e.amount, 0);
            const expenses = fTrans.filter(t => t.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);

            // --- NUEVO: CÁLCULO DE DETALLE POR PRODUCTO ---
            const breakdown = products.map(prod => {
                const pSales = fSales.filter(s => s.productId === prod.id);
                const pInflows = fInflows.filter(i => i.productId === prod.id);
                
                const soldQty = pSales.reduce((sum, s) => sum + s.quantity, 0);
                const revenue = pSales.reduce((sum, s) => sum + s.amount, 0);
                const cogs = pSales.reduce((sum, s) => sum + s.cogs, 0);
                const inflowsQty = pInflows.reduce((sum, i) => sum + i.quantity, 0);

                return {
                    id: prod.id,
                    name: prod.name,
                    stockAtCut: prod.stock, // Foto del stock actual
                    inflows: inflowsQty,
                    sold: soldQty,
                    revenue: revenue,
                    profit: revenue - cogs
                };
            }).filter(p => p.sold > 0 || p.inflows > 0); // Solo productos con movimiento

            return {
                totalRevenueProduct, totalCogs, totalPhysicalProductCash, diff, suggestedNomina, totalTiempo, otherIncome, expenses,
                dailyCashCount: fCash.length, salesCount: fSales.length, productBreakdown: breakdown
            };
        }, [sales, dailyCashInputs, transactions, stockInflows, products, startTimestamp, endTimestamp]);

        // Lógica de guardado
        const handleSaveCut = async () => {
            const m = reportMetrics;
            if (!m.dailyCashCount || !finalNominaInput || Number(finalNominaInput) <= 0) {
                 setMessage('Error: Revisa fechas y nómina.'); return;
            }

            let cashAdjustment = 0;
            if (m.diff < 0) cashAdjustment = Math.abs(m.diff);
            const actualNominaPaid = Number(finalNominaInput) - cashAdjustment;

            const cutData = {
                startDate: startTimestamp, endDate: endTimestamp, cutDate: Timestamp.now(), userId,
                reconciliationDifference: m.diff, totalPhysicalProductCash: m.totalPhysicalProductCash,
                totalRevenueProduct: m.totalRevenueProduct, totalCogs: m.totalCogs,
                totalOtherIncome: m.otherIncome, totalExpenses: m.expenses, totalTiempo: m.totalTiempo,
                suggestedNomina: m.suggestedNomina, inputtedNomina: Number(finalNominaInput),
                cashAdjustment, actualNominaPaid,
                // --- GUARDAR DETALLE ---
                productBreakdown: m.productBreakdown // Guardamos el array detallado
            };

            try {
                const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/cuts_history`), cutData);
                setMessage('Corte guardado exitosamente.'); setIsSavingCut(false); setFinalNominaInput('');
                // Opcional: Redirigir al detalle inmediatamente
                setSelectedCut({ id: docRef.id, ...cutData });
                setView('cut_detail');
            } catch (e) { console.error(e); setMessage('Error al guardar.'); }
        };

        const renderDiff = () => {
            const d = reportMetrics.diff || 0;
            const color = d >= 0 ? 'text-green-700 border-green-500 bg-green-50' : 'text-red-700 border-red-500 bg-red-50';
            return (
                <div className={`p-4 rounded-xl shadow border-l-4 ${color} flex justify-between items-center`}>
                    <div><p className="font-bold">Diferencia (Físico vs Sistema)</p><p className="text-2xl font-black">{formatCurrency(Math.abs(d))} {d>=0?'(Sobra)':'(Falta)'}</p></div>
                    {d < 0 && <LucideAlertTriangle className="h-8 w-8 opacity-50"/>}
                </div>
            );
        };

        return (
            <div className="p-4 space-y-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideFileText className="mr-2" /> Nuevo Corte / Arqueo</h2>
                {message && <div className="bg-red-100 text-red-800 p-2 rounded text-sm">{message}</div>}

                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border rounded"/>
                        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border rounded"/>
                    </div>
                </div>

                {reportMetrics.totalRevenueProduct !== undefined && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-400">
                                <p className="text-xs text-gray-500">Dinero Físico (Prod)</p>
                                <p className="font-bold text-lg">{formatCurrency(reportMetrics.totalPhysicalProductCash)}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow border-l-4 border-indigo-400">
                                <p className="text-xs text-gray-500">Venta Esperada (Stock)</p>
                                <p className="font-bold text-lg">{formatCurrency(reportMetrics.totalRevenueProduct)}</p>
                            </div>
                        </div>
                        {renderDiff()}

                        <div className="bg-white p-4 rounded-xl shadow space-y-3 border-2 border-pink-100">
                            <p className="text-sm font-semibold text-gray-600">Nómina Sugerida: {formatCurrency(reportMetrics.suggestedNomina)}</p>
                            <input type="number" placeholder="Valor a Pagar de Nómina" value={finalNominaInput} onChange={e=>setFinalNominaInput(e.target.value)} className="w-full p-2 border rounded"/>
                            <button onClick={()=>setIsSavingCut(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Guardar Corte</button>
                        </div>
                        
                        {isSavingCut && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                                    <h3 className="font-bold text-lg mb-2">¿Confirmar Corte?</h3>
                                    <p className="text-sm text-gray-600 mb-4">Esto guardará el historial y generará el reporte detallado por producto.</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveCut} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Confirmar</button>
                                        <button onClick={()=>setIsSavingCut(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ------------------------------------
    // VISTA 6: P&L Y HISTORIAL (MODIFICADA PARA VER DETALLES)
    // ------------------------------------

    const PLView = () => {
        const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());
        
        const annualData = useMemo(() => {
            const year = Number(targetYear);
            const filtered = cutsHistory.filter(c => c.cutDate.toDate().getFullYear() === year);
            const stats = { netRevenue:0, cogs:0, nomina:0, other:0, time:0, exp:0, profit:0 };
            
            filtered.forEach(c => {
                stats.netRevenue += c.totalRevenueProduct||0;
                stats.cogs += c.totalCogs||0;
                stats.nomina += c.actualNominaPaid||0;
                stats.other += c.totalOtherIncome||0;
                stats.time += c.totalTiempo||0;
                stats.exp += c.totalExpenses||0;
            });
            stats.profit = (stats.netRevenue - stats.cogs) + stats.other + stats.time - stats.exp - stats.nomina;
            
            return { stats, cuts: filtered.sort((a,b)=>b.cutDate-a.cutDate) };
        }, [cutsHistory, targetYear]);

        const handleExportPL = () => {
             const dataToExport = annualData.cuts.map(c => ({
                FechaCorte: formatDateShort(c.cutDate),
                InicioPeriodo: formatDateShort(c.startDate),
                FinPeriodo: formatDateShort(c.endDate),
                VentaProductos: c.totalRevenueProduct,
                CostoProductos: c.totalCogs,
                IngresoTiempo: c.totalTiempo,
                OtrosIngresos: c.totalOtherIncome,
                GastosFijos: c.totalExpenses,
                NominaPagada: c.actualNominaPaid,
                GananciaNeta: (c.totalRevenueProduct - c.totalCogs + c.totalOtherIncome + (c.totalTiempo||0) - c.totalExpenses - c.actualNominaPaid)
            }));
            exportToCSV(dataToExport, ['FechaCorte', 'InicioPeriodo', 'FinPeriodo', 'VentaProductos', 'CostoProductos', 'IngresoTiempo', 'OtrosIngresos', 'GastosFijos', 'NominaPagada', 'GananciaNeta'], `Reporte_General_${targetYear}`);
        };

        return (
            <div className="p-4 pb-24 space-y-4">
                <div className="flex justify-between items-center">
                     <h2 className="text-xl font-bold text-gray-800 flex items-center"><LucideBarChart3 className="mr-2" /> Reportes & P&L</h2>
                     <button onClick={handleExportPL} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center font-bold border border-green-200">
                        <LucideDownload className="h-3 w-3 mr-1"/> Excel Anual
                    </button>
                </div>
                
                <div className="bg-indigo-600 p-4 rounded-xl shadow-xl text-white">
                    <p className="text-sm font-medium opacity-80">Ganancia Neta Año {targetYear}</p>
                    <p className="text-4xl font-extrabold">{formatCurrency(annualData.stats.profit)}</p>
                    <div className="mt-2 text-sm space-y-1 opacity-90">
                        <div className="flex justify-between"><span>+ Tiempo:</span> <span>{formatCurrency(annualData.stats.time)}</span></div>
                        <div className="flex justify-between"><span>- Nómina:</span> <span>{formatCurrency(annualData.stats.nomina)}</span></div>
                    </div>
                </div>

                <h3 className="font-bold text-gray-700 mt-6">Historial de Cortes</h3>
                <div className="space-y-3">
                    {annualData.cuts.map(cut => (
                        <div key={cut.id} className="bg-white p-3 rounded-xl shadow border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-indigo-900">{formatDateShort(cut.cutDate)}</p>
                                    <p className="text-xs text-gray-500">Período: {formatDateShort(cut.startDate)} - {formatDateShort(cut.endDate)}</p>
                                </div>
                                <button 
                                    onClick={() => { setSelectedCut(cut); setView('cut_detail'); }}
                                    className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center hover:bg-indigo-100 transition"
                                >
                                    <LucideSearch className="h-3 w-3 mr-1"/> Ver Detalle
                                </button>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2 border-gray-100">
                                <span>Ganancia Neta:</span>
                                <span className={`font-bold ${cut.actualNominaPaid ? 'text-green-600' : 'text-gray-400'}`}>
                                    {formatCurrency((cut.totalRevenueProduct - cut.totalCogs + cut.totalOtherIncome + (cut.totalTiempo||0) - cut.totalExpenses - cut.actualNominaPaid))}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // --- Navegación y Render ---

    const renderContent = () => {
        if (!isAuthReady || loading) return <div className="p-10 text-center">Cargando...</div>;
        switch (view) {
            case 'inventory': return <InventoryView />;
            case 'stock_inflow': return <StockInflowView />;
            case 'stock_outflow': return <StockOutflowView />;
            case 'cash_input': return <CashInputView />;
            case 'reports': return <ReportsView />;
            case 'pl_report': return <PLView />;
            case 'cut_detail': return <CutDetailView />; // Nueva Vista
            case 'transactions': return <TransactionsView />;
            default: return <CashInputView />;
        }
    };

    const NavItem = ({ name, icon: Icon, label }) => (
        <button onClick={()=>setView(name)} className={`flex flex-col items-center p-2 min-w-[64px] ${view===name?'text-indigo-600':'text-gray-400'}`}>
            <Icon className="h-6 w-6"/>
            <span className="text-[10px] font-bold mt-1">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            <header className="bg-indigo-700 p-4 shadow-lg text-white">
                <h1 className="text-lg font-extrabold">Billares El Chalan Contabilidad</h1>
                {userId && <p className="text-xs opacity-75">ID: {userId.slice(0,6)}</p>}
            </header>
            <main>{renderContent()}</main>
            <nav className="fixed bottom-0 w-full bg-white border-t flex justify-between px-2 py-1 shadow-2xl overflow-x-auto z-50">
                <NavItem name="inventory" icon={LucidePackage} label="Inv" />
                <NavItem name="stock_inflow" icon={LucideArrowUp} label="Entrar" />
                <NavItem name="stock_outflow" icon={LucideArrowDown} label="Salir" />
                <NavItem name="cash_input" icon={LucideCoins} label="Caja" />
                <NavItem name="reports" icon={LucideScale} label="Corte" />
                <NavItem name="pl_report" icon={LucideBarChart3} label="P&L" />
                <NavItem name="transactions" icon={LucideDollarSign} label="Gastos" />
            </nav>
        </div>
    );
};

export default App;
