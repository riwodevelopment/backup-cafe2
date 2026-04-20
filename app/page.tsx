"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  serverTimestamp, updateDoc, doc, setDoc 
} from "firebase/firestore";

function OrderContent() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table") || "未設定";

  const [tableData, setTableData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [label, setLabel] = useState<string>("読み込み中...");
  const [isOrderDisabled, setIsOrderDisabled] = useState<boolean>(false);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  const LO_HOUR = 21;
  const LO_MINUTE = 30;
  const CLOSE_HOUR = 22;

  // メニューデータ（プラン出し分け対応）
  const menuList = [
    { id: "1", name: "コーラ", description: "定番のコカ・コーラです。", plans: ["Standard", "Beer", "Premium"] },
    { id: "2", name: "カルピス", description: "爽やかな甘さのカルピスです。", options: ["ソーダ割り", "水割り"], plans: ["Standard", "Beer", "Premium"] },
    { id: "3", name: "生ビール", description: "冷えた生ビールです。", plans: ["Beer", "Premium"] },
    { id: "4", name: "プレミアムカクテル", description: "特別な一杯です。", plans: ["Premium"] },
  ];

  // 1. テーブルの状態を監視
  useEffect(() => {
    if (tableId === "未設定") return;
    const unsubscribe = onSnapshot(doc(db, "tables", `table_${tableId}`), (docSnap) => {
      if (docSnap.exists()) {
        setTableData(docSnap.data());
      } else {
        setTableData({ status: "unselected" });
      }
    });
    return () => unsubscribe();
  }, [tableId]);

  // 2. プラン確定処理
  const selectPlan = async (planName: string) => {
    if (!confirm(`${planName}プランで確定しますか？\n※一度選ぶと変更できません。`)) return;
    await setDoc(doc(db, "tables", `table_${tableId}`), {
      tableNumber: tableId,
      currentPlan: planName,
      status: "active",
      startTime: serverTimestamp(),
    });
  };

  // 3. 時間管理
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const loTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), LO_HOUR, LO_MINUTE, 0);
      const closeTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CLOSE_HOUR, 0, 0);

      if (now < loTime) {
        setLabel("ラストオーダーまで");
        setTimeLeft(calculateTimeDiff(now, loTime));
        setIsOrderDisabled(false);
      } else if (now < closeTime) {
        setLabel("閉店まで（注文終了）");
        setTimeLeft(calculateTimeDiff(now, closeTime));
        setIsOrderDisabled(true);
      } else {
        setLabel("営業終了");
        setIsOrderDisabled(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. 履歴取得
  useEffect(() => {
    if (tableId === "未設定") return;
    const q = query(
      collection(db, "orders"),
      where("tableNumber", "==", tableId),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrderHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [tableId]);

  const calculateTimeDiff = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    return `${Math.floor((diff / (1000 * 60)) % 60)}分${Math.floor((diff / 1000) % 60)}秒`;
  };

  const confirmOrder = async () => {
    if (!selectedItem || isOrderDisabled || !tableData?.currentPlan) return;
    if (selectedItem.options && !selectedOption) {
      alert("種類を選択してください！");
      return;
    }
    try {
      await addDoc(collection(db, "orders"), {
        tableNumber: tableId,
        item: selectedItem.name,
        option: selectedOption || "なし",
        quantity: quantity,
        status: "ordered",
        plan: tableData.currentPlan,
        timestamp: serverTimestamp(),
      });
      setSelectedItem(null);
      setQuantity(1);
      setSelectedOption("");
    } catch (e) {
      alert("注文に失敗しました");
    }
  };

  // --- 表示切り替え ---

  if (tableId === "未設定") {
    return <div className="min-h-screen flex items-center justify-center p-8 text-center font-bold text-gray-400">QRコードをもう一度読み取ってください。</div>;
  }

  if (!tableData || tableData.status === "unselected") {
    return (
      <main className="min-h-screen bg-white p-6 flex flex-col justify-center max-w-md mx-auto">
        <h1 className="text-3xl font-black text-gray-800 mb-2">{tableId}番卓</h1>
        <p className="text-gray-500 mb-8 font-bold text-sm">ご利用のプランを選択してください</p>
        <div className="space-y-4">
          {["Standard", "Beer", "Premium"].map((p) => (
            <button key={p} onClick={() => selectPlan(p)} className="w-full py-6 rounded-2xl border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-xl font-black text-gray-700 shadow-sm active:scale-95">
              {p === "Standard" ? "スタンダード" : p === "Beer" ? "生ビール付き" : "プレミアム"}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* テーブル情報表示 */}
      <div className="max-w-md mx-auto mb-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">{tableData.currentPlan} Plan</span>
        <span className="text-lg font-black text-gray-800">{tableId} 番卓</span>
      </div>

      {/* カウントダウン */}
      <div className={`sticky top-0 z-10 p-4 rounded-xl shadow-md mb-6 text-white text-center transition-all ${isOrderDisabled ? 'bg-red-500 shadow-red-200' : 'bg-orange-500 shadow-orange-200'}`}>
        <p className="text-xs font-bold opacity-80">{label}</p>
        <p className="text-3xl font-black tabular-nums">{timeLeft}</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-800 px-1">ドリンクメニュー</h1>
        
        {/* プランに合わせて出し分け */}
        {menuList.filter(item => item.plans.includes(tableData.currentPlan)).map((item) => (
          <button key={item.id} onClick={() => setSelectedItem(item)} disabled={isOrderDisabled} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-95 transition-all disabled:opacity-50">
            <span className="font-bold text-gray-700">{item.name}</span>
            <span className="text-orange-500 text-sm font-bold">詳細・注文 ＞</span>
          </button>
        ))}

        {/* 注文履歴（完全復活！） */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-800 mb-4 px-1 font-black">注文履歴</h2>
          <div className="space-y-3">
            {orderHistory.length === 0 ? (
              <p className="text-gray-400 text-sm italic text-center py-4">まだ注文はありません</p>
            ) : (
              orderHistory.map((log) => (
                <div key={log.id} className={`bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center transition-all ${log.status === 'cancelled' ? 'opacity-40 grayscale' : 'border-gray-100'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-700">{log.item}</p>
                      {log.status === 'completed' && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">提供済み</span>}
                      {log.status === 'ordered' && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">調理中</span>}
                      {log.status === 'cancelled' && <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">取消済</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium">種類: {log.option} / {log.quantity}個</p>
                  </div>
                  {log.status === 'ordered' && (
                    <button onClick={async () => { if(confirm("この注文を取り消しますか？")) await updateDoc(doc(db, "orders", log.id), { status: "cancelled" }); }} className="text-[11px] font-bold text-red-500 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg active:bg-red-100 transition-colors">取消</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 詳細モーダル（完全復活！） */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-gray-800 mb-2">{selectedItem.name}</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed font-medium">{selectedItem.description}</p>
            
            {selectedItem.options && (
              <div className="mb-8">
                <p className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider">種類を選択してください</p>
                <div className="flex gap-2">
                  {selectedItem.options.map((opt: string) => ( // 型指定反映済み！
                    <button
                      key={opt}
                      onClick={() => setSelectedOption(opt)}
                      className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${selectedOption === opt ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-100 text-gray-400"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-10 bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100">
              <p className="font-black text-gray-800">注文数</p>
              <div className="flex items-center gap-8">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-3xl font-black text-orange-500 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm active:scale-90 transition-transform">-</button>
                <span className="text-2xl font-black text-gray-900 w-6 text-center tabular-nums">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="text-3xl font-black text-orange-500 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm active:scale-90 transition-transform">+</button>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => { setSelectedItem(null); setQuantity(1); setSelectedOption(""); }} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold active:bg-gray-200 transition-colors">閉じる</button>
              <button onClick={confirmOrder} className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 active:scale-95 transition-all">注文を確定する</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Loading...</div>}>
      <OrderContent />
    </Suspense>
  );
}