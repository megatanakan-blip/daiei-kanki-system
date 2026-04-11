import React from 'react';
import { normalizeForSearch, filterAndSortItems, getAppliedPrice } from '../services/searchUtils';
import * as storage from '../services/firebaseService';
import {
    MaterialItem,
    SortConfig,
    SortField,
    PricingRule,
    Customer
} from '../types';
import {
    Edit2,
    Plus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Package,
    User,
    MapPin,
    CheckSquare,
    Square,
    Trash2,
    Printer,
    Database,
    Landmark
} from 'lucide-react';

interface MaterialTableProps {
    items: MaterialItem[];
    pricingRules: PricingRule[];
    customers: Customer[];
    activeCustomer: string | null;
    activeSite: string | null;
    onCustomerChange: (name: string | null) => void;
    onSiteChange: (site: string | null) => void;
    onEdit: (item: MaterialItem) => void;
    onDelete: (id: string) => void;
    onAddToSlip: (item: MaterialItem, price: number) => void;
    sortConfig: SortConfig;
    onSort: (field: SortField) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: (ids: string[]) => void;
    onBulkDelete: (ids: string[]) => Promise<void>;
    onBulkUpdate: (updates: { id: string; data: Partial<MaterialItem> }[]) => Promise<void>;
    onPrint: (items: MaterialItem[]) => void;
}

