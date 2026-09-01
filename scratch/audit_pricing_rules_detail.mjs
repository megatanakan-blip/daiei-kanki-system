/**
 * No. 2: 顧客別単価ルール（PricingRule）データ詳細棚卸し・自動判定スクリプト
 */
import fs from 'fs';

// ブラウザDevToolsコンソールで直ちに実行できるJavaScriptコード
export const BROWSER_AUDIT_CODE = `
(async () => {
  console.log("🔍 [No. 2] 単価ルール詳細棚卸しを開始します...");
  const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const db = window.firebaseDb || (await import('./firebaseConfig.ts')).db;

  const matSnap = await getDocs(collection(db, 'materials'));
  const ruleSnap = await getDocs(collection(db, 'pricingRules'));

  const materials = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const rules = ruleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(\`取得完了: 資材 \${materials.length} 件 / 単価ルール \${rules.length} 件\`);

  const materialIds = new Set(materials.map(m => m.id));
  
  // 資材を名前・型番でインデックス化
  const nameToMatMap = new Map();
  const modelToMatMap = new Map();
  materials.forEach(m => {
    if (m.name) {
      const normN = m.name.trim().toLowerCase();
      if (!nameToMatMap.has(normN)) nameToMatMap.set(normN, []);
      nameToMatMap.get(normN).push(m);
    }
    if (m.model) {
      const normM = m.model.trim().toLowerCase();
      if (!modelToMatMap.has(normM)) modelToMatMap.set(normM, []);
      modelToMatMap.get(normM).push(m);
    }
  });

  const typeA_Valid = [];       // ID正常
  const typeB_Recoverable = []; // ID不整合だが名前/型番で特定可能
  const typeC_Orphan = [];      // ID不整合で名前特定も不可能（materialIdを削除すべき）
  const typeD_NoMaterialId = [];// 元々materialIdなし（カテゴリ・名前ルール）

  const customerBreakdown = {};

  rules.forEach(rule => {
    const cName = rule.customerName || rule.customerId || '不明顧客';
    if (!customerBreakdown[cName]) {
      customerBreakdown[cName] = { total: 0, valid: 0, recoverable: 0, orphan: 0, noId: 0 };
    }
    customerBreakdown[cName].total++;

    if (!rule.materialId || rule.materialId === '') {
      typeD_NoMaterialId.push(rule);
      customerBreakdown[cName].noId++;
      return;
    }

    if (materialIds.has(rule.materialId)) {
      typeA_Valid.push(rule);
      customerBreakdown[cName].valid++;
    } else {
      // ID不整合 -> 名前・型番で救済可能か判定
      const rName = (rule.materialName || rule.name || '').trim().toLowerCase();
      const rModel = (rule.model || '').trim().toLowerCase();

      let matchedMat = null;
      if (rName && nameToMatMap.has(rName) && nameToMatMap.get(rName).length === 1) {
        matchedMat = nameToMatMap.get(rName)[0];
      } else if (rModel && modelToMatMap.has(rModel) && modelToMatMap.get(rModel).length === 1) {
        matchedMat = modelToMatMap.get(rModel)[0];
      }

      if (matchedMat) {
        typeB_Recoverable.push({ rule, newMaterialId: matchedMat.id, matchedMatName: matchedMat.name });
        customerBreakdown[cName].recoverable++;
      } else {
        typeC_Orphan.push(rule);
        customerBreakdown[cName].orphan++;
      }
    }
  });

  const summary = {
    totalRules: rules.length,
    typeA_ValidCount: typeA_Valid.length,
    typeB_RecoverableCount: typeB_Recoverable.length,
    typeC_OrphanCount: typeC_Orphan.length,
    typeD_NoMaterialIdCount: typeD_NoMaterialId.length,
    deadMaterialIdTotal: typeB_Recoverable.length + typeC_Orphan.length,
    deadRatePercent: (( (typeB_Recoverable.length + typeC_Orphan.length) / rules.length) * 100).toFixed(2) + '%',
    customerBreakdown: Object.entries(customerBreakdown)
      .map(([customer, stat]) => ({ customer, ...stat }))
      .sort((a, b) => b.total - a.total)
  };

  console.log("=========================================");
  console.log("📊 単価ルール棚卸し結果サマリー");
  console.log("=========================================");
  console.table({
    "1. 全ルール数": summary.totalRules,
    "2. 正常IDルール (Type A)": summary.typeA_ValidCount,
    "3. 救済可能ルール (Type B)": summary.typeB_RecoverableCount,
    "4. 孤立ルール [ID削除対象] (Type C)": summary.typeC_OrphanCount,
    "5. 元々IDなしルール (Type D)": summary.typeD_NoMaterialIdCount,
    "不整合ID合計 (B + C)": summary.deadMaterialIdTotal,
    "不整合率": summary.deadRatePercent
  });

  console.log("🏢 影響顧客上位10社:");
  console.table(summary.customerBreakdown.slice(0, 10));

  window.__pricingRulesAuditSummary = summary;
  window.__typeB_Recoverable = typeB_Recoverable;
  window.__typeC_Orphan = typeC_Orphan;

  return summary;
})();
`;

console.log("棚卸しスクリプト準備完了");
