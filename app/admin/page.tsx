"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, updateDoc, 
  doc, setDoc, deleteDoc, increment, getDocs, writeBatch 
} from "firebase/firestore";
import XLSX from "xlsx-js-style";

export default function AdminPage() {
  // --- 状態管理 ---
  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [activeTableNum, setActiveTableNum] = useState<string | null>(null);
  const [localDelivered, setLocalDelivered] = useState<string[]>([]);

  // --- データ取得 ---
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "tables"), orderBy("tableNumber", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- モーダル制御 ---
  const closeModal = () => {
    setActiveTableNum(null);
    setLocalDelivered([]);
  };

  // --- Excel出力 (画像のデザインを反映) ---
  const downloadExcel = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("ja-JP");
    
    // データ作成（1行詰めたスタイル）
    const data = [
      [{ v: `${dateStr} 注文集計レポート`, t: 's' }],
      [{ v: "商品名(オプション)", t: 's' }, { v: "数量", t: 's' }]
    ];

    orders.forEach(o => {
      const displayName = o.option && o.option !== "なし" ? `${o.item}(${o.option})` : o.item;
      const count = o.originalQuantity !== undefined ? o.originalQuantity : o.quantity;
      data.push([{ v: displayName, t: 's' }, { v: count, t: 'n' }]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const range = XLSX.utils.decode_range(worksheet["!ref"]!);

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[addr]) continue;

        worksheet[addr].s = {
          font: { name: "Meiryo", sz: 11 },
          alignment: { vertical: "center", horizontal: "left" },
          border: {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" }
          }
        };

        if (R === 0) { // タイトル
          worksheet[addr].s.font = { bold: true, sz: 14, name: "Meiryo" };
          worksheet[addr].s.alignment.horizontal = "center";
        }
        if (R === 1) { // ヘッダー
          worksheet[addr].s.font.bold = true;
          worksheet[addr].s.fill = { fgColor: { rgb: "F2F2F2" } };
          worksheet[addr].s.alignment.horizontal = "center";
        }
        if (C === 1 && R > 0) { // 数量列
          worksheet[addr].s.alignment.horizontal = "center";
        }
      }
    }

    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    worksheet["!cols"] = [{ wch: 40 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "集計レポート");
    XLSX.writeFile(workbook, `report_${now.toISOString().split('T')[0]}.xlsx`);
  };

  // --- 管理操作 ---
  const clearAllOrders = async () => {
    if (!confirm("履歴をすべて削除しますか？")) return;
    const snap = await getDocs(collection(db, "orders"));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("削除しました");
  };

  const addTable = async () => {
    if (!newTableNumber) return;
    await setDoc(doc(db, "tables", `table_${newTableNumber}`), {
      tableNumber: newTableNumber, status: "unselected", currentPlan: null
    });
    setNewTableNumber("");
  };

  const checkoutTable = async (id: string, tableNum: string) => {
    if (confirm(`${tableNum}番卓を退店させますか？`)) {
      await updateDoc(doc(db, "tables", id), { status: "unselected", currentPlan: null });
      closeModal();
    }
  };

  const deliverOne = async (order: any, rowIndex: number) => {
    const key = `${order.id}-${rowIndex}`;
    if (localDelivered.includes(key)) return;
    setLocalDelivered([...localDelivered, key]);

    const ref = doc(db, "orders", order.id);
    if (order.originalQuantity === undefined) await updateDoc(ref, { originalQuantity: order.quantity });
    if (order.quantity <= 1) await updateDoc(ref, { status: "completed", quantity: 0 });
    else await updateDoc(ref, { quantity: increment(-1) });
  };

  // プランの色分け
  const getPlanColor = (plan: string) => {
    const p = plan?.toUpperCase() || "";
    if (p.includes("STANDARD")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (p.includes("BEER")) return "bg-slate-100 text-slate-700 border-slate-300";
    if (p.includes("PREMIUM")) return "bg-amber-50 text-amber-700 border-amber-300";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 pb-20 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 卓管理 */}
        <section className="bg-white p-6 rounded-2xl shadow-md border border-slate-300">
          <div className="flex justify-between items-center mb-6 font-black">
            <h2 className="text-2xl">卓状況・管理</h2>
            <div className="flex gap-2">
              <input type="text" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="卓番" className="border-2 border-slate-300 rounded-lg px-3 py-2 w-24 outline-none focus:border-blue-500" />
              <button onClick={addTable} className="bg-blue-700 text-white px-6 py-2 rounded-lg text-sm active:scale-95">＋ 卓追加</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map((t) => {
              const pendingItems = orders.filter(o => o.tableNumber === t.tableNumber && o.status === "ordered");
              const totalPendingQty = pendingItems.reduce((sum, o) => sum + (o.quantity || 0), 0);
              return (
                <div key={t.id} onClick={() => t.status === 'active' && setActiveTableNum(t.tableNumber)} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${t.status === 'active' ? 'border-blue-500 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex justify-between items-start mb-4 font-black">
                    <div><span className="text-3xl">{t.tableNumber}</span><span className="text-sm ml-1">番卓</span></div>
                    {t.status === 'active' && <button onClick={(e) => { e.stopPropagation(); checkoutTable(t.id, t.tableNumber); }} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[9px]">退店</button>}
                  </div>
                  <div className="flex flex-col items-center">
                    {t.status === 'active' ? (
                      <>
                        <div className={`px-4 py-1 rounded-full text-sm font-black mb-2 ${totalPendingQty > 0 ? 'bg-orange-500 text-white animate-pulse' : 'bg-green-100 text-green-700'}`}>{totalPendingQty > 0 ? `未提供 ${totalPendingQty} 件` : '完了'}</div>
                        <div className={`mt-1 px-4 py-1 border-2 rounded-xl text-[11px] font-black uppercase ${getPlanColor(t.currentPlan)}`}>{t.currentPlan || "NO PLAN"}</div>
                      </>
                    ) : ( <p className="text-sm text-slate-400 font-bold mt-2">空席</p> )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 注文モニター */}
        <section className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-300">
          <div className="p-6 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-2xl font-black">注文モニター</h2>
            <div className="flex gap-2">
              <button onClick={downloadExcel} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-black text-sm active:scale-95">📑 Excel出力</button>
              <button onClick={clearAllOrders} className="bg-rose-50 border-2 border-rose-200 text-rose-600 px-5 py-2 rounded-xl font-black text-sm active:scale-95">🗑️ 履歴消去</button>
            </div>
          </div>
          <table className="w-full text-left font-black">
            <thead className="bg-slate-800 text-white text-xs uppercase">
              <tr><th className="p-4">卓</th><th className="p-4">商品 / オプション</th><th className="p-4 text-center">数量</th><th className="p-4 text-right">操作</th></tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className={`${order.status === "completed" ? "opacity-50" : "bg-white"}`}>
                  <td className="p-4 text-blue-700 text-xl">{order.tableNumber}</td>
                  <td className="p-4">
                    <p>{order.item}</p>
                    {order.option !== "なし" && <p className="text-[10px] text-orange-600 bg-orange-50 inline-block px-2 py-0.5 rounded mt-1">【{order.option}】</p>}
                  </td>
                  <td className="p-4 text-center"><span className="px-4 py-1 bg-slate-900 text-white rounded-lg text-lg">{order.quantity}</span></td>
                  <td className="p-4 text-right">
                    {order.status === "ordered" && <button onClick={() => deliverOne(order, 0)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm active:scale-95">提供</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* 詳細モーダル */}
      {activeTableNum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border-4 border-blue-500">
            <div className="bg-blue-500 p-6 flex justify-between items-center text-white font-black">
              <h3 className="text-2xl">{activeTableNum} 番卓の未提供</h3>
              <button onClick={closeModal} className="text-3xl">×</button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 font-black">
              {orders.filter(o => o.tableNumber === activeTableNum && o.status === "ordered").length === 0 ? (
                <div className="text-center py-10 text-slate-400">注文なし</div>
              ) : (
                orders.filter(o => o.tableNumber === activeTableNum && o.status === "ordered").map((order) => {
                  const sessionDelCount = localDelivered.filter(id => id.startsWith(order.id)).length;
                  const total = order.quantity + sessionDelCount;
                  return [...Array(total)].map((_, i) => {
                    const key = `${order.id}-${i}`;
                    const isDel = localDelivered.includes(key);
                    return (
                      <div key={key} className={`flex justify-between items-center p-4 rounded-2xl border-2 transition-all ${isDel ? 'opacity-0 h-0 p-0 overflow-hidden border-0' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex-1">
                          <p className="text-lg">{order.item} <span className="text-xs text-slate-400">({i + 1}/{total})</span></p>
                          {order.option !== "なし" && <p className="text-xs text-orange-600">【{order.option}】</p>}
                        </div>
                        <button onClick={() => deliverOne(order, i)} className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm active:scale-90">提供する</button>
                      </div>
                    );
                  });
                })
              )}
            </div>
            <div className="p-6 bg-slate-50"><button onClick={closeModal} className="w-full py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black">閉じる</button></div>
          </div>
        </div>
      )}
    </main>
  );
}