export const MaterialTable: React.FC<MaterialTableProps> = ({
    items,
    pricingRules,
    customers,
    activeCustomer,
    activeSite,
    onCustomerChange,
    onSiteChange,
    onEdit,
    onAddToSlip,
    sortConfig,
    onSort,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onBulkDelete,
    onBulkUpdate,
    onPrint
}) => {
    const [filters, setFilters] = React.useState({ category: '', name: '', manufacturer: '', model: '', location: '' });
    const [showScheduled, setShowScheduled] = React.useState(false); // 予告改定表示モード
    const [calcRate, setCalcRate] = React.useState<string>('');
    const [calcType, setCalcType] = React.useState<'list_selling_rate' | 'list_cost_rate' | 'cost_markup' | 'cost_rate' | 'fixed'>('list_selling_rate');
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [editingPriceId, setEditingPriceId] = React.useState<string | null>(null);
    const [editingListPriceId, setEditingListPriceId] = React.useState<string | null>(null);
    const [tempPrice, setTempPrice] = React.useState<string>('');
    const [tempListPrice, setTempListPrice] = React.useState<string>('');
    // 予告改定入力用 state
    const [editingScheduledId, setEditingScheduledId] = React.useState<string | null>(null);
    const [scheduledListPrice, setScheduledListPrice] = React.useState('');
    const [scheduledCostPrice, setScheduledCostPrice] = React.useState('');
    const [scheduledSellingPrice, setScheduledSellingPrice] = React.useState('');
    const [scheduledDate, setScheduledDate] = React.useState('');

    const handlePriceUpdate = async (item: MaterialItem, value: string) => {
        const price = parseFloat(value);
        if (isNaN(price)) return;
        if (!activeCustomer) return;

        try {
            await storage.addPricingRule({
                customerName: activeCustomer,
                siteName: activeSite || '',
                category: item.category,
                model: item.model || '',
                materialId: item.id,
                materialName: item.name,
                method: 'fixed_price',
                value: price
            });
            setEditingPriceId(null);
        } catch (e) {
            alert("単価ルールの保存に失敗しました。");
        }
    };

    const handleListPriceUpdate = async (item: MaterialItem, value: string) => {
        const price = parseFloat(value);
        if (isNaN(price)) {
            setEditingListPriceId(null);
            return;
        }

        try {
            const newListPrice = price;
            const oldListPrice = item.listPrice;
            
            const updateData: any = { 
                listPrice: newListPrice, 
                previousListPrice: oldListPrice, 
                priceUpdatedDate: new Date().toISOString() 
            };

            // 旧定価に対する掛け率を算出してスライド
            if (newListPrice > 0 && oldListPrice > 0) {
                const costRate = item.costPrice / oldListPrice;
                const sellingRate = item.sellingPrice / oldListPrice;
                updateData.costPrice = Math.round(newListPrice * costRate);
                updateData.sellingPrice = Math.round(newListPrice * sellingRate);
            }

            // マスターの情報を直接更新する
            await onBulkUpdate([{ id: item.id, data: updateData }]);
            setEditingListPriceId(null);
        } catch (e) {
            alert("定価の更新に失敗しました。");
        }
    };

    const handleSaveScheduled = async (item: MaterialItem) => {
        if (!scheduledDate) { alert('改定予定日を入力してください。'); return; }
        if (!scheduledListPrice) { alert('新定価を入力してください。'); return; }

        try {
            await storage.updateMaterial(item.id, {
                scheduledPriceDate: scheduledDate,
                scheduledListPrice: parseFloat(scheduledListPrice),
            });
            setEditingScheduledId(null);
        } catch (e) { alert('予告改定の保存に失敗しました。'); }
    };

    const handleClearScheduled = async (item: MaterialItem) => {
        if (!window.confirm(`「${item.name}」の予告改定情報を取り消しますか？`)) return;
        try {
            await storage.updateMaterial(item.id, {
                scheduledListPrice: undefined,
                scheduledCostPrice: undefined,
                scheduledSellingPrice: undefined,
                scheduledPriceDate: undefined,
            });
        } catch (e) { alert('予告改定の取り消しに失敗しました。'); }
    };

    const handleBulkCalc = async () => {
        const rate = parseFloat(calcRate);
        if (isNaN(rate)) return alert("有効な数値を入力してください");

        if (activeCustomer) {
            // 顧客が選択されている場合は、マスターの更新ではなく「単価ルール」として保存する
            if (!window.confirm(`【確認】選択した${selectedIds.size}件を、${activeCustomer}（現場: ${activeSite || '共通'}）の「個別単価ルール」として保存しますか？\n（マスターの標準価格は変更されません）`)) return;
            
            setIsProcessing(true);
            try {
                const newRules: Omit<PricingRule, 'id'>[] = items.filter(i => selectedIds.has(i.id)).map(item => ({
                    customerName: activeCustomer,
                    siteName: activeSite || '',
                    category: item.category,
                    model: item.model || '',
                    materialId: item.id,
                    materialName: item.name,
                    method: calcType === 'fixed' ? 'fixed_price' : (calcType === 'cost_markup' || calcType === 'cost_rate' ? 'markup_on_cost' : 'percent_of_list'),
                    value: rate
                }));

                await Promise.all(newRules.map(r => storage.addPricingRule(r)));
                alert(`${activeCustomer}の個別単価ルールを保存しました。`);
            } catch (e) {
                alert("ルールの保存中にエラーが発生しました。");
            } finally {
                setIsProcessing(false);
            }
            return;
        }

        // 顧客未選択時は従来通りマスターの標準売価・仕入値を更新する
        if (!window.confirm(`【ご注意】現在、顧客が選択されていません。選択した${selectedIds.size}件の「マスター標準価格」自体を直接上書き更新します。よろしいですか？`)) return;

        const updates = items.filter(i => selectedIds.has(i.id)).map(item => {
            let updateData: Partial<MaterialItem> = {};
            if (calcType === 'fixed') {
                updateData.sellingPrice = rate;
            } else if (calcType === 'list_selling_rate') {
                if (item.listPrice > 0) updateData.sellingPrice = Math.round(item.listPrice * (rate / 100));
            } else if (calcType === 'list_cost_rate') {
                if (item.listPrice > 0) updateData.costPrice = Math.round(item.listPrice * (rate / 100));
            } else if (calcType === 'cost_markup') {
                if (item.costPrice > 0) updateData.sellingPrice = Math.round(item.costPrice * (1 + (rate / 100)));
            } else { // cost_rate: 利益率から逆算
                if (item.costPrice > 0 && rate < 100) updateData.sellingPrice = Math.round(item.costPrice / (1 - (rate / 100)));
            }
            return Object.keys(updateData).length > 0 ? { id: item.id, data: updateData } : null;
        }).filter(Boolean) as { id: string; data: Partial<MaterialItem> }[];

        if (updates.length > 0) {
            setIsProcessing(true);
            try {
                await onBulkUpdate(updates);
            } finally {
                setIsProcessing(false);
            }
        } else {
            alert("更新対象の資材がありません（定価/仕入値が未設定など）");
        }
    };

    const getPriceLabel = () => {
        if (activeCustomer) return `${activeCustomer}${(activeSite && activeSite !== '') ? ` (${activeSite})` : ''} 適用単価`;
        return "標準適用単価";
    };

    const SortIcon = ({ field, config }: { field: SortField, config: SortConfig }) => {
        if (config.field !== field) return <ArrowUpDown size={12} className="text-slate-300" />;
        return config.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    const isSearchActive = Object.values(filters).some(v => v !== '') || showScheduled;

    const filteredItems = !isSearchActive ? [] : items.filter(item => {
        const baseFilter =
            (!filters.category || item.category.includes(filters.category)) &&
            (!filters.name || item.name.toLowerCase().includes(filters.name.toLowerCase())) &&
            (!filters.manufacturer || (item.manufacturer || '').toLowerCase().includes(filters.manufacturer.toLowerCase())) &&
            (!filters.model || `${item.model || ''} ${item.dimensions || ''} `.toLowerCase().includes(filters.model.toLowerCase())) &&
            (!filters.location || (item.location || '').toLowerCase().includes(filters.location.toLowerCase()));

        if (!baseFilter) return false;
        // 予告改定モード：予告改定情報がある資材のみ
        if (showScheduled) return !!item.scheduledPriceDate;
        return true;
    });

    const naturalSort = (aStr: string, bStr: string, dir: number): number => {
        const aParts = String(aStr).split(/(\d+)/);
        const bParts = String(bStr).split(/(\d+)/);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const ap = aParts[i] || '';
            const bp = bParts[i] || '';
            if (ap === bp) continue;
            const an = parseInt(ap, 10);
            const bn = parseInt(bp, 10);
            if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
            return ap.localeCompare(bp, undefined, { numeric: true, sensitivity: 'base' }) * dir;
        }
        return 0;
    };

    const sortedItems = [...filteredItems].sort((a, b) => {
        const field = sortConfig.field;
        let aVal: any = a[field as keyof MaterialItem] ?? '';
        let bVal: any = b[field as keyof MaterialItem] ?? '';

        if (field === 'profitMargin') {
            const aSelling = a.sellingPrice || 0;
            const aCost = a.costPrice || 0;
            const bSelling = b.sellingPrice || 0;
            const bCost = b.costPrice || 0;
            aVal = (aSelling - aCost) / (aSelling || 1);
            bVal = (bSelling - bCost) / (bSelling || 1);
        }

        const direction = sortConfig.direction === 'asc' ? 1 : -1;

        // 型式・寸法・品名は自然順ソート
        if (field === 'dimensions' || field === 'model' || field === 'name') {
            const primary = naturalSort(String(aVal), String(bVal), direction);
            if (primary !== 0) return primary;
            // 同名の場合は寸法で数値昇順に二次ソート
            if (field !== 'dimensions') {
                return naturalSort(String(a.dimensions ?? ''), String(b.dimensions ?? ''), 1);
            }
            return 0;
        }

        if (sortConfig.direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    const allVisibleIds = filteredItems.map(i => i.id);
    const isAllSelected = filteredItems.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-2 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-wrap">
                <div className="hidden lg:flex items-center gap-2 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 shadow-sm animate-fade-in">
                    <Landmark size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mr-2 shrink-0">表示中在庫総額:</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">¥{filteredItems.reduce((acc, item) => acc + ((item.costPrice || 0) * (item.quantity || 0)), 0).toLocaleString()}</span>
                </div>

                <button
                    onClick={() => setShowScheduled(!showScheduled)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 ${
                        showScheduled
                            ? 'bg-violet-100 text-violet-700 border-violet-300 shadow-inner'
                            : 'bg-white text-slate-400 border-slate-200 hover:text-violet-600 hover:border-violet-200'
                    }`}
                >
                    {showScheduled ? '📅 予告改定を表示中' : '📅 予告改定'}
                </button>

                <div className="flex items-center gap-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 shadow-sm min-w-0">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 shrink-0">顧客:</span>
                    <select
                        value={activeCustomer || ''}
                        onChange={(e) => onCustomerChange(e.target.value || null)}
                        className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-700 flex-grow truncate min-w-0"
                    >
                        <option value="">標準単価</option>
                        {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>

                {activeCustomer && (
                    <div className="flex items-center gap-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 shadow-sm min-w-0 animate-fade-in">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <input
                            type="text"
                            list="active-site-list"
                            value={activeSite || ''}
                            onChange={(e) => onSiteChange(e.target.value || null)}
                            placeholder="全現場共通 / 現場名入力"
                            className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-700 flex-grow truncate min-w-0 placeholder:text-slate-300"
                        />
                        <datalist id="active-site-list">
                            <option value="">全現場共通</option>
                            {Array.from(new Set(pricingRules.filter(r => r.customerName === activeCustomer && r.siteName).map(r => r.siteName as string))).map(site => (
                                <option key={site} value={site} />
                            ))}
                        </datalist>
                    </div>
                )}

                {selectedIds.size > 0 && (
                    <div className="bg-slate-900 text-white px-3 sm:px-6 py-2 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 shadow-lg animate-in slide-in-from-bottom-2 fade-in">
                        <span className="text-[10px] sm:text-xs font-black whitespace-nowrap text-center sm:text-left">{selectedIds.size}件選択中</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 justify-center">
                            <select value={calcType} onChange={e => setCalcType(e.target.value as any)} className="bg-slate-800 text-[10px] sm:text-xs border border-slate-700 rounded-lg px-1.5 sm:px-2 py-1 outline-none">
                                <option value="list_selling_rate">定価の〇% (売値)</option>
                                <option value="list_cost_rate">定価の〇% (仕入値)</option>
                                <option value="cost_markup">仕入値+〇% (売値)</option>
                                <option value="cost_rate">利益率〇% (売値)</option>
                                <option value="fixed">指定単価 (¥)</option>
                            </select>
                            <input type="number" value={calcRate} onChange={e => setCalcRate(e.target.value)} placeholder={calcType === 'fixed' ? '¥' : '%'} className="w-12 sm:w-16 bg-slate-800 text-white text-[10px] sm:text-xs border border-slate-700 rounded-lg px-1.5 sm:px-2 py-1 outline-none text-center" disabled={isProcessing} />
                            <button onClick={handleBulkCalc} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-colors whitespace-nowrap min-w-[50px] sm:min-w-[60px]">
                                {isProcessing ? '更新中...' : (activeCustomer ? 'ルール保存' : '標準に適用')}
                            </button>
                        </div>
                        <button
                            onClick={() => onPrint(items.filter(i => selectedIds.has(i.id)))}
                            className="flex items-center justify-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-colors text-[10px] sm:text-xs font-black whitespace-nowrap py-1.5 sm:py-0"
                        >
                            <Printer size={12} className="sm:hidden" />
                            <Printer size={14} className="hidden sm:block" />
                            <span className="hidden sm:inline">選択分を</span>印刷
                        </button>

                        <div className="hidden sm:block h-4 w-px bg-slate-700"></div>
                        <button
                            onClick={async () => {
                                if (window.confirm(`${selectedIds.size} 件の資材を完全に削除しますか？`)) {
                                    setIsProcessing(true);
                                    try {
                                        await onBulkDelete(Array.from(selectedIds));
                                    } finally {
                                        setIsProcessing(false);
                                    }
                                }
                            }}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-1 text-rose-400 hover:text-rose-300 disabled:text-slate-500 transition-colors text-[10px] sm:text-xs font-black whitespace-nowrap py-1.5 sm:py-0"
                        >
                            <Trash2 size={12} className="sm:hidden" />
                            <Trash2 size={14} className="hidden sm:block" />
                            削除
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 z-20 bg-white shadow-sm border-b">
                        <tr>
                            <th className="p-2 sm:p-4 w-8 sm:w-12 bg-slate-50/50">
                                <button
                                    onClick={() => onSelectAll(allVisibleIds)}
                                    className={`p-1 sm:p-2 rounded transition-colors ${isAllSelected ? 'text-blue-600' : 'text-slate-300'}`}
                                >
                                    {isAllSelected ? <CheckSquare size={16} className="sm:hidden" /> : <Square size={16} className="sm:hidden" />}
                                    {isAllSelected ? <CheckSquare size={20} className="hidden sm:block" /> : <Square size={20} className="hidden sm:block" />}
                                </button>
                            </th>
                            <th className="p-1.5 sm:p-2 w-1/4">
                                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 cursor-pointer hover:text-blue-600" onClick={() => onSort('name')}>品名 / 分類 <SortIcon field="name" config={sortConfig} /></div>
                                <input value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} placeholder="品名で検索..." className="w-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                <input value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })} placeholder="分類..." className="w-full mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                            </th>
                            <th className="p-1.5 sm:p-2 w-1/4">
                                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 cursor-pointer hover:text-blue-600" onClick={() => onSort('model')}>型式 / メーカー <SortIcon field="model" config={sortConfig} /></div>
                                <input value={filters.model} onChange={e => setFilters({ ...filters, model: e.target.value })} placeholder="型式・寸法..." className="w-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                <div className="flex gap-1 mt-1">
                                    <input value={filters.manufacturer} onChange={e => setFilters({ ...filters, manufacturer: e.target.value })} placeholder="メーカー..." className="flex-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                    <input value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} placeholder="棚番号..." className="w-16 sm:w-20 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400 font-black text-indigo-600" />
                                </div>
                            </th>
                            <th className="p-2 sm:p-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-right cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onSort('listPrice')}>
                                <div className="flex items-center justify-end gap-1">定価 / 仕入 <SortIcon field="listPrice" config={sortConfig} /></div>
                            </th>
                            <th className="p-2 sm:p-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-600 text-right">
                                適用単価
                            </th>
                            <th className="p-2 sm:p-4 w-20 sm:w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {!isSearchActive ? (
                            <tr>
                                <td colSpan={6} className="py-40 text-center text-slate-300 animate-in fade-in duration-700">
                                    <Database size={80} className="mx-auto mb-6 opacity-20" />
                                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40 mb-2">表示負荷低減のため初期表示を制限しています</p>
                                    <p className="text-xs font-bold opacity-30">分類を選択、または品名・型式を入力して検索してください</p>
                                </td>
                            </tr>
                        ) : sortedItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-40 text-center text-slate-300">
                                    <Package size={64} className="mx-auto mb-4 opacity-10" />
                                    <p className="font-black uppercase tracking-widest text-sm opacity-30">該当する資材が見つかりません</p>
                                </td>
                            </tr>
                        ) : (
                            sortedItems.map((item) => {
                                const appliedPrice = getAppliedPrice(item, activeCustomer, activeSite, pricingRules);
                                const isSelected = selectedIds.has(item.id);

                                return (
                                    <tr key={item.id} className={`group transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-2 sm:p-4">
                                            <button
                                                onClick={() => onToggleSelect(item.id)}
                                                className={`p-1 sm:p-2 rounded transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}
                                            >
                                                {isSelected ? <CheckSquare size={16} className="sm:hidden" /> : <Square size={16} className="sm:hidden" />}
                                                {isSelected ? <CheckSquare size={20} className="hidden sm:block" /> : <Square size={20} className="hidden sm:block" />}
                                            </button>
                                        </td>
                                        <td className="p-2 sm:p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 leading-tight text-xs sm:text-sm">{item.name}</span>
                                                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1">
                                                    <span className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-widest">{item.category}</span>
                                                    {item.manufacturer && <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold">{item.manufacturer}</span>}
                                                    {item.location && (
                                                        <div className="flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] sm:text-[9px] font-black border border-indigo-100 uppercase tracking-wider">
                                                            <MapPin size={7} className="sm:hidden" />
                                                            <MapPin size={8} className="hidden sm:block" />
                                                            {item.location}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 bg-slate-100 px-1 sm:px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                                                        <Package size={8} className="text-slate-500 sm:hidden" />
                                                        <Package size={10} className="text-slate-500 hidden sm:block" />
                                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-700">在庫: {(item.quantity || 0).toLocaleString()} {item.unit || ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 sm:p-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[150px]">{item.model || '-'}</span>
                                                <span className="text-xs sm:text-sm font-mono font-bold text-slate-700 mt-0.5">{item.dimensions || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-2 sm:p-4 text-right">
                                            <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                                                {!activeCustomer ? (
                                                    editingListPriceId === item.id ? (
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            value={tempListPrice}
                                                            onChange={e => setTempListPrice(e.target.value)}
                                                            onBlur={() => handleListPriceUpdate(item, tempListPrice)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleListPriceUpdate(item, tempListPrice);
                                                                if (e.key === 'Escape') setEditingListPriceId(null);
                                                            }}
                                                            className="w-20 text-right text-[10px] sm:text-xs font-mono font-bold text-slate-800 bg-amber-50 border-b border-amber-400 outline-none p-0.5 rounded-t"
                                                        />
                                                    ) : (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingListPriceId(item.id); setTempListPrice(item.listPrice.toString()); }}
                                                            className="text-[10px] sm:text-xs font-mono font-bold text-slate-600 hover:text-slate-900 border-b border-dotted border-slate-300 transition-colors"
                                                        >
                                                            {item.listPrice > 0 ? `定¥${Math.floor(item.listPrice).toLocaleString()}` : 'OPEN/設定'}
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-600">
                                                        {item.listPrice > 0 ? `定¥${Math.floor(item.listPrice).toLocaleString()}` : 'OPEN'}
                                                    </span>
                                                )}
                                                {item.previousListPrice && item.previousListPrice !== item.listPrice && (
                                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 line-through decoration-slate-300">
                                                        定¥{Math.floor(item.previousListPrice).toLocaleString()}
                                                    </span>
                                                )}
                                                {activeCustomer && (
                                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400">
                                                        (標¥{(item.sellingPrice || 0).toLocaleString()})
                                                    </span>
                                                )}
                                                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400">
                                                    (仕¥{(item.costPrice || 0).toLocaleString()})
                                                </span>
                                                {item.previousCostPrice && item.previousCostPrice !== item.costPrice && (
                                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 line-through decoration-slate-300">
                                                        (仕¥{Math.floor(item.previousCostPrice).toLocaleString()})
                                                    </span>
                                                )}
                                                {/* 予告改定バッジ */}
                                                {item.scheduledPriceDate && (
                                                    <div className="mt-1 flex flex-col items-end gap-0.5">
                                                        <span className="text-[8px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                            📅 {item.scheduledPriceDate} 改定予定
                                                        </span>
                                                        {item.scheduledListPrice !== undefined && (
                                                            <span className="text-[9px] font-mono font-bold text-violet-500">
                                                                → 定¥{Math.floor(item.scheduledListPrice).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex flex-col items-end">
                                                {activeCustomer ? (
                                                    editingPriceId === item.id ? (
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            value={tempPrice}
                                                            onChange={e => setTempPrice(e.target.value)}
                                                            onBlur={() => handlePriceUpdate(item, tempPrice)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handlePriceUpdate(item, tempPrice);
                                                                if (e.key === 'Escape') setEditingPriceId(null);
                                                            }}
                                                            className="w-24 text-right text-base font-mono font-black text-blue-700 bg-blue-50 border-b-2 border-blue-400 outline-none p-1 rounded-t animate-in fade-in zoom-in-95"
                                                        />
                                                    ) : (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingPriceId(item.id); 
                                                                setTempPrice((appliedPrice || 0).toString()); 
                                                            }}
                                                            className="text-base font-mono font-black text-blue-700 hover:bg-blue-100 hover:text-blue-800 px-2 py-1 rounded-lg border-b border-dashed border-blue-300 transition-all cursor-text group-hover:scale-105"
                                                        >
                                                            ¥{(appliedPrice || 0).toLocaleString()}
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-base font-mono font-black text-slate-700">¥{(appliedPrice || 0).toLocaleString()}</span>
                                                )}
                                                <div className="flex flex-col items-end -mt-0.5">
                                                    {item.listPrice > 0 && (
                                                        <span className="text-[9px] font-bold text-slate-400">
                                                            (掛: {((appliedPrice / item.listPrice) * 100).toFixed(1)}%)
                                                        </span>
                                                    )}
                                                    {appliedPrice > 0 && item.costPrice > 0 && (
                                                        <span className="text-[9px] font-bold text-emerald-600">
                                                            (粗利: {(((appliedPrice - item.costPrice) / appliedPrice) * 100).toFixed(1)}%)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onAddToSlip(item, appliedPrice)}
                                                    className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-md active:scale-90"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {/* 予告改定ボタン */}
                                                <button
                                                    title="予告改定を設定"
                                                    onClick={() => {
                                                        setEditingScheduledId(item.id);
                                                        setScheduledListPrice(item.scheduledListPrice?.toString() ?? '');
                                                        setScheduledCostPrice(item.scheduledCostPrice?.toString() ?? '');
                                                        setScheduledSellingPrice(item.scheduledSellingPrice?.toString() ?? '');
                                                        setScheduledDate(item.scheduledPriceDate ?? '');
                                                    }}
                                                    className={`p-2.5 rounded-xl transition-all ${
                                                        item.scheduledPriceDate
                                                            ? 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                                                            : 'text-slate-300 hover:text-violet-500 hover:bg-violet-50'
                                                    }`}
                                                >
                                                    📅
                                                </button>
                                            </div>
                                            {/* 予告改定入力パネル */}
                                            {editingScheduledId === item.id && (
                                                <div className="mt-2 p-3 bg-violet-50 border border-violet-200 rounded-xl shadow-lg space-y-2 animate-in slide-in-from-right-2 z-10 min-w-[200px]">
                                                    <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest">📅 予告改定</p>
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[9px] font-bold text-slate-500">改定予定日</label>
                                                        <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs font-bold border-2 border-violet-200 rounded-lg outline-none focus:border-violet-400 bg-white" />
                                                        <label className="text-[9px] font-bold text-slate-500">新定価</label>
                                                        <input type="number" placeholder={`現在: ¥${item.listPrice?.toLocaleString()}`} value={scheduledListPrice} onChange={e => setScheduledListPrice(e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs font-mono font-bold border-2 border-violet-200 rounded-lg outline-none focus:border-violet-400 bg-white" />
                                                    </div>
                                                    <div className="flex gap-1.5 pt-1">
                                                        {item.scheduledPriceDate && (
                                                            <button onClick={() => { setEditingScheduledId(null); handleClearScheduled(item); }}
                                                                className="flex-1 py-1.5 text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors">
                                                                取消
                                                            </button>
                                                        )}
                                                        <button onClick={() => setEditingScheduledId(null)}
                                                            className="flex-1 py-1.5 text-[10px] font-black text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                                            閉じる
                                                        </button>
                                                        <button onClick={() => handleSaveScheduled(item)}
                                                            className="flex-[2] py-1.5 text-[10px] font-black text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors">
                                                            保存
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
