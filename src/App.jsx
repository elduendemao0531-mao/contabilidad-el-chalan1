import miLogo from './milogo.png';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, ArrowUp, ArrowDown, Coins, Scale, 
  BarChart3, DollarSign, Search, Plus, Save, 
  Trash2, FileText, AlertTriangle, Download, 
  ListChecks, ArrowLeft, X, Eye, EyeOff, Settings, RefreshCw, ClipboardCheck
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  getDocs,
  onSnapshot, 
  deleteDoc, 
  Timestamp
} from "firebase/firestore";

// --- CONFIGURACIÓN E INICIALIZACIÓN ---
const providedFirebaseConfig = {
  apiKey: "AIzaSyCrTZ7HBx_b-f-wLmsynEdV2f8jwrqwZAg",
  authDomain: "billares-el-chalan.firebaseapp.com",
  databaseURL: "https://billares-el-chalan-default-rtdb.firebaseio.com",
  projectId: "billares-el-chalan",
  storageBucket: "billares-el-chalan.firebasestorage.app",
  messagingSenderId: "878650764638",
  appId: "1:878650764638:web:312e798ba952d87703f3cf"
};

const firebaseConfig = providedFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;

// --- HELPERS GLOBALES ---
const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(val || 0);
};

const formatDateShort = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
};

