import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
const auth = getAuth(app);

async function runAudit() {
  console.log("🔑 Authenticating with Firebase...");
  try {
    await signInAnonymously(auth);
    console.log("✅ Authenticated anonymously.");
  } catch (err) {
    console.log("⚠️ Anonymous auth disabled or failed, proceeding with direct queries if permission allows...", err.message);
  }

  console.log("📦 Fetching materials and pricingRules...");
  let rawMaterials = [];
  let rawRules = [];

  try {
    const matSnap = await getDocs(collection(db, 'materials'));
    rawMaterials = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   → Materials count: ${rawMaterials.length}`);
  } catch (e) {
    console.error("❌ Failed to fetch materials:", e.message);
  }

  try {
    const ruleSnap = await getDocs(collection(db, 'pricingRules'));
    rawRules = ruleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   → PricingRules count: ${rawRules.length}`);
  } catch (e) {
    console.error("❌ Failed to fetch pricingRules:", e.message);
  }

  const materialIds = new Set(rawMaterials.map(m => m.id));
  const materialsMap = new Map();
  rawMaterials.forEach(m => materialsMap.set(m.id, m));

  const totalRules = rawRules.length;
  let hasMaterialIdCount = 0;
  let validMaterialIdCount = 0;
  let deadMaterialIdCount = 0;
  let recoverableByNameCount = 0;
  let completelyDeadCount = 0;

  const customerBreakdown = {};

  rawRules.forEach(rule => {
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

  console.log("\n=== PRICING RULES AUDIT REPORT ===");
  console.log(JSON.stringify(report, null, 2));

  writeFileSync('./scratch/audit_report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log("\n✅ Audit report saved to scratch/audit_report.json");

  process.exit(0);
}

runAudit().catch(err => {
  console.error("❌ Audit failed:", err);
  process.exit(1);
});
