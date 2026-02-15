
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Package, Search, Loader2, Settings, ClipboardList, Trash2, X, Sparkles, Cloud, Zap, FolderTree, RotateCcw, Save, FileText, Calculator, ArrowRight, CheckCircle2, ChevronDown, LayoutGrid, Droplet, Layers, CircleDot, Box, Wrench, Thermometer, Hammer, Anchor, ShieldCheck, ThermometerSnowflake, Container, Gauge, Construction, Settings2, UserCheck, SearchCode, Database, History, TrendingUp } from 'lucide-react';
import { MaterialItem, SortConfig, SortField, PricingRule, SlipItem, Slip, Customer, MATERIAL_CATEGORIES, DeliveryDestination, Estimate } from './types';
import { MaterialForm } from './components/MaterialForm';
import { MaterialTable } from './components/MaterialTable';
import { MaterialQuickSearch } from './components/MaterialQuickSearch';
import { StatsCard } from './components/StatsCard';
import { PricingManager } from './components/PricingManager';
import { SlipManager } from './components/SlipManager';
import { EstimateManager } from './components/EstimateManager';
import { MaterialPrintPage } from './components/MaterialPrintPage';
import { AITakahashi } from './components/AITakahashi';
import { generateMaterialsFromFile } from './services/geminiService';
import * as storage from './services/firebaseService';