const exportToCSV = (data, headers, filename) => {
    const csvRows = [];
    csvRows.push(headers.join(','));
    data.forEach(row => {
        const values = headers.map(header => {
            const val = row[header];
            const cellValue = (val === undefined || val === null) ? '' : String(val).replace(/"/g, '""'); 
            return `"${cellValue}"`;
        });
        csvRows.push(values.join(',')); 
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
};

/**
 * Nueva función para exportar a formato XML Spreadsheet (.xls), compatible con Excel,
 * lo que evita los problemas de formato de CSV.
 * @param {Array<Object>} data Array de objetos con las métricas a exportar.
 * @param {string} filename Nombre del archivo.
 */
const exportToXLSX = (data, filename) => {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    xml += '<Worksheet ss:Name="Reporte PL">\n';
    xml += '<Table>\n';

    if (data.length > 0) {
        // Headers (tomados de las claves del primer objeto)
        const headers = Object.keys(data[0]);
        xml += '<Row>';
        headers.forEach(header => {
            xml += `<Cell><Data ss:Type="String">${header}</Data></Cell>`;
        });
        xml += '</Row>\n';

        // Data Rows
        data.forEach(row => {
            xml += '<Row>';
            headers.forEach(key => {
                const val = row[key];
                // Intentar detectar si es un número para que Excel lo formatee correctamente
                const isNumber = typeof val === 'number' && !isNaN(val);
                const type = isNumber ? 'Number' : 'String';
                let displayVal = String(val);

                if (isNumber) {
                    displayVal = val.toFixed(2);
                } else {
                    // Escapar caracteres XML
                    displayVal = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }

                xml += `<Cell><Data ss:Type="${type}">${displayVal}</Data></Cell>`;
            });
            xml += '</Row>\n';
        });
    }
    
    xml += '</Table>\n';
    xml += '</Worksheet>\n';
    xml += '</Workbook>';

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xls`; // Usar .xls para compatibilidad con XML Spreadsheet
    a.click();
};

// --- COMPONENTE MODAL REUTILIZABLE para Confirmación de Borrado ---
const CustomConfirmModal = ({ title, message, onConfirm, onCancel, confirmText = 'Confirmar' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <h3 className="font-bold text-xl mb-3 text-red-700 flex items-center"><AlertTriangle className="mr-2 h-6 w-6"/> {title}</h3>
            <p className="text-sm text-gray-600 mb-4">{message}</p>
            <div className="flex gap-2 mt-4">
                <button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700">{confirmText}</button>
                <button onClick={onCancel} className="flex-1 bg-gray-300 py-3 rounded-lg font-bold hover:bg-gray-400">Cancelar</button>
            </div>
        </div>
    </div>
);


// ------------------------------------
// COMPONENTES DE VISTA
// ------------------------------------

// 1. INVENTARIO
const InventoryView = ({ products, userId, getCollection }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentProd, setCurrentProd] = useState({ 
        code: '', name: '', price: 0, cost: 0, stock: 0, category: 'General' 
    });
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // Estado para confirmación

    const filtered = products.filter(p => 
        (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.code && String(p.code).toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleSave = async () => {
        if (!currentProd.name) { console.error("Nombre obligatorio."); return; }
        try {
            const colRef = getCollection('products');
            const dataToSave = {
                ...currentProd, 
                price: Number(currentProd.price),
                cost: Number(currentProd.cost),
                stock: Number(currentProd.stock),
                category: currentProd.category || 'General'
            };

            if (currentProd.id) {
                await updateDoc(doc(db, colRef.path, currentProd.id), dataToSave);
            } else {
                await addDoc(colRef, { ...dataToSave, createdAt: Timestamp.now() });
            }
            setIsEditing(false);
            setCurrentProd({ code: '', name: '', price: 0, cost: 0, stock: 0, category: 'General' });
        } catch (e) { console.error("Error saving product:", e); }
    };

    const handleDelete = async (id) => {
        setConfirmDeleteId(null); // Cierra el modal de confirmación
        try {
            await deleteDoc(doc(db, getCollection('products').path, id)); 
        } catch(e) { console.error("Error al eliminar.", e);}
    };

    return (
        <div className="p-4 space-y-4 pb-24">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center"><Package className="mr-2"/> Inventario</h2>
                <button onClick={() => { setCurrentProd({ code: '', name: '', price: 0, cost: 0, stock: 0, category: 'General' }); setIsEditing(true); }} className="bg-indigo-600 text-white p-2 rounded-full shadow-lg">
                    <Plus className="h-6 w-6" />
                </button>
            </div>

            {isEditing && (
                <div className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100 space-y-3 animate-fade-in">
                    <h3 className="font-bold text-gray-700">{currentProd.id ? 'Editar' : 'Nuevo'} Producto</h3>
                    <label className="block text-sm font-medium text-gray-700">Código</label>
                    <input type="text" placeholder="Ej: B001" value={currentProd.code} onChange={e => setCurrentProd({...currentProd, code: e.target.value})} className="w-full p-2 border rounded-lg font-mono uppercase" />
                    <label className="block text-sm font-medium text-gray-700 mt-2">Nombre</label>
                    <input type="text" placeholder="Ej: Cerveza Club" value={currentProd.name} onChange={e => setCurrentProd({...currentProd, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-sm font-medium text-gray-700 mt-2">Precio Venta</label><input type="number" value={currentProd.price} onChange={e => setCurrentProd({...currentProd, price: Number(e.target.value)})} className="w-full p-2 border rounded-lg" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mt-2">Costo</label><input type="number" value={currentProd.cost} onChange={e => setCurrentProd({...currentProd, cost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mt-2">Stock Inicial</label><input type="number" value={currentProd.stock} onChange={e => setCurrentProd({...currentProd, stock: Number(e.target.value)})} className="w-full p-2 border rounded-lg" /></div>
                    <div className="flex gap-2 pt-2">
                        <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold"><Save className="mr-2 h-4 w-4 inline"/> Guardar</button>
                        <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-300 py-2 rounded-lg font-bold">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-3 rounded-xl border border-gray-200 shadow-sm" />
            </div>

            <div className="space-y-2">
                {filtered.map(p => (
                    <div key={p.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-800">{p.name}</p>
                            {p.code && <p className="text-xs font-mono text-indigo-500">Código: {p.code}</p>}
                            <p className="text-xs text-gray-500">Stock: <span className={p.stock < 5 ? 'text-red-500 font-bold' : 'text-green-600'}>{p.stock}</span> | Costo: {formatCurrency(p.cost)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-indigo-600">{formatCurrency(p.price)}</span>
                            <button onClick={() => { setCurrentProd(p); setIsEditing(true); }} className="text-gray-400 hover:text-indigo-600"><FileText className="h-5 w-5"/></button>
                            <button onClick={() => setConfirmDeleteId(p.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5"/></button>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                <CustomConfirmModal
                    title="Borrar Producto"
                    message={`¿Estás seguro de que quieres eliminar el producto "${products.find(p => p.id === confirmDeleteId)?.name || 'N/A'}"?`}
                    onConfirm={() => handleDelete(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                    confirmText="Borrar Definitivamente"
                />
            )}
        </div>
    );
};

// 2. ENTRADAS DE STOCK (COMPRAS) - Con Historial Editable
const StockInflowView = ({ products, getCollection, stockInflows }) => { 
    const [selectedId, setSelectedId] = useState('');
    const [qty, setQty] = useState('');
    const [inflowDate, setInflowDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingItem, setEditingItem] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // Estado para confirmación

    const handleAddStock = async () => {
        if (!selectedId || !qty || Number(qty) <= 0) return;
        try {
            const product = products.find(p => p.id === selectedId);
            if (!product) return;
            const dateToUse = inflowDate ? Timestamp.fromDate(new Date(inflowDate)) : Timestamp.now();

            await addDoc(getCollection('stock_inflows'), {
                productId: selectedId, productName: product.name, quantity: Number(qty),
                costAtTime: product.cost, date: dateToUse, productCode: product.code || ''
            });

            // Actualizar stock producto
            const prodRef = doc(db, getCollection('products').path, selectedId);
            await updateDoc(prodRef, { stock: (product.stock || 0) + Number(qty) });

            setQty(''); setSelectedId(''); 
        } catch (e) { console.error(e); }
    };

    const handleDeleteInflow = async (item) => {
        setConfirmDeleteId(null);
        try {
            // Revertir Stock
            const currentProd = products.find(p => p.id === item.productId);
            if(currentProd) {
                const newStock = Math.max(0, currentProd.stock - item.quantity);
                await updateDoc(doc(db, getCollection('products').path, item.productId), { stock: newStock });
            }
            // Borrar registro
            await deleteDoc(doc(db, getCollection('stock_inflows').path, item.id));
        } catch(e) { console.error(e); }
    };

    const handleUpdateInflow = async () => {
        if(!editingItem) return;
        const newQty = Number(editingItem.quantity);
        const originalQty = Number(editingItem.originalQty);
        
        try {
            // 1. Ajustar el stock del producto con la diferencia
            const diff = newQty - originalQty;
            const currentProd = products.find(p => p.id === editingItem.productId);
            if(currentProd && diff !== 0) {
                 await updateDoc(doc(db, getCollection('products').path, editingItem.productId), { 
                     stock: currentProd.stock + diff 
                 });
            }
            // 2. Actualizar el registro
            await updateDoc(doc(db, getCollection('stock_inflows').path, editingItem.id), {
                quantity: newQty
            });
            setEditingItem(null);
        } catch(e) { console.error(e); }
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><ArrowUp className="mr-2"/> Entrada de Mercancía</h2>
            <div className="bg-white p-5 rounded-xl shadow border border-indigo-50 space-y-4">
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label><input type="date" value={inflowDate} onChange={e => setInflowDate(e.target.value)} className="w-full p-3 border rounded-xl" /></div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                    <select value={selectedId} onChange={e => { setSelectedId(e.target.value); }} className="w-full p-3 border rounded-xl bg-gray-50">
                        <option value="">Seleccione...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] - ` : ''}{p.name} (Stock: {p.stock})</option>)}
                    </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label><input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Ej: 12" /></div>
                <button onClick={handleAddStock} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow">Registrar Entrada</button>
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <h3 className="font-bold text-gray-600">Historial Reciente (Editable)</h3>
                <button onClick={() => exportToCSV(stockInflows, ['productName','quantity','date'], 'entradas')} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200"><Download className="h-4 w-4 mr-1 inline"/> CSV</button>
            </div>

            <div className="space-y-2">
                {stockInflows.slice(0, 10).map(i => (
                    <div key={i.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-800">{i.productName}</p>
                            <p className="text-xs text-gray-500">{formatDateShort(i.date)} | Cantidad: {i.quantity}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingItem({...i, originalQty: i.quantity})} className="text-gray-400 hover:text-indigo-600"><FileText className="h-5 w-5"/></button>
                            <button onClick={() => setConfirmDeleteId(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5"/></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Edición */}
            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">Corregir Entrada</h3>
                        <p className="text-sm mb-2">{editingItem.productName}</p>
                        <input type="number" value={editingItem.quantity} onChange={e=>setEditingItem({...editingItem, quantity: e.target.value})} className="w-full p-2 border rounded mb-4" />
                        <div className="flex gap-2">
                            <button onClick={handleUpdateInflow} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Actualizar</button>
                            <button onClick={()=>setEditingItem(null)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                 <CustomConfirmModal
                    title="Borrar Entrada de Stock"
                    message={`¿Estás seguro de que quieres eliminar esta entrada de ${confirmDeleteId.quantity} unidades? Se RESTARÁ del stock actual del producto.`}
                    onConfirm={() => handleDeleteInflow(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                    confirmText="Eliminar y Ajustar Stock"
                />
            )}
        </div>
    );
};

// 3. CONTEO / CIERRE DE INVENTARIO
const InventoryCountView = ({ products, getCollection, sales }) => {
    const [selectedId, setSelectedId] = useState('');
    const [physicalStock, setPhysicalStock] = useState('');
    const [editingSale, setEditingSale] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // Estado para confirmación

    const currentProduct = products.find(p => p.id === selectedId);
    const systemStock = currentProduct ? (currentProduct.stock || 0) : 0;
    const calculatedSales = physicalStock !== '' ? (systemStock - Number(physicalStock)) : 0;

    const handleRegisterInventory = async () => {
        if (!selectedId || physicalStock === '') return;
        if (!currentProduct) return;

        try {
            if (calculatedSales !== 0) {
                 await addDoc(getCollection('sales'), {
                    productId: selectedId, 
                    productName: currentProduct.name, 
                    quantity: calculatedSales,
                    priceAtSale: currentProduct.price, 
                    cogs: currentProduct.cost * calculatedSales,
                    amount: currentProduct.price * calculatedSales,
                    type: calculatedSales > 0 ? 'Venta (Cierre)' : 'Ajuste Inventario (+)', 
                    date: Timestamp.now()
                });
            }

            const prodRef = doc(db, getCollection('products').path, selectedId);
            await updateDoc(prodRef, { stock: Number(physicalStock) });

            setPhysicalStock(''); setSelectedId(''); 
        } catch (e) { console.error(e); }
    };

    const handleDeleteSale = async (sale) => {
        setConfirmDeleteId(null);
        try {
            const currentProd = products.find(p => p.id === sale.productId);
            if(currentProd) {
                // Al borrar una venta de 5, significa que NO se vendieron 5, así que el stock aumenta en 5
                await updateDoc(doc(db, getCollection('products').path, sale.productId), { 
                    stock: currentProd.stock + sale.quantity 
                });
            }
            await deleteDoc(doc(db, getCollection('sales').path, sale.id));
        } catch(e) { console.error(e); }
    };
    
    const handleUpdateSale = async () => {
        if(!editingSale) return;
        const newQty = Number(editingSale.quantity);
        const oldQty = Number(editingSale.originalQty);
        
        try {
            const product = products.find(p => p.id === editingSale.productId);
            if(!product) return;

            // Ajuste de stock basado en la corrección de la venta
            const diff = oldQty - newQty; 
            await updateDoc(doc(db, getCollection('products').path, editingSale.productId), {
                stock: product.stock + diff
            });

            await updateDoc(doc(db, getCollection('sales').path, editingSale.id), {
                quantity: newQty,
                cogs: product.cost * newQty,
                amount: product.price * newQty
            });
            setEditingSale(null);
        } catch(e) { console.error(e); }
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><ClipboardCheck className="mr-2"/> Cierre de Inventario (Cálculo)</h2>
            <div className="bg-white p-5 rounded-xl shadow border border-indigo-50 space-y-4">
                <p className="text-sm text-gray-500 italic">Selecciona un producto e ingresa cuántos quedan realmente. El sistema calculará la venta.</p>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                    <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setPhysicalStock(''); }} className="w-full p-3 border rounded-xl bg-gray-50">
                        <option value="">Seleccione...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] - ` : ''}{p.name}</option>)}
                    </select>
                </div>

                {currentProduct && (
                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-indigo-800">Stock Sistema (Compras):</span>
                        <span className="text-2xl font-black text-indigo-900">{systemStock}</span>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">Inventario Físico (Lo que queda)</label>
                    <input 
                        type="number" 
                        value={physicalStock} 
                        onChange={e => setPhysicalStock(e.target.value)} 
                        className="w-full p-3 border-2 border-indigo-200 rounded-xl font-bold text-xl text-center" 
                        placeholder="Ej: 5" 
                        disabled={!selectedId}
                    />
                </div>

                {selectedId && physicalStock !== '' && (
                    <div className={`p-4 rounded-xl text-center border-2 ${calculatedSales >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <p className="text-sm uppercase font-bold tracking-wider mb-1">Venta Calculada</p>
                        <p className="text-3xl font-black">
                            {calculatedSales} <span className="text-base font-normal">unidades</span>
                        </p>
                        <p className="text-xs mt-1">
                            {calculatedSales >= 0 
                                ? `Ingreso: ${formatCurrency(calculatedSales * currentProduct.price)}` 
                                : '⚠️ Sobra inventario (Se registrará ajuste positivo)'}
                        </p>
                    </div>
                )}

                <button 
                    onClick={handleRegisterInventory} 
                    disabled={!selectedId || physicalStock === ''}
                    className="w-full bg-indigo-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-lg shadow transition hover:bg-indigo-700"
                >
                    Confirmar y Ajustar Stock
                </button>
            </div>

            <div className="space-y-2">
                <h3 className="font-bold text-gray-600 mt-4">Historial de Cierres (Editable)</h3>
                {sales.slice(0, 10).map(s => (
                    <div key={s.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-800">{s.productName}</p>
                            <p className="text-xs text-gray-500">{formatDateShort(s.date)} | Calc: {s.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${s.quantity < 0 ? 'text-red-500' : 'text-indigo-600'}`}>{formatCurrency(s.amount)}</span>
                            <button onClick={() => setEditingSale({...s, originalQty: s.quantity})} className="text-gray-400 hover:text-indigo-600"><FileText className="h-5 w-5"/></button>
                            <button onClick={() => setConfirmDeleteId(s)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5"/></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Edición Venta */}
            {editingSale && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">Corregir Cálculo</h3>
                        <p className="text-sm mb-2">{editingSale.productName}</p>
                        <label className="text-xs font-bold text-gray-500">Cantidad Vendida (Real)</label>
                        <input type="number" value={editingSale.quantity} onChange={e=>setEditingSale({...editingSale, quantity: e.target.value})} className="w-full p-2 border rounded mb-4" />
                        <div className="flex gap-2">
                            <button onClick={handleUpdateSale} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Actualizar</button>
                            <button onClick={()=>setEditingSale(null)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                 <CustomConfirmModal
                    title="Borrar Registro de Cierre"
                    message={`¿Estás seguro de que quieres eliminar el registro de venta calculada de ${confirmDeleteId.quantity} unidades? El stock se REAJUSTARÁ al estado anterior.`}
                    onConfirm={() => handleDeleteSale(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                    confirmText="Eliminar y Reajustar Stock"
                />
            )}
        </div>
    );
};

// 4. CAJA DIARIA
const CashInputView = ({ getCollection, dailyCashInputs }) => { 
    const [tiempoVal, setTiempoVal] = useState('');
    const [physicalCashCount, setPhysicalCashCount] = useState('');
    const [cashDate, setCashDate] = useState(new Date().toISOString().split('T')[0]);

    const [isEditingCash, setIsEditingCash] = useState(false);
    const [editingCashItem, setEditingCashItem] = useState(null);
    const [editTiempo, setEditTiempo] = useState('');
    const [editPhysicalCash, setEditPhysicalCash] = useState('');
    
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // Estado para confirmación

    const handleSaveDaily = async () => {
        const tVal = Number(tiempoVal) || 0;
        const pCash = Number(physicalCashCount) || 0;
        if (pCash === 0) { console.error("Total no puede ser 0"); return; }
        try {
            const dateToUse = Timestamp.fromDate(new Date(cashDate));
            const data = { tiempoValue: tVal, physicalCashCount: pCash, date: dateToUse, note: 'Corte Manual' };
            const docRef = await addDoc(getCollection('daily_cash'), data);
            
            setTiempoVal(''); setPhysicalCashCount(''); // Limpiar campos tras guardar
            // Abrir modal inmediatamente para verificar
            setEditingCashItem({ id: docRef.id, ...data });
            setEditTiempo(tVal); setEditPhysicalCash(pCash);
            setIsEditingCash(true);
        } catch (e) { console.error(e); }
    };

    const handleEditSave = async () => {
        if (!editingCashItem) return;
        try {
            const docRef = doc(db, getCollection('daily_cash').path, editingCashItem.id);
            await updateDoc(docRef, {
                tiempoValue: Number(editTiempo),
                physicalCashCount: Number(editPhysicalCash)
            });
            setIsEditingCash(false); setEditingCashItem(null); 
        } catch (e) { console.error(e); }
    };

    const handleDeleteCash = async (id) => {
        setConfirmDeleteId(null);
        try { await deleteDoc(doc(db, getCollection('daily_cash').path, id)); } catch(e) { console.error(e); }
    };

    const calculateProductCash = (item) => (item.physicalCashCount || 0) - (item.tiempoValue || 0);

    return (
        <div className="p-4 space-y-4 pb-24">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><Coins className="mr-2"/> Caja Rápida</h2>

            <div className="bg-white p-4 rounded-xl shadow border-l-4 border-gray-400">
                <label className="font-bold text-gray-700 block mb-2">Fecha</label>
                <input type="date" value={cashDate} onChange={e => setCashDate(e.target.value)} className="w-full p-2 border rounded-lg text-lg" />
            </div>

            <div className="bg-white p-4 rounded-xl shadow border-l-4 border-red-500 relative z-10">
                <label className="font-bold text-gray-700 block mb-2">1. Dinero Físico Total</label>
                <div className="flex gap-2">
                    <span className="p-3 bg-gray-100 rounded-l-lg font-bold text-gray-500">$</span>
                    <input 
                        type="number" 
                        value={physicalCashCount} 
                        onChange={e => setPhysicalCashCount(e.target.value)} 
                        className="w-full p-3 border rounded-r-lg font-bold text-2xl text-red-900 relative z-10"
                        placeholder="0" 
                    />
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow border-l-4 border-indigo-500 relative z-10">
                <label className="font-bold text-gray-700 block mb-2">2. Dinero del Tiempo (Mesas)</label>
                <div className="flex gap-2">
                    <span className="p-3 bg-gray-100 rounded-l-lg font-bold text-gray-500">$</span>
                    <input 
                        type="number" 
                        value={tiempoVal} 
                        onChange={e => setTiempoVal(e.target.value)} 
                        className="w-full p-3 border rounded-r-lg font-bold text-lg text-indigo-900 relative z-10"
                        placeholder="0" 
                    />
                </div>
            </div>

            <div className="fixed bottom-20 left-4 right-4 bg-indigo-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center z-40">
                <div><p className="text-xs opacity-70">Total Físico</p><p className="text-2xl font-black">{formatCurrency(Number(physicalCashCount) || 0)}</p></div>
                <button onClick={handleSaveDaily} className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold shadow-lg">Registrar</button>
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <h3 className="font-bold text-gray-600">Historial Caja</h3>
                <div className="flex gap-2">
                    <button onClick={() => setIsHistoryVisible(prev => !prev)} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs flex items-center border">{isHistoryVisible ? 'Ocultar' : 'Mostrar'}</button>
                </div>
            </div>

            {isHistoryVisible && (
                <div className="space-y-2">
                    {dailyCashInputs.slice(0, 15).map(c => (
                        <div key={c.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-gray-800">{formatDateShort(c.date)}</p>
                                <p className="text-xs text-gray-500">T: {formatCurrency(c.tiempoValue)} | P: <span className="font-semibold">{formatCurrency(calculateProductCash(c))}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-red-600 text-xs">{formatCurrency(c.physicalCashCount)}</span>
                                <button onClick={() => { setEditingCashItem(c); setEditTiempo(c.tiempoValue); setEditPhysicalCash(c.physicalCashCount); setIsEditingCash(true); }} className="text-gray-400 hover:text-indigo-600"><FileText className="h-5 w-5"/></button>
                                <button onClick={() => setConfirmDeleteId(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {isEditingCash && editingCashItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full relative">
                        <button onClick={() => setIsEditingCash(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="h-5 w-5"/></button>
                        <h3 className="font-bold text-lg mb-4">Modificar Caja</h3>
                        <label className="block text-sm text-gray-700 mb-1">Total Físico</label><input type="number" value={editPhysicalCash} onChange={e => setEditPhysicalCash(e.target.value)} className="w-full p-2 border rounded-lg mb-3" />
                        <label className="block text-sm text-gray-700 mb-1">Tiempo</label><input type="number" value={editTiempo} onChange={e => setEditTiempo(e.target.value)} className="w-full p-2 border rounded-lg mb-4" />
                        <div className="flex gap-2">
                            <button onClick={handleEditSave} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Guardar</button>
                            <button onClick={() => setIsEditingCash(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                 <CustomConfirmModal
                    title="Borrar Registro de Caja"
                    message={`¿Estás seguro de que quieres eliminar este registro de caja diario?`}
                    onConfirm={() => handleDeleteCash(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                    confirmText="Borrar Definitivamente"
                />
            )}
        </div>
    );
};

// 5. GASTOS (Editable)
const TransactionsView = ({ transactions, getCollection }) => {
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [type, setType] = useState('Expense');
    
    // Edición
    const [editingTrans, setEditingTrans] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // Estado para confirmación

    const handleSave = async () => {
        if (!amount || !desc) return;
        try {
            await addDoc(getCollection('transactions'), {
                amount: Number(amount), description: desc, type, date: Timestamp.now()
            });
            setAmount(''); setDesc('');
        } catch (e) { console.error(e); }
    };

    const handleDeleteTrans = async (id) => {
        setConfirmDeleteId(null);
        try { await deleteDoc(doc(db, getCollection('transactions').path, id)); } catch(e) { console.error(e); }
    };
    
    const handleUpdateTrans = async () => {
        if(!editingTrans) return;
        try {
            await updateDoc(doc(db, getCollection('transactions').path, editingTrans.id), {
                amount: Number(editingTrans.amount),
                description: editingTrans.description
            });
            setEditingTrans(null);
        } catch(e) { console.error(e); }
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><DollarSign className="mr-2"/> Gastos / Otros Ingresos</h2>
            <div className="bg-white p-5 rounded-xl shadow space-y-3">
                <div className="flex gap-2 mb-2">
                    <button onClick={() => setType('Expense')} className={`flex-1 py-2 rounded-lg font-bold ${type === 'Expense' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-400'}`}>Gasto</button>
                    <button onClick={() => setType('Income')} className={`flex-1 py-2 rounded-lg font-bold ${type === 'Income' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400'}`}>Ingreso Extra</button>
                </div>
                <input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 border rounded-xl" />
                <input type="text" placeholder="Descripción" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-3 border rounded-xl" />
                <button onClick={handleSave} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold">Guardar</button>
            </div>

            <div className="space-y-2">
                <h3 className="font-bold text-gray-600">Historial (Editable)</h3>
                {transactions.slice(0, 10).map(t => (
                    <div key={t.id} className={`p-3 rounded-lg border flex justify-between ${t.type === 'Expense' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                        <div>
                            <p className="font-bold text-gray-800">{t.description}</p>
                            <p className="text-xs text-gray-500">{formatDateShort(t.date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold ${t.type === 'Expense' ? 'text-red-600' : 'text-green-600'}`}>
                                {t.type === 'Expense' ? '-' : '+'}{formatCurrency(t.amount)}
                            </span>
                             <button onClick={() => setEditingTrans(t)} className="text-gray-400 hover:text-indigo-600"><FileText className="h-5 w-5"/></button>
                             <button onClick={() => setConfirmDeleteId(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5"/></button>
                        </div>
                    </div>
                ))}
            </div>

             {/* Modal Edición Transacción */}
             {editingTrans && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">Editar Movimiento</h3>
                        <label className="text-xs font-bold text-gray-500">Descripción</label>
                        <input type="text" value={editingTrans.description} onChange={e=>setEditingTrans({...editingTrans, description: e.target.value})} className="w-full p-2 border rounded mb-2" />
                        <label className="text-xs font-bold text-gray-500">Monto</label>
                        <input type="number" value={editingTrans.amount} onChange={e=>setEditingTrans({...editingTrans, amount: e.target.value})} className="w-full p-2 border rounded mb-4" />
                        <div className="flex gap-2">
                            <button onClick={handleUpdateTrans} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Actualizar</button>
                            <button onClick={()=>setEditingTrans(null)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                 <CustomConfirmModal
                    title="Borrar Movimiento"
                    message={`¿Estás seguro de que quieres eliminar este gasto/ingreso de ${formatCurrency(transactions.find(t=>t.id===confirmDeleteId)?.amount || 0)}?`}
                    onConfirm={() => handleDeleteTrans(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                    confirmText="Borrar Definitivamente"
                />
            )}
        </div>
    );
};

// 6. DETALLE DE CORTE (Historial)
const CutDetailView = ({ selectedCut, setSelectedCut, setView }) => {
    if (!selectedCut) return <div className="p-4">No hay corte seleccionado.</div>;
    const breakdown = selectedCut.productBreakdown || [];
    const handleExportDetail = () => {
        // Preparar datos para CSV (ya existe)
        const dataToExport = breakdown.map(p => ({
            Producto: p.name, StockAlMomento: p.stockAtCut, Entradas: p.inflows, Vendidos: p.sold, VentaTotal: p.revenue, Ganancia: p.profit
        }));
        exportToCSV(dataToExport, ['Producto', 'StockAlMomento', 'Entradas', 'Movimientos', 'VentaTotal', 'Ganancia'], `Detalle_Corte_${formatDateShort(selectedCut.cutDate)}`);
    };

    return (
        <div className="p-4 pb-24">
            <button onClick={() => setView('pl_report')} className="mb-4 text-indigo-600 font-bold flex items-center"><ArrowLeft className="mr-1 h-4 w-4" /> Volver a Reportes</button>
            <div className="flex justify-between items-start mb-4">
                <div><h2 className="text-xl font-bold text-gray-800 flex items-center"><ListChecks className="mr-2" /> Detalle de Corte</h2><p className="text-sm text-gray-500">{formatDateShort(selectedCut.startDate)} - {formatDateShort(selectedCut.endDate)}</p></div>
                <button onClick={handleExportDetail} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center border border-green-200 shadow-sm"><Download className="h-4 w-4 mr-1"/> CSV</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-indigo-50 text-indigo-900 font-bold">
                            <tr><th className="p-3">Producto</th><th className="p-3 text-center">Entr.</th><th className="p-3 text-center">Mov.</th><th className="p-3 text-right">Venta</th><th className="p-3 text-right">Gana</th><th className="p-3 text-center">Stock</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {breakdown.length === 0 ? (<tr><td colSpan="6" className="p-4 text-center text-gray-500">No hay detalles.</td></tr>) : (breakdown.map((item, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 font-medium text-gray-800">{item.name}</td><td className="p-3 text-center text-blue-600">{item.inflows > 0 ? `+${item.inflows}` : '-'}</td><td className={`p-3 text-center font-bold ${item.sold < 0 ? 'text-green-600' : 'text-red-600'}`}>{item.sold}</td><td className="p-3 text-right">{formatCurrency(item.revenue)}</td><td className="p-3 text-right text-green-600 font-semibold">{formatCurrency(item.profit)}</td><td className="p-3 text-center text-gray-500">{item.stockAtCut}</td></tr>)))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// 7. VISTA DE CORTE NUEVO (Reconciliación y Limpieza)
const ReportsView = ({ data, getCollection, userId, setView, setSelectedCut }) => {
    const { sales, dailyCashInputs, transactions, stockInflows, products, cutsHistory } = data;
    
    const today = new Date().toISOString().split('T')[0];
    
    const lastCut = cutsHistory.length > 0 ? cutsHistory[0] : null;
    let defaultStart = new Date();
    if (lastCut) {
        defaultStart = lastCut.endDate.toDate ? lastCut.endDate.toDate() : new Date(lastCut.endDate);
    } else {
        defaultStart.setDate(defaultStart.getDate() - 14);
    }
    const defaultStartStr = defaultStart.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStartStr);
    const [endDate, setEndDate] = useState(today);
    const [isSavingCut, setIsSavingCut] = useState(false);
    const [finalNominaInput, setFinalNominaInput] = useState('');
    const [message, setMessage] = useState('');

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
        const totalPhysicalProductCash = fCash.reduce((sum, c) => sum + ((c.physicalCashCount || 0) - (c.tiempoValue || 0)), 0);
        const diff = totalPhysicalProductCash - totalRevenueProduct;
        
        // CORRECCIÓN SOLICITADA:
        // Nomina sugerida = Valor Tiempo + 3% del DINERO FÍSICO DE PRODUCTOS (no de la venta sistema)
        const suggestedNomina = totalTiempo + (totalPhysicalProductCash * 0.03); 
        
        const otherIncome = fTrans.filter(t => t.type === 'Income').reduce((sum, e) => sum + e.amount, 0);
        const expenses = fTrans.filter(t => t.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);

        const breakdown = products.map(prod => {
            const pSales = fSales.filter(s => s.productId === prod.id);
            const pInflows = fInflows.filter(i => i.productId === prod.id);
            const soldQty = pSales.reduce((sum, s) => sum + s.quantity, 0);
            const revenue = pSales.reduce((sum, s) => sum + s.amount, 0);
            const cogs = pSales.reduce((sum, s) => sum + s.cogs, 0);
            const inflowsQty = pInflows.reduce((sum, i) => sum + i.quantity, 0);

            return { id: prod.id, name: prod.name, stockAtCut: prod.stock, inflows: inflowsQty, sold: soldQty, revenue: revenue, profit: revenue - cogs };
        }).filter(p => p.sold !== 0 || p.inflows > 0); 

        return { totalRevenueProduct, totalCogs, totalPhysicalProductCash, diff, suggestedNomina, totalTiempo, otherIncome, expenses, dailyCashCount: fCash.length, salesCount: fSales.length, productBreakdown: breakdown };
    }, [sales, dailyCashInputs, transactions, stockInflows, products, startTimestamp, endTimestamp]);

    const handleSaveCut = async () => {
        const m = reportMetrics;
        if (!m.dailyCashCount) { setMessage('Error: No hay registros de caja para este periodo.'); return; }
        if (!finalNominaInput || Number(finalNominaInput) <= 0) { setMessage('Ingrese un valor de Nómina válido.'); return; }

        let cashAdjustment = m.diff < 0 ? Math.abs(m.diff) : 0;
        const actualNominaPaid = Number(finalNominaInput) - cashAdjustment;

        const cutData = {
            startDate: startTimestamp, endDate: endTimestamp, cutDate: Timestamp.now(), createdBy: userId,
            reconciliationDifference: m.diff, totalPhysicalProductCash: m.totalPhysicalProductCash,
            totalRevenueProduct: m.totalRevenueProduct, totalCogs: m.totalCogs,
            totalOtherIncome: m.otherIncome, totalExpenses: m.expenses, totalTiempo: m.totalTiempo,
            suggestedNomina: m.suggestedNomina, inputtedNomina: Number(finalNominaInput),
            cashAdjustment, actualNominaPaid, productBreakdown: m.productBreakdown
        };

        try {
            const docRef = await addDoc(getCollection('cuts_history'), cutData);
            setMessage('✅ Corte guardado. Se ha limpiado la vista para el nuevo periodo.'); 
            setIsSavingCut(false); 
            setFinalNominaInput('');
            setSelectedCut({ id: docRef.id, ...cutData });
            
            // Limpiar mensaje después de un tiempo
            setTimeout(() => setMessage(''), 5000);

            // Cambiar a vista de detalle del corte
            setView('cut_detail');
        } catch (e) { 
            console.error(e); 
            setMessage('❌ Error al guardar el corte.');
            setTimeout(() => setMessage(''), 5000);
        }
    };

    // Función específica para exportar el detalle del corte a Excel
    const handleExportCutDetailXLSX = (cut) => {
        if (!cut || !cut.productBreakdown) return;
        
        // Mapear los datos a la estructura solicitada
        const dataToExport = cut.productBreakdown.map(item => ({
            'Producto': item.name,
            'Entradas (Unidades)': item.inflows,
            'Stock Final (Unidades)': item.stockAtCut,
            'Cantidad Vendida': item.sold,
            'Venta Total ($)': item.revenue, // Ingresos totales de ese producto
            'Ganancia Generada ($)': item.profit
        }));

        exportToXLSX(dataToExport, `Reporte_Corte_${formatDateShort(cut.cutDate).replace(/\//g, '-')}`);
    };

    const renderDiff = () => {
        const d = reportMetrics.diff || 0;
        const color = d >= 0 ? 'text-green-700 border-green-500 bg-green-50' : 'text-red-700 border-red-500 bg-red-50';
        return (
            <div className={`p-4 rounded-xl shadow border-l-4 ${color} flex justify-between items-center`}>
                <div><p className="font-bold">Diferencia</p><p className="text-2xl font-black">{formatCurrency(Math.abs(d))} {d>=0?'(Sobra)':'(Falta)'}</p></div>
                {d < 0 && <AlertTriangle className="h-8 w-8 opacity-50"/>}
            </div>
        );
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><FileText className="mr-2" /> Nuevo Corte / Arqueo</h2>
            {message && <div className={`p-2 rounded text-sm font-bold ${message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</div>}

            <div className="bg-white p-4 rounded-xl shadow space-y-3">
                <p className="text-sm font-semibold text-gray-500">Periodo a Evaluar (Automático tras último corte):</p>
                <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border rounded"/>
                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border rounded"/>
                </div>
            </div>

            {reportMetrics.totalRevenueProduct !== undefined && (
                <div className="space-y-4">
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
                    {renderDiff()}

                    <div className="bg-white p-4 rounded-xl shadow space-y-3 border-2 border-pink-100">
                        <p className="text-sm font-semibold text-gray-600">Nómina Sugerida: {formatCurrency(reportMetrics.suggestedNomina)}</p>
                        <input type="number" placeholder="Valor a Pagar de Nómina" value={finalNominaInput} onChange={e=>setFinalNominaInput(e.target.value)} className="w-full p-2 border rounded"/>
                        <button onClick={()=>setIsSavingCut(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Guardar Corte</button>
                    </div>
                    
                    {isSavingCut && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                                <h3 className="font-bold text-lg mb-2">¿Confirmar y Guardar Corte?</h3>
                                <p className="text-sm text-gray-600 mb-4">Se guardará el reporte y el sistema estará listo para el siguiente periodo. Asegúrese de que el stock físico de los productos esté cuadrado antes de guardar.</p>
                                <div className="flex gap-2">
                                    <button onClick={handleSaveCut} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Confirmar</button>
                                    <button onClick={()=>setIsSavingCut(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancelar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Nueva Sección: Historial de Cortes */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center border-t pt-4">
                    <ListChecks className="mr-2" /> Historial de Cortes Anteriores
                </h3>
                {cutsHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No hay cortes registrados aún.</p>
                ) : (
                    <div className="space-y-3">
                        {cutsHistory.map((cut) => (
                            <div key={cut.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <p className="font-bold text-gray-800">Corte del {formatDateShort(cut.cutDate)}</p>
                                    <p className="text-xs text-gray-500">
                                        Periodo: {formatDateShort(cut.startDate)} - {formatDateShort(cut.endDate)}
                                    </p>
                                    <p className="text-xs font-semibold text-indigo-600 mt-1">
                                        Venta Total: {formatCurrency(cut.totalRevenueProduct)}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleExportCutDetailXLSX(cut)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow transition w-full sm:w-auto justify-center"
                                >
                                    <Download className="h-4 w-4 mr-2"/> Reporte Excel (.xls)
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// 8. P&L
const PLView = ({ cutsHistory, setView, setSelectedCut }) => {
    const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());
    const annualData = useMemo(() => {
        const year = Number(targetYear);
        const filtered = cutsHistory.filter(c => c.cutDate.toDate().getFullYear() === year);
        const stats = { netRevenue:0, cogs:0, nomina:0, other:0, time:0, exp:0, profit:0 };
        filtered.forEach(c => {
            stats.netRevenue += c.totalRevenueProduct||0; stats.cogs += c.totalCogs||0; stats.nomina += c.actualNominaPaid||0;
            stats.other += c.totalOtherIncome||0; stats.time += c.totalTiempo||0; stats.exp += c.totalExpenses||0;
        });
        stats.profit = (stats.netRevenue - stats.cogs) + stats.other + stats.time - stats.exp - stats.nomina;
        return { stats, cuts: filtered.sort((a,b)=>b.cutDate.toMillis()-a.cutDate.toMillis()) };
    }, [cutsHistory, targetYear]);

    // Función para exportar los datos del P&L a Excel
    const handleExportXLSX = () => {
        const { stats, cuts } = annualData;
        const year = Number(targetYear);

        // 1. Crear la data para la tabla de Resumen Anual
        const summaryData = [
            { 'Métrica': 'GANANCIA NETA TOTAL', 'Valor': stats.profit },
            { 'Métrica': '--------------------', 'Valor': '---' },
            { 'Métrica': 'Ingreso Neto Productos (Venta - COGS)', 'Valor': stats.netRevenue - stats.cogs },
            { 'Métrica': 'Costo de Venta (COGS)', 'Valor': stats.cogs },
            { 'Métrica': 'Ingreso Extra', 'Valor': stats.other },
            { 'Métrica': 'Ingreso por Tiempo/Mesas', 'Valor': stats.time },
            { 'Métrica': 'Gastos Operacionales', 'Valor': stats.exp * -1 },
            { 'Métrica': 'Nómina Pagada', 'Valor': stats.nomina * -1 },
        ];
        
        // 2. Crear la data para la tabla de Detalle de Cortes
        const cutsData = cuts.map(c => ({
            'ID_Corte': c.id.slice(0, 8),
            'Fecha_Corte': formatDateShort(c.cutDate),
            'Inicio_Periodo': formatDateShort(c.startDate),
            'Fin_Periodo': formatDateShort(c.endDate),
            'Venta_Sistema': c.totalRevenueProduct,
            'Caja_Fisico': c.totalPhysicalProductCash,
            'Diferencia': c.reconciliationDifference,
            'COGS': c.totalCogs,
            'Ingreso_Tiempo': c.totalTiempo,
            'Ingreso_Extra': c.totalOtherIncome,
            'Gastos': c.totalExpenses,
            'Nomina_Pagada': c.actualNominaPaid,
            'Ganancia_Neta_Corte': (c.totalRevenueProduct - c.totalCogs) + c.totalOtherIncome + c.totalTiempo - c.totalExpenses - c.actualNominaPaid,
        }));
        
        // Combinar ambas estructuras en un solo array para la exportación XML
        const exportArray = [
            { 'Métrica': `REPORTE P&L ANUAL ${year}`, 'Valor': '', 'ID_Corte': '', 'Fecha_Corte': '', 'Inicio_Periodo': '', 'Fin_Periodo': '', 'Venta_Sistema': '', 'Caja_Fisico': '', 'Diferencia': '', 'COGS': '', 'Ingreso_Tiempo': '', 'Ingreso_Extra': '', 'Gastos': '', 'Nomina_Pagada': '', 'Ganancia_Neta_Corte': '' },
            ...summaryData.map(d => ({ 
                'Métrica': d.Métrica, 
                'Valor': d.Valor, 
                'ID_Corte': '', 'Fecha_Corte': '', 'Inicio_Periodo': '', 'Fin_Periodo': '', 'Venta_Sistema': '', 'Caja_Fisico': '', 'Diferencia': '', 'COGS': '', 'Ingreso_Tiempo': '', 'Ingreso_Extra': '', 'Gastos': '', 'Nomina_Pagada': '', 'Ganancia_Neta_Corte': ''
            })),
            { 'Métrica': '', 'Valor': '', 'ID_Corte': '', 'Fecha_Corte': '', 'Inicio_Periodo': '', 'Fin_Periodo': '', 'Venta_Sistema': '', 'Caja_Fisico': '', 'Diferencia': '', 'COGS': '', 'Ingreso_Tiempo': '', 'Ingreso_Extra': '', 'Gastos': '', 'Nomina_Pagada': '', 'Ganancia_Neta_Corte': '' },
            { 'Métrica': 'DETALLE DE CORTES', 'Valor': '', 'ID_Corte': '', 'Fecha_Corte': '', 'Inicio_Periodo': '', 'Fin_Periodo': '', 'Venta_Sistema': '', 'Caja_Fisico': '', 'Diferencia': '', 'COGS': '', 'Ingreso_Tiempo': '', 'Ingreso_Extra': '', 'Gastos': '', 'Nomina_Pagada': '', 'Ganancia_Neta_Corte': '' },
            ...cutsData
        ];

        // Usar un array que solo contenga las columnas que realmente necesitamos en el orden deseado
        // Esto simplifica la lógica del XML y garantiza que Excel entienda la estructura de la tabla.
        // Nos enfocaremos en exportar el detalle de cortes para la tabla de Excel.
        exportToXLSX(cutsData, `Reporte_PL_Anual_${year}`);
    };

    return (
        <div className="p-4 pb-24 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center"><BarChart3 className="mr-2" /> Reportes & P&L</h2>
                <button onClick={handleExportXLSX} className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center shadow-lg hover:bg-green-700 transition">
                    <Download className="h-4 w-4 mr-1"/> Exportar a Excel (.xls)
                </button>
            </div>
            <div className="bg-indigo-600 p-4 rounded-xl shadow-xl text-white">
                <p className="text-sm font-medium opacity-80">Ganancia Neta Año {targetYear}</p>
                <p className="text-4xl font-extrabold">{formatCurrency(annualData.stats.profit)}</p>
            </div>
            <div className="space-y-3">
                {annualData.cuts.map(cut => (
                    <div key={cut.id} className="bg-white p-3 rounded-xl shadow border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div><p className="font-bold text-indigo-900">{cut.cutDate.toDate().toLocaleDateString('es-CO')}</p><p className="text-xs text-gray-500">Período: {formatDateShort(cut.startDate)} - {formatDateShort(cut.endDate)}</p></div>
                            <button onClick={() => { setSelectedCut(cut); setView('cut_detail'); }} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center"><Search className="h-3 w-3 mr-1"/> Ver Detalle</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 9. CONFIGURACIÓN Y RESET
const SettingsView = ({ getCollection, userId, user }) => {
    const [isResetting, setIsResetting] = useState(false);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false); // NUEVO ESTADO para el modal
    const [resetMessage, setResetMessage] = useState('');

    const handleConfirmAndReset = async () => {
        setResetMessage('');
        setIsConfirmingReset(false);
        setIsResetting(true);
        try {
            const collectionsToClear = ['sales', 'daily_cash', 'transactions', 'stock_inflows', 'cuts_history', 'products'];
            
            for (const colName of collectionsToClear) {
                const colRef = getCollection(colName);
                if (!colRef) continue;
                // Obtener todos los documentos
                const snapshot = await getDocs(colRef);
                // Mapear promesas de borrado
                const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                // Ejecutar todas las promesas en paralelo
                await Promise.all(deletePromises);
            }
            setResetMessage("✅ Sistema reiniciado con éxito. Todos los datos han sido borrados.");
        } catch (e) {
            console.error("Error al reiniciar el sistema:", e);
            setResetMessage(`❌ Error al reiniciar: ${e.message || 'Verifique la consola.'}`);
        } finally {
            setIsResetting(false);
            setTimeout(() => setResetMessage(''), 5000); // Limpiar mensaje después de 5s
        }
    };

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><Settings className="mr-2"/> Configuración</h2>
            
            {resetMessage && ( // Mostrar mensaje de éxito/error
                <div className={`p-3 rounded-lg font-bold ${resetMessage.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {resetMessage}
                </div>
            )}

            <div className="bg-white p-5 rounded-xl shadow border border-red-200">
                <h3 className="font-bold text-red-600 flex items-center"><AlertTriangle className="mr-2"/> Zona de Peligro</h3>
                <p className="text-sm text-gray-600 mt-2 mb-4">Utiliza esta opción si deseas eliminar **todos los datos de la aplicación** (productos, ventas, historial) para empezar de cero. ¡Esta acción es irreversible!</p>
                
                <button 
                    onClick={() => setIsConfirmingReset(true)} // Activa el modal
                    disabled={isResetting}
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-red-700 transition flex justify-center items-center"
                >
                    {isResetting ? 'Borrando...' : <><RefreshCw className="mr-2"/> REINICIAR SISTEMA COMPLETO</>}
                </button>
            </div>
            
            <div className="text-center text-xs text-gray-400 mt-10">
                App ID: {appId} <br/> User: {user?.uid}
            </div>

            {/* Modal de Confirmación para el Reset (El fix al error reportado) */}
            {isConfirmingReset && (
                 <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                        <h3 className="font-bold text-xl mb-3 text-red-700 flex items-center"><AlertTriangle className="mr-2 h-6 w-6"/> ¡ADVERTENCIA CRÍTICA!</h3>
                        <p className="text-sm text-gray-600 mb-4">Estás a punto de **ELIMINAR PERMANENTEMENTE TODA LA INFORMACIÓN** (Inventario, Ventas, Caja, Reportes). ¡Esta acción es irreversible y afectará a todos los usuarios de la aplicación!</p>
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleConfirmAndReset} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700">BORRAR TODO</button>
                            <button onClick={() => setIsConfirmingReset(false)} className="flex-1 bg-gray-300 py-3 rounded-lg font-bold hover:bg-gray-400">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ------------------------------------
// COMPONENTE PRINCIPAL (APP)
// ------------------------------------
const App = () => {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('cash_input');
    const [loading, setLoading] = useState(true);
    const [selectedCut, setSelectedCut] = useState(null);

    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [dailyCashInputs, setDailyCashInputs] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [stockInflows, setStockInflows] = useState([]);
    const [cutsHistory, setCutsHistory] = useState([]);

    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        };
        initAuth();
        return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    }, []);

    // FUNCIÓN CRÍTICA: Define la ubicación de la base de datos (compartida).
    const getCollection = (colName) => {
        if (!user) return null;
        return collection(db, 'artifacts', appId, 'public', 'data', colName);
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const unsubs = [];
        const createSub = (colName, orderField, setState) => {
            const colRef = getCollection(colName);
            if (!colRef) return; 
            
            const q = query(colRef); 
            return onSnapshot(q, (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const sortedList = list.sort((a, b) => {
                    const aTime = a[orderField]?.toMillis ? a[orderField].toMillis() : 0;
                    const bTime = b[orderField]?.toMillis ? b[orderField].toMillis() : 0;
                    return bTime - aTime; 
                });
                setState(sortedList);
            }, (err) => console.error(`Error ${colName}`, err));
        };

        const productsRef = getCollection('products');
        if (productsRef) {
            unsubs.push(onSnapshot(productsRef, (snap) => {
                const sortedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
                    const codeA = a.code ? String(a.code).toUpperCase() : '';
                    const codeB = b.code ? String(b.code).toUpperCase() : '';
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                });
                setProducts(sortedProducts);
            }));
        }

        unsubs.push(createSub('sales', 'date', setSales));
        unsubs.push(createSub('daily_cash', 'date', setDailyCashInputs));
        unsubs.push(createSub('transactions', 'date', setTransactions));
        unsubs.push(createSub('stock_inflows', 'date', setStockInflows));
        unsubs.push(createSub('cuts_history', 'cutDate', setCutsHistory));

        setLoading(false);
        return () => unsubs.forEach(u => u && u()); 
    }, [user]);

    const renderContent = () => {
        if (loading) return <div className="p-10 text-center text-gray-500">Cargando sistema...</div>;
        if (!user) return <div className="p-10 text-center text-red-500">Error de autenticación.</div>;

        const fullData = { products, sales, dailyCashInputs, transactions, stockInflows, cutsHistory };

        switch (view) {
            case 'inventory': return <InventoryView products={products} userId={user.uid} getCollection={getCollection} />;
            case 'stock_inflow': return <StockInflowView products={products} getCollection={getCollection} stockInflows={stockInflows} />;
            case 'stock_outflow': return <InventoryCountView products={products} getCollection={getCollection} sales={sales} />;
            case 'cash_input': return <CashInputView getCollection={getCollection} dailyCashInputs={dailyCashInputs} />;
            case 'reports': return <ReportsView data={fullData} getCollection={getCollection} userId={user.uid} setView={setView} setSelectedCut={setSelectedCut} />;
            case 'pl_report': return <PLView cutsHistory={cutsHistory} setView={setView} setSelectedCut={setSelectedCut} />;
            case 'cut_detail': return <CutDetailView selectedCut={selectedCut} setSelectedCut={setSelectedCut} setView={setView} />;
            case 'transactions': return <TransactionsView transactions={transactions} getCollection={getCollection} />;
            case 'settings': return <SettingsView getCollection={getCollection} userId={user.uid} user={user} />;
            default: return <CashInputView getCollection={getCollection} dailyCashInputs={dailyCashInputs} />;
        }
    };

    const NavItem = ({ name, icon: Icon, label }) => (
        <button onClick={()=>setView(name)} className={`flex flex-col items-center p-2 min-w-[50px] transition-colors ${view===name?'text-indigo-600':'text-gray-400 hover:text-gray-600'}`}>
            <Icon className="h-6 w-6"/><span className="text-[10px] font-bold mt-1">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <header className="bg-indigo-700 p-4 shadow-lg text-white sticky top-0 z-30 flex justify-between items-center">
                <div><h1 className="text-lg font-extrabold">Billares El Chalan</h1><p className="text-xs opacity-75">ID: {user?.uid?.slice(0,5)}...</p></div>
                <button onClick={() => setView('settings')} className="bg-indigo-800 p-2 rounded-full hover:bg-indigo-600 transition"><Settings className="h-5 w-5"/></button>
            </header>
            <main className="max-w-2xl mx-auto">{renderContent()}</main>
            <nav className="fixed bottom-0 w-full bg-white border-t flex justify-between px-2 py-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] overflow-x-auto z-50">
                <NavItem name="inventory" icon={Package} label="Inv" />
                <NavItem name="stock_inflow" icon={ArrowUp} label="Entrar" />
                <NavItem name="stock_outflow" icon={ClipboardCheck} label="Cierre" />
                <NavItem name="cash_input" icon={Coins} label="Caja" />
                <NavItem name="reports" icon={Scale} label="Corte" />
                <NavItem name="pl_report" icon={BarChart3} label="P&L" />
                <NavItem name="transactions" icon={DollarSign} label="Gastos" />
            </nav>
        </div>
    );
};

export default App;
