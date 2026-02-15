
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ユーザー指定の成功している最新のFirebase構成
const firebaseConfig = {
  projectId: "gen-lang-client-0252940162",
  apiKey: "AIzaSyD71H8mkXIHc_zY1UspZBUMwKnZ9bZEJnI",
  authDomain: "gen-lang-client-0252940162.firebaseapp.com",
  storageBucket: "gen-lang-client-0252940162.appspot.com",
  messagingSenderId: "606863797162",
  appId: "1:606863797162:web:4fd5570fbab38afc8b59d3"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);

// 各サービスの初期化とエクスポート
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