const App: React.FC = () => {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  const [activeCustomer, setActiveCustomer] = useState<string | null>(null);
  const [activeSite, setActiveSite] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPricingManagerOpen, setIsPricingManagerOpen] = useState(false);
  const [isEstimateManagerOpen, setIsEstimateManagerOpen] = useState(false);
  const [isMasterViewOpen, setIsMasterViewOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // SlipManager制御用
  const [slipManagerOpen, setSlipManagerOpen] = useState(false);
  const [slipManagerInitialTab, setSlipManagerInitialTab] = useState<'create' | 'history'>('create');
  const [isEditingSlip, setIsEditingSlip] = useState(false);
  const [isPrintPageOpen, setIsPrintPageOpen] = useState(false);
  const [printItems, setPrintItems] = useState<MaterialItem[]>([]);

  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SlipItem[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubAuth = storage.subscribeToAuth(user => { setCurrentUser(user); setIsAuthLoading(false); });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    const unsubItems = storage.subscribeToMaterials(setItems);
    const unsubCustomers = storage.subscribeToCustomers(setCustomers);
    const unsubRules = storage.subscribeToPricingRules(setPricingRules);
    const unsubSlips = storage.subscribeToSlips(setSlips);
    const unsubEstimates = storage.subscribeToEstimates(setEstimates);
    setIsInitializing(false);
    return () => {
      unsubItems(); unsubCustomers(); unsubRules(); unsubSlips(); unsubEstimates();
    };
  }, [currentUser, isAuthLoading]);

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingAI(true);
    try {
      const results = await generateMaterialsFromFile(file, '消耗品・雑材');
      if (results.length > 0) {
        await storage.importMaterials(results);
        alert(`${results.length}件の資材をインポートしました。`);
      }
    } catch (err) {
      alert("AI解析中にエラーが発生しました。");
    } finally {
      setLoadingAI(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLocalExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `daiei_kanki_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) { alert("保存に失敗しました。"); }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => storage.deleteMaterial(id)));
      setSelectedIds(new Set());
    } catch (e) { alert("一括削除中にエラーが発生しました。"); }
  };

  const handleBulkUpdate = async (updates: { id: string; data: Partial<MaterialItem> }[]) => {
    try {
      await Promise.all(updates.map(u => storage.updateMaterial(u.id, u.data)));
      alert(`${updates.length}件の資材を更新しました。`);
      setSelectedIds(new Set());
    } catch (e) { alert("一括更新中にエラーが発生しました。"); }
  };

  const handleMasterAccess = () => {
    const password = window.prompt('資材管理パスワードを入力してください:');
    if (password === '6815') {
      setIsMasterViewOpen(true);
    } else if (password !== null) {
      alert('パスワードが間違っています。');
    }
  };

  const dashboardActions = [
    {
      title: '出庫・返品処理',
      desc: '現場への出庫、返品の作成。出庫待ち・欠品伝票の管理を行います。',
      icon: ClipboardList,
      color: 'bg-blue-600',
      action: () => { setSlipManagerInitialTab('create'); setSlipManagerOpen(true); }
    },
    {
      title: '伝票・請求履歴',
      desc: '確定した納品書・返品伝票の閲覧、および請求書の一括発行を行います。',
      icon: History,
      color: 'bg-emerald-600',
      action: () => { setSlipManagerInitialTab('history'); setSlipManagerOpen(true); }
    },
    {
      title: '見積書管理',
      desc: '新規見積の作成、履歴確認、伝票への変換を行います。',
      icon: FileText,
      color: 'bg-amber-500',
      action: () => setIsEstimateManagerOpen(true)
    },
    {
      title: '資材クイック検索',
      desc: '在庫と価格の確認専用画面（編集不可）',
      icon: SearchCode,
      color: 'bg-indigo-600',
      action: () => setIsQuickSearchOpen(true)
    },
    {
      title: '資材・単価管理',
      desc: 'マスター登録、AIインポート、顧客別単価を設定します。',
      icon: Database,
      color: 'bg-slate-900',
      action: handleMasterAccess
    }
  ];

  if (isInitializing) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-['Inter','Noto_Sans_JP'] print:h-auto print:overflow-visible">
      {/* Header */}
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 shrink-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">資材販売プロAICLOUD版</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Material Center Pro</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">System Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600">Connected to Firebase</span>
            </div>
          </div>
          <button onClick={() => { setSlipManagerInitialTab('create'); setSlipManagerOpen(true); }} className={`relative p-3 rounded-2xl transition-all ${cart.length > 0 ? 'bg-blue-600 text-white shadow-xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <ClipboardList size={22} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* Dashboard */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8 lg:p-12 print:hidden">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">お疲れ様です。</h2>
              <p className="text-slate-500 font-bold mt-2">今日はどのアクションから開始しますか？</p>
            </div>
            <div className="flex gap-4">
              <StatsCard title="資材総数" value={items.length.toLocaleString()} icon={Package} color="blue" compact />
              <StatsCard title="本日の伝票" value={slips.filter(s => s.date === new Date().toISOString().slice(0, 10)).length.toString()} icon={TrendingUp} color="emerald" compact />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardActions.map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="group relative bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 text-left border border-slate-100 overflow-hidden"
              >
                <div className={`w-14 h-14 ${item.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">{item.desc}</p>
                <div className="mt-6 flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Open Action <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Assistants & Modals */}
      {!(slipManagerOpen && (slipManagerInitialTab !== 'create' || isEditingSlip)) && (
        <div className="print:hidden">
          <AITakahashi
            masterItems={items}
            helpMessage={isMasterViewOpen ? "アイテム追加や価格改定があったら僕に相談しな！" : (isEstimateManagerOpen ? "なんのせ見積手伝うかい？" : (slipManagerOpen && slipManagerInitialTab === 'create' ? "伝票を起こすの手伝うかい？" : undefined))}
            welcomeMessage={isMasterViewOpen ? "あ、高橋です。なんのせ僕に教えてくれたらやっとくよ？" : (isEstimateManagerOpen ? "あ、高橋です。なんのせFAXやメモの写真からでも見積を作れるから、僕に送ってみてな。もちろん相談しながら手入力で作るのも手伝うよ。" : (slipManagerOpen && slipManagerInitialTab === 'create' ? "なんのせお客さんのメモやFAXの写真からでも伝票起こしてあげるから任せな！" : undefined))}
            onAddToCart={newItems => {
              const slipItems: SlipItem[] = newItems.map(ni => {
                const master = items.find(i => i.id === ni.id);
                return { ...ni, id: master?.id || `ai-${Date.now()}`, category: master?.category || '消耗品・雑材', appliedPrice: master?.sellingPrice || 0, updatedAt: Date.now() } as SlipItem;
              });
              setCart(prev => [...prev, ...slipItems]);
              setSlipManagerInitialTab('create');
              setSlipManagerOpen(true);
            }}
            onUpdateInfo={info => { if (info.customerName) setActiveCustomer(info.customerName); }}
            onCreateEstimate={async items => {
              const today = new Date();
              const valid = new Date(); valid.setDate(today.getDate() + 30);
              const newEst: Omit<Estimate, 'id'> = {
                createdAt: Date.now(), date: today.toISOString().slice(0, 10), validUntil: valid.toISOString().slice(0, 10),
                customerName: activeCustomer || '（要確認）', constructionName: activeSite || '', items: items.map(i => ({ ...i, deliveredQuantity: 0, updatedAt: Date.now() })),
                totalAmount: items.reduce((s, i) => s + (i.appliedPrice * i.quantity), 0), taxAmount: 0, grandTotal: 0, status: 'pending', deliveryTime: 'none', deliveryDestination: 'none',
                slipNumber: `EST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
              };
              await storage.addEstimate(newEst);
              setIsEstimateManagerOpen(true);
            }}
          />
        </div>
      )}

      {isMasterViewOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0"><Database size={20} className="md:w-6 md:h-6" /></div>
                <div><h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">資材マスター管理</h2><p className="hidden md:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Inventory & Pricing Control</p></div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white p-3 md:px-6 md:py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                  <Plus size={18} /> <span className="hidden md:inline">資材新規登録</span>
                </button>
                <button onClick={() => setIsPricingManagerOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white p-3 md:px-6 md:py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                  <UserCheck size={18} /> <span className="hidden md:inline">顧客別単価</span>
                </button>
                <div className="h-8 w-px bg-slate-200 mx-1 md:mx-2"></div>
                <button onClick={() => setIsMasterViewOpen(false)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-8">
              <MaterialTable
                items={items.filter(i => `${i.name} ${i.model} ${i.dimensions}`.toLowerCase().includes(searchQuery.toLowerCase()))}
                pricingRules={pricingRules} customers={customers} activeCustomer={activeCustomer} activeSite={activeSite}
                onCustomerChange={(name) => { setActiveCustomer(name); setActiveSite(null); }} onSiteChange={setActiveSite}
                onEdit={item => { setEditingItem(item); setIsFormOpen(true); }} onDelete={id => window.confirm('削除しますか？') && storage.deleteMaterial(id)}
                onAddToSlip={(item, price) => {
                  setCart(p => [...p, { ...item, quantity: 1, appliedPrice: price }]);
                  setIsMasterViewOpen(false); setSlipManagerInitialTab('create'); setSlipManagerOpen(true);
                }}
                sortConfig={sortConfig} onSort={(f) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }))}
                selectedIds={selectedIds} onToggleSelect={id => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); }}
                onSelectAll={ids => { const n = new Set(selectedIds); if (ids.every(id => selectedIds.has(id))) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id)); setSelectedIds(n); }}
                onBulkDelete={handleBulkDelete}
                onBulkUpdate={handleBulkUpdate}
                onPrint={(items) => { setPrintItems(items); setIsPrintPageOpen(true); }}
              />
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-start gap-4 px-10">
              <button onClick={handleLocalExport} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-[10px] font-black uppercase transition-all"><Save size={14} /> DBバックアップ</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for AI upload, might still be used by AI Takahashi if integrated, otherwise keep it or remove if fully integrated in chat. The user said 'AI high bridge button function integrated so please delete'. The AI Takahashi component handles its own file input for chat. This one is for the button we just removed. */}
      {/* However, handleAIUpload is defined above. If we remove the button, we don't trigger fileInputRef.current.click(). So we can remove this input too. but let's just comment it out or leave it if it's harmless. */}
      <input type="file" ref={fileInputRef} onChange={handleAIUpload} className="hidden" accept=".xlsx,.xls,.csv,image/*" />

      {isFormOpen && <MaterialForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingItem(null); }} onSave={async data => { if (editingItem) await storage.updateMaterial(editingItem.id, data); else await storage.addMaterial(data); setIsFormOpen(false); setEditingItem(null); }} initialData={editingItem} />}
      {isPricingManagerOpen && <PricingManager rules={pricingRules} customers={customers} items={items} onClose={() => setIsPricingManagerOpen(false)} />}
      {slipManagerOpen && (
        <SlipManager
          mode="sales"
          initialTab={slipManagerInitialTab}
          onClose={() => setSlipManagerOpen(false)}
          cart={cart} onUpdateCart={setCart} onClearCart={() => setCart([])}
          defaultCustomer={activeCustomer}
          customers={customers}
          pricingRules={pricingRules}
          masterItems={items}
          onTabChange={(tab) => setSlipManagerInitialTab(tab)}
          onEditModeChange={setIsEditingSlip}
        />
      )}
      {isEstimateManagerOpen && <EstimateManager masterItems={items} onClose={() => setIsEstimateManagerOpen(false)} onConvertToSlip={(items, cust, site) => {
        setCart(items); setActiveCustomer(cust); if (site) setActiveSite(site); setSlipManagerInitialTab('create'); setSlipManagerOpen(true);
      }} />}

      {isQuickSearchOpen && (
        <MaterialQuickSearch
          items={items}
          customers={customers}
          pricingRules={pricingRules}
          activeCustomer={activeCustomer}
          activeSite={activeSite}
          onClose={() => setIsQuickSearchOpen(false)}
        />
      )}

      {isPrintPageOpen && (
        <MaterialPrintPage
          items={printItems}
          mode="price"
          customerName={activeCustomer}
          onClose={() => setIsPrintPageOpen(false)}
        />
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
