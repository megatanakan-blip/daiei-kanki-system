
import React, { useState, useMemo } from 'react';
import { PricingRule, MaterialItem, Customer, MATERIAL_CATEGORIES } from '../types';
// Fixed: Added missing Loader2 import from lucide-react
import { Plus, Trash2, X, Users, Tag, ArrowLeft, ChevronDown, ChevronRight, CheckSquare, Square, Save, UserCheck, Layers, Search, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import * as storage from '../services/firebaseService';

interface PricingManagerProps {
    rules: PricingRule[];
    customers: Customer[];
    items: MaterialItem[];
    onClose: () => void;
}

export const PricingManager = ({ rules, customers, items, onClose }: PricingManagerProps) => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [targetCustomers, setTargetCustomers] = useState<Customer[]>([]);
    const [listSelected, setListSelected] = useState<Set<string>>(new Set<string>());
    const [newCustomerInput, setNewCustomerInput] = useState('');
    const [newCustomerClosingDay, setNewCustomerClosingDay] = useState<number>(99);
    const [method, setMethod] = useState<'percent_of_list' | 'markup_on_cost'>('percent_of_list');
    const [value, setValue] = useState('');
    const [siteNameInput, setSiteNameInput] = useState('');
    const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set<string>());
    const [checkedModels, setCheckedModels] = useState<Set<string>>(new Set<string>());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set<string>());
    const [modelFilterQuery, setModelFilterQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const uniqueModelsByCategory = useMemo((): Record<string, string[]> => {
        const mapping: Record<string, string[]> = {};
        MATERIAL_CATEGORIES.forEach(cat => mapping[cat] = []);
        items.forEach(item => {
            const cat = item.category || "その他管";
            const mod = item.model || "";
            if (mod && mapping[cat] && !mapping[cat].includes(mod)) mapping[cat].push(mod);
        });
        Object.keys(mapping).forEach(k => mapping[k].sort());
        return mapping;
    }, [items]);

    const filteredModelsByCategory = useMemo((): Record<string, string[]> => {
        if (!modelFilterQuery) return uniqueModelsByCategory;
        const query = modelFilterQuery.toLowerCase();
        const mapping: Record<string, string[]> = {};
        MATERIAL_CATEGORIES.forEach(cat => {
            if (cat.toLowerCase().includes(query)) mapping[cat] = uniqueModelsByCategory[cat];
            else mapping[cat] = (uniqueModelsByCategory[cat] || []).filter(m => m.toLowerCase().includes(query));
        });
        return mapping;
    }, [uniqueModelsByCategory, modelFilterQuery]);

    // 表示用：1社目のルールを表示（一括設定時も参考にできるように）
    const referenceRules = useMemo(() => {
        if (targetCustomers.length === 0) return [];
        const firstCust = targetCustomers[0];
        return rules.filter(r => r.customerName === firstCust.name);
    }, [rules, targetCustomers]);

    const existingSites = useMemo(() => {
        if (targetCustomers.length === 0) return [];
        const sites = new Set<string>();
        rules.forEach(r => {
            if (targetCustomers.some(c => c.name === r.customerName) && r.siteName) {
                sites.add(r.siteName);
            }
        });
        return Array.from(sites).sort();
    }, [rules, targetCustomers]);

    const groupedRulesBySite = useMemo(() => {
        const result: Record<string, Record<string, PricingRule[]>> = {};
        referenceRules.forEach(r => {
            const sKey = r.siteName || 'BASE_COMMON';
            if (!result[sKey]) result[sKey] = {};
            if (!result[sKey][r.category]) result[sKey][r.category] = [];
            result[sKey][r.category].push(r);
        });
        return result;
    }, [referenceRules]);

    const handleRegisterCustomer = async () => {
        const name = newCustomerInput.trim();
        if (!name) return;
        await storage.addCustomer({ name, closingDay: newCustomerClosingDay });
        setNewCustomerInput('');
    };

    const handleToggleListSelection = (custId: string) => {
        const next = new Set(listSelected);
        if (next.has(custId)) next.delete(custId); else next.add(custId);
        setListSelected(next);
    };

    const handleSaveRules = async () => {
        if (!value) return alert('パーセント（値）を入力してください。');
        if (checkedCategories.size === 0 && checkedModels.size === 0) {
            return alert('設定対象のカテゴリーまたは型式を最低1つ選択してください。');
        }

        setIsSaving(true);
        try {
            const numValue = parseFloat(value);
            const site = siteNameInput.trim() || ""; // undefinedではなく空文字を明示
            const newRules: Omit<PricingRule, 'id'>[] = [];

            targetCustomers.forEach(customer => {
                checkedCategories.forEach(cat => {
                    newRules.push({
                        customerName: customer.name,
                        siteName: site,
                        category: cat,
                        model: 'All',
                        method,
                        value: numValue
                    });
                });
                checkedModels.forEach(key => {
                    const [cat, mod] = key.split(':');
                    newRules.push({
                        customerName: customer.name,
                        siteName: site,
                        category: cat,
                        model: mod,
                        method,
                        value: numValue
                    });
                });
            });

            await Promise.all(newRules.map(r => storage.addPricingRule(r)));

            setCheckedCategories(new Set<string>());
            setCheckedModels(new Set<string>());
            setValue(''); // 値をクリアして連続入力を防ぐ
            alert('ルールを保存しました');
        } catch (err) {
            console.error("Save Error:", err);
            alert('保存中にエラーが発生しました。現場名に特殊な文字が含まれていないか確認してください。');
        } finally {
            setIsSaving(false);
        }
    };

    if (view === 'list') {
        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-3"><Users size={24} className="text-blue-600" /> 顧客管理・ルール設定</h2><button onClick={onClose}><X size={24} /></button></div>
                    <div className="p-8 bg-slate-50 flex flex-col gap-8 overflow-y-auto">
                        <div className="bg-white p-6 rounded-xl border border-blue-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">新しい顧客を登録</label>
                            <div className="flex gap-2 mb-2">
                                <select value={newCustomerClosingDay} onChange={e => setNewCustomerClosingDay(parseInt(e.target.value))} className="w-1/3 px-3 py-3 border rounded-lg font-bold"><option value={99}>末日締め</option><option value={20}>20日締め</option><option value={25}>25日締め</option></select>
                                <input type="text" value={newCustomerInput} onChange={e => setNewCustomerInput(e.target.value)} placeholder="顧客名" className="w-2/3 px-4 py-3 border rounded-lg font-bold" />
                            </div>
                            <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg" onClick={handleRegisterCustomer}>登録</button>
                        </div>
                        <div className="space-y-2">
                            {(customers as Customer[]).map(cust => {
                                const isSelected = listSelected.has(cust.id);
                                return (
                                    <div key={cust.id} className={`flex items-center gap-3 p-3 rounded-lg border bg-white ${isSelected ? 'border-blue-300 bg-blue-50' : ''}`}>
                                        <button onClick={() => handleToggleListSelection(cust.id)} className={isSelected ? 'text-blue-600' : 'text-slate-300'}>{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                                        <div onClick={() => { setTargetCustomers([cust]); setView('edit'); }} className="flex-grow flex justify-between cursor-pointer">
                                            <span className="font-bold text-slate-700">{cust.name}</span>
                                            <ChevronRight size={18} className="text-slate-300" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {listSelected.size > 0 && (
                        <div className="p-4 border-t bg-white flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-600">{listSelected.size}社を選択中</span>
                            <button onClick={() => { setTargetCustomers(customers.filter(c => listSelected.has(c.id))); setView('edit'); }} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg">一括設定を開始</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-white">
                    <div className="flex items-center gap-4"><button onClick={() => setView('list')} className="flex items-center gap-1 text-slate-500 font-bold"><ArrowLeft size={20} /> 戻る</button><h2 className="text-xl font-bold">{targetCustomers.length > 1 ? `${targetCustomers.length}社を一括設定中` : targetCustomers[0].name}</h2></div>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    <div className="md:w-7/12 flex flex-col border-r bg-slate-50">
                        <div className="p-6 border-b bg-white space-y-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1 flex items-center gap-1"><MapPin size={12} /> 適用現場 (空欄で共通)</label>
                                    <input
                                        type="text"
                                        list="site-suggestions"
                                        value={siteNameInput}
                                        onChange={e => setSiteNameInput(e.target.value)}
                                        placeholder="現場名を入力または選択"
                                        className="w-full px-3 py-2 border-2 border-slate-100 rounded-lg font-bold focus:border-blue-400 outline-none transition-all"
                                    />
                                    <datalist id="site-suggestions">
                                        {existingSites.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">計算方法</label><select value={method} onChange={e => setMethod(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg font-bold"><option value="percent_of_list">定価の掛率 (%)</option><option value="markup_on_cost">仕入の上乗 (%)</option></select></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">値 (%)</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="55" className="w-full px-3 py-2 border rounded-lg font-bold text-lg" /></div>
                            </div>
                            <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" value={modelFilterQuery} onChange={e => setModelFilterQuery(e.target.value)} placeholder="分類・型式を絞り込み..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" /></div>

                            <div className="flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                                <AlertCircle size={14} className="text-blue-500" />
                                <span className="text-[10px] font-bold text-blue-700">下記リストからチェックを入れて「適用」を押してください</span>
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto p-6 space-y-3">
                            {MATERIAL_CATEGORIES.map(cat => {
                                const models = filteredModelsByCategory[cat] || [];
                                if (models.length === 0 && !cat.toLowerCase().includes(modelFilterQuery.toLowerCase())) return null;
                                const isExpanded = expandedCategories.has(cat);
                                return (
                                    <div key={cat} className={`bg-white rounded-lg border transition-all ${checkedCategories.has(cat) ? 'ring-2 ring-blue-500' : ''}`}>
                                        <div className="flex items-center p-3 cursor-pointer" onClick={() => { const n = new Set(expandedCategories); if (n.has(cat)) n.delete(cat); else n.add(cat); setExpandedCategories(n); }}>
                                            <button onClick={(e) => { e.stopPropagation(); const n = new Set(checkedCategories); if (n.has(cat)) n.delete(cat); else n.add(cat); setCheckedCategories(n); }} className="mr-3">{checkedCategories.has(cat) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-slate-300" />}</button>
                                            <span className="font-bold flex-grow">{cat}</span>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </div>
                                        {isExpanded && models.length > 0 && (
                                            <div className="border-t bg-slate-50 p-4 grid grid-cols-2 gap-3">
                                                {models.map(model => {
                                                    const key = `${cat}:${model}`;
                                                    return <div key={model} onClick={() => { const n = new Set(checkedModels); if (n.has(key)) n.delete(key); else n.add(key); setCheckedModels(n); }} className={`flex items-center gap-2 p-2 rounded-lg border bg-white cursor-pointer hover:border-blue-300 transition-colors ${checkedModels.has(key) ? 'border-blue-400 text-blue-700 bg-blue-50 shadow-sm' : ''}`}>{checkedModels.has(key) ? <CheckSquare size={16} /> : <Square size={16} />}<span className="font-bold text-xs truncate">{model}</span></div>
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t bg-white"><button onClick={handleSaveRules} disabled={isSaving} className={`w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${isSaving ? 'opacity-50' : ''}`}>
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {isSaving ? '保存中...' : '単価ルールを適用する'}
                        </button></div>
                    </div>
                    <div className="md:w-5/12 bg-white border-l overflow-y-auto p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-bold text-slate-700">現在の登録状況</h3>
                            {targetCustomers.length > 1 && <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">1社目のデータを参照中</span>}
                        </div>
                        {Object.entries(groupedRulesBySite).map(([site, cats]) => (
                            <div key={site} className="border rounded-lg mb-4 bg-slate-50/30 overflow-hidden">
                                <div className="bg-slate-100 p-2 text-xs font-bold border-b flex items-center gap-1 text-slate-600">
                                    <MapPin size={10} /> {site === 'BASE_COMMON' ? '共通設定 (現場指定なし)' : site}
                                </div>
                                <div className="p-2 space-y-1">{Object.entries(cats).map(([cat, rs]) => rs.map(r => (<div key={r.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white rounded border border-slate-100 mb-1"><span>{r.model === 'All' ? cat : `${cat} (${r.model})`}</span><div className="flex gap-2 items-center"><span className="font-mono font-bold text-blue-600">{r.value}%</span><button onClick={() => storage.deletePricingRule(r.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={12} /></button></div></div>)))}</div>
                            </div>
                        ))}
                        {Object.keys(groupedRulesBySite).length === 0 && (
                            <div className="text-center py-20 text-slate-300 flex flex-col items-center gap-2">
                                <Tag size={40} className="opacity-10" />
                                <p className="text-xs font-bold uppercase tracking-widest">設定がありません</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
