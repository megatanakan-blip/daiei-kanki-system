// ブラウザのコンソールに貼り付けて実行してください（アプリにログイン済みの状態で）
// Firestore全データをJSONでダウンロードします

(async () => {
  const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js');

  // アプリが使っているdbインスタンスを取得できないため、window経由で取得
  // ※ このスクリプトはアプリページ上で実行してください
  const COLS = ['materials','customers','pricingRules','slips','estimates','purchaseOrders','settings'];
  const result = {};
  let total = 0;

  for (const col of COLS) {
    console.log(`取得中: ${col}...`);
    try {
      const snap = await getDocs(collection(window.__db || getFirestore(), col));
      result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      total += result[col].length;
      console.log(`  ${col}: ${result[col].length}件`);
    } catch(e) {
      console.warn(`  ${col} 取得失敗:`, e.message);
      result[col] = [];
    }
  }

  const json = JSON.stringify(result, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `firestore_backup_${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`\n✅ バックアップ完了！合計 ${total} 件`);
})();
