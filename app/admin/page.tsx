"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, updateDoc, increment } from "firebase/firestore";

type Order = { id: string; menu: string; count: number; tableNo: number; timestamp: any };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  // 1. Firestoreから5番テーブルの時間を監視
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "tables", "table5"), (snapshot) => {
      if (snapshot.exists()) {
        setTimeLeft(snapshot.data().timeLeft || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. ★タイマー機能（1分ごとにFirestoreをマイナス1する）
  useEffect(() => {
    // 残り時間が0より大きい時だけタイマーを動かすよ
    if (timeLeft <= 0) return;

    const timer = setInterval(async () => {
      try {
        await updateDoc(doc(db, "tables", "table5"), {
          timeLeft: increment(-1) // Firestoreの数字を直接1減らす魔法の命令！
        });
      } catch (e) {
        console.error("タイマー更新エラー:", e);
      }
    }, 60000); // 60000ミリ秒 = 1分

    return () => clearInterval(timer); // 画面を閉じたらタイマーを止める
  }, [timeLeft]);

  // 3. 注文一覧を監視
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(orderData);
    });
    return () => unsubscribe();
  }, []);

  // 時間を更新する関数
  const updateTableTime = async (newTime: number) => {
    try {
      await setDoc(doc(db, "tables", "table5"), {
        timeLeft: newTime,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const finishOrder = async (id: string) => {
    try { await deleteDoc(doc(db, "orders", id)); } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-8">【事務員向け】管理画面</h1>

      <section className="mb-12 bg-gray-800 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-lg font-bold mb-4 text-orange-400">🕒 5番テーブル 時間管理</h2>
        <div className="flex items-center gap-6">
          <div className={`text-4xl font-mono ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : ''}`}>
            {timeLeft}分
          </div>
          <div className="flex gap-2">
            <button onClick={() => updateTableTime(timeLeft + 10)} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700">+10分</button>
            <button onClick={() => updateTableTime(timeLeft + 30)} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700">+30分</button>
            <button onClick={() => updateTableTime(0)} className="bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700">リセット</button>
          </div>
        </div>
        {timeLeft <= 10 && timeLeft > 0 && (
          <p className="text-red-400 mt-2 text-sm font-bold">！ラストオーダー間近です</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4 text-green-400">📩 届いた注文</h2>
        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.id} className="p-4 rounded-xl flex justify-between items-center bg-white text-gray-800 shadow-sm">
              <div>
                <p className="font-bold">{order.menu} × {order.count}</p>
                <p className="text-xs text-gray-500">テーブル: {order.tableNo}</p>
              </div>
              <button onClick={() => finishOrder(order.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">終了</button>
            </div>
          ))}
          {orders.length === 0 && <p className="text-gray-500 text-center py-10">注文はありません</p>}
        </div>
      </section>
    </div>
  );
}