import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// りょうくんがコピーしてくれた「鍵」だよ
const firebaseConfig = {
  apiKey: "AIzaSyCUAPhem8h5aepQOEXVPd6vFdVGlE1cz6A",
  authDomain: "cafe-order-alpha.firebaseapp.com",
  projectId: "cafe-order-alpha",
  storageBucket: "cafe-order-alpha.firebasestorage.app",
  messagingSenderId: "677582597800",
  appId: "1:677582597800:web:fe8652f8a9a33958971c9d",
  measurementId: "G-Y0PDEQMVMF"
};

// Next.jsは何度も画面を読み込み直すから、
// 二重に初期化されないように「まだアプリがなければ初期化する」っていう魔法の書き方にしておくね
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// これで他のファイルからFirestore（注文データ倉庫）を使えるようになるよ！
export const db = getFirestore(app);