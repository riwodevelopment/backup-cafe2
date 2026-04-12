"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where, orderBy } from "firebase/firestore";

// 履歴用の型定義
type OrderHistory = { id: string; menu: string; count: number; timestamp: any };

export default function OrderPage() {
  const [menu, setMenu] = useState("アイスコーヒー");
  const [count, setCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [history, setHistory] = useState<OrderHistory[]>([]); // 履歴を保存するステート

  // 1. 5番テーブルの時間を監視
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "tables", "table5"), (snapshot) => {
      if (snapshot.exists()) {
        setTimeLeft(snapshot.data().timeLeft || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 【新機能】自分のテーブルの注文履歴を監視
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("tableNo", "==", 5), // 5番テーブルのデータだけ狙い撃ち
      orderBy("timestamp", "desc") // 新しい順に並べる
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderHistory[];
      setHistory(data);
    });
    return () => unsubscribe();
  }, []);

  const sendOrder = async () => {
    if (timeLeft <= 0) {
      alert("飲み放題終了、または開始前です。");
      return;
    }
    try {
      await addDoc(collection(db, "orders"), {
        menu,
        count,
        tableNo: 5,
        timestamp: serverTimestamp(),
      });
      alert(`${menu}を${count}個、注文しました！`);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white min-h-screen shadow-lg text-gray-800">
      {/* 残り時間表示 */}
      <div className="bg-orange-100 p-4 rounded-xl mb-6 flex justify-between items-center">
        <span className="font-bold">残り時間</span>
        <span className="text-2xl font-mono text-orange-600">{timeLeft}分</span>
      </div>

      {/* 注文フォーム */}
      <section className="mb-10">
        <h1 className="text-xl font-bold mb-4">メニューを選択</h1>
        <select 
          className="w-full p-3 border rounded-lg mb-4 bg-white"
          value={menu} 
          onChange={(e) => setMenu(e.target.value)}
        >
          <option>アイスコーヒー</option>
          <option>ウーロン茶</option>
          <option>ハイボール</option>
          <option>レモンサワー</option>
        </select>

        <div className="flex items-center justify-between mb-8 bg-gray-100 p-4 rounded-xl">
          <span className="font-bold">個数</span>
          <div className="flex items-center gap-6">
            <button onClick={() => setCount(Math.max(1, count - 1))} className="w-10 h-10 bg-white border border-gray-300 rounded-full font-bold">-</button>
            <span className="text-2xl font-black w-6 text-center">{count}</span>
            <button onClick={() => setCount(count + 1)} className="w-10 h-10 bg-white border border-gray-300 rounded-full font-bold">+</button>
          </div>
        </div>

        <button
          onClick={sendOrder}
          disabled={timeLeft <= 0}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition ${
            timeLeft <= 10 ? "bg-red-500" : "bg-orange-500 hover:bg-orange-600"
          } ${timeLeft <= 0 ? "bg-gray-400" : ""}`}
        >
          {timeLeft <= 0 ? "注文できません" : timeLeft <= 10 ? "ラストオーダー注文" : "この内容で注文する"}
        </button>
      </section>

      {/* 【新機能】注文履歴セクション */}
      <section className="border-t pt-6">
        <h2 className="font-bold text-gray-600 mb-4 flex items-center gap-2">
          📋 注文履歴
        </h2>
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-sm">
              <span className="font-medium">{item.menu}</span>
              <span className="text-gray-500">{item.count}個</span>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-center text-gray-400 py-4 text-xs">まだ注文履歴はありません</p>
          )}
        </div>
      </section>
    </div>
  );
}