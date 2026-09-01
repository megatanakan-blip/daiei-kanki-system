/**
 * No. 2: 顧客別単価ルール（PricingRule）データ自動補正スクリプト
 * 
 * - 救済可能ルール (Type B): 正しい実在 materialId へ更新
 * - 孤立ルール (Type C): 不整合な materialId を削除(空化)し、名前フォールバックを安全化
 */

export const BROWSER_FIX_CODE = `
(async () => {
  console.log("🛠️ [No. 2] 単価ルールデータ自動補正を開始します...");
  const { getFirestore, collection, getDocs, doc, updateDoc, deleteField } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const db = window.firebaseDb || (await import('./firebaseConfig.ts')).db;

  // 事前に棚卸しが実行されていない場合は自動で棚卸し
  let summary = window.__pricingRulesAuditSummary;
  let typeB = window.__typeB_Recoverable;
  let typeC = window.__typeC_Orphan;

  if (!summary || !typeB || !typeC) {
    console.log("棚卸しデータを準備中...");
    const matSnap = await getDocs(collection(db, 'materials'));
    const ruleSnap = await getDocs(collection(db, 'pricingRules'));
    const materials = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rules = ruleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const materialIds = new Set(materials.map(m => m.id));
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

    typeB = [];
    typeC = [];

    rules.forEach(rule => {
      if (rule.materialId && !materialIds.has(rule.materialId)) {
        const rName = (rule.materialName || rule.name || '').trim().toLowerCase();
        const rModel = (rule.model || '').trim().toLowerCase();

        let matchedMat = null;
        if (rName && nameToMatMap.has(rName) && nameToMatMap.get(rName).length === 1) {
          matchedMat = nameToMatMap.get(rName)[0];
        } else if (rModel && modelToMatMap.has(rModel) && modelToMatMap.get(rModel).length === 1) {
          matchedMat = modelToMatMap.get(rModel)[0];
        }

        if (matchedMat) {
          typeB.push({ rule, newMaterialId: matchedMat.id, matchedMatName: matchedMat.name });
        } else {
          typeC.push({ rule });
        }
      }
    });
  }

  console.log(\`補正対象: 救済更新 \${typeB.length} 件 / 孤立クリア \${typeC.length} 件\`);
  if (!confirm(\`計 \${typeB.length + typeC.length} 件の単価ルールを補正しますか？\\n・救済更新: \${typeB.length} 件\\n・孤立IDクリア: \${typeC.length} 件\`)) {
    console.log("キャンセルされました。");
    return;
  }

  let updatedCount = 0;

  // 1. 救済可能ルールの materialId を正しい値に更新
  for (const item of typeB) {
    const ruleRef = doc(db, 'pricingRules', item.rule.id);
    await updateDoc(ruleRef, { materialId: item.newMaterialId });
    updatedCount++;
  }

  // 2. 孤立ルールの不整合 materialId を消去
  for (const item of typeC) {
    const ruleRef = doc(db, 'pricingRules', item.rule.id);
    await updateDoc(ruleRef, { materialId: deleteField() });
    updatedCount++;
  }

  console.log(\`✅ 補正完了！ \${updatedCount} 件の単価ルールを正常化しました。\`);
})();
`;

console.log("自動補正スクリプト準備完了");
