/**
 * Firestore フルバックアップスクリプト
 * 実行: node backup_firestore.mjs
 *
 * 全コレクションのデータをローカルJSONファイルに書き出します。
 * マイグレーション前のバックアップとして使用してください。
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync } from 'fs';

const firebaseConfig = {
  apiKey:            "AIzaSyD71H8mkXIHc_zY1UspZBUMwKnZ9bZEJnI",
  authDomain:        "gen-lang-client-0252940162.firebaseapp.com",
  projectId:         "gen-lang-client-0252940162",
  storageBucket:     "gen-lang-client-0252940162.appspot.com",
  messagingSenderId: "606863797162",
  appId:             "1:606863797162:web:4fd5570fbab38afc8b59d3",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const COLLECTIONS = [
  'materials',
  'customers',
  'pricingRules',
  'slips',
  'estimates',
  'purchaseOrders',
  'settings',
];

async function backup() {
  const result = {};
  let totalDocs = 0;

  for (const col of COLLECTIONS) {
    console.log(`📦 ${col} を取得中...`);
    const snap = await getDocs(collection(db, col));
    result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    totalDocs += result[col].length;
    console.log(`   → ${result[col].length} 件`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename  = `firestore_backup_${timestamp}.json`;

  writeFileSync(filename, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ バックアップ完了！`);
  console.log(`   ファイル名: ${filename}`);
  console.log(`   合計ドキュメント数: ${totalDocs} 件`);
  console.log(`\n⚠️  このファイルを安全な場所に保管してください。`);

  process.exit(0);
}

backup().catch(e => {
  console.error('❌ バックアップ失敗:', e);
  process.exit(1);
});
