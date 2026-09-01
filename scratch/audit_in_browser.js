/**
 * ブラウザDevToolsコンソール用 単価ルール（PricingRule）データ棚卸し実行コード
 * COREXIA core アプリにログインした状態で F12 (DevTools) コールに貼り付けて実行してください。
 */

(async () => {
  console.log("🔍 単価ルール（PricingRule）データ棚卸しを開始します...");

  const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  
  // 既存のFirebaseインスタンスからFirestore取得
  const db = window.firebaseDb || (await import('./firebaseConfig.ts')).db;

  const matSnap = await getDocs(collection(db, 'materials'));
  const ruleSnap = await getDocs(collection(db, 'pricingRules'));

  const materials = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const rules = ruleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const materialIds = new Set(materials.map(m => m.id));
  const materialsMap = new Map();
  materials.forEach(m => materialsMap.set(m.id, m));

  const totalRules = rules.length;
  let hasMaterialIdCount = 0;
  let validMaterialIdCount = 0;
  let deadMaterialIdCount = 0;
  let recoverableByNameCount = 0;
  let completelyDeadCount = 0;

  const customerBreakdown = {};

  rules.forEach(rule => {
    if (rule.materialId) {
      hasMaterialIdCount++;
      if (materialIds.has(rule.materialId)) {
        validMaterialIdCount++;
      } else {
        deadMaterialIdCount++;
        const customerKey = rule.customerName || rule.customerId || '不明な顧客';
        customerBreakdown[customerKey] = (customerBreakdown[customerKey] || 0) + 1;

        let matchFound = false;
        const rName = rule.materialName || rule.name;
        const rModel = rule.model;

        if (rName || rModel) {
          for (const [_, m] of materialsMap.entries()) {
            if (rName && m.name && m.name.includes(rName)) {
              matchFound = true;
              break;
            }
            if (rModel && m.model && m.model === rModel) {
              matchFound = true;
              break;
            }
          }
        }

        if (matchFound) {
          recoverableByNameCount++;
        } else {
          completelyDeadCount++;
        }
      }
    }
  });

  const report = {
    timestamp: new Date().toISOString(),
    totalRules,
    hasMaterialIdCount,
    validMaterialIdCount,
    deadMaterialIdCount,
    deadRate: totalRules > 0 ? ((deadMaterialIdCount / totalRules) * 100).toFixed(2) + '%' : '0%',
    recoverableByNameCount,
    completelyDeadCount,
    topAffectedCustomers: Object.entries(customerBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([customer, count]) => ({ customer, count }))
  };

  console.log("=== PRICING RULES AUDIT REPORT ===");
  console.table(report.topAffectedCustomers);
  console.log(JSON.stringify(report, null, 2));

  return report;
})();
