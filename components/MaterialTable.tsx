import React from 'react';
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
    const [showRevisedOnly, setShowRevisedOnly] = React.useState(false); // 価格改定ありのみ表示
    const [calcRate, setCalcRate] = React.useState<string>('');
    const [calcType, setCalcType] = React.useState<'list_selling_rate' | 'list_cost_rate' | 'cost_markup' | 'cost_rate'>('list_selling_rate');
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleBulkCalc = async () => {
        const rate = parseFloat(calcRate);
        if (isNaN(rate)) return alert("有効な数値を入力してください");

        const updates = items.filter(i => selectedIds.has(i.id)).map(item => {
            let updateData: Partial<MaterialItem> = {};
            if (calcType === 'list_selling_rate') {
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

    const getAppliedPrice = (item: MaterialItem): number => {
        const basePrice = item.sellingPrice || 0;
        if (!activeCustomer) return basePrice;

        const customerRules = pricingRules.filter(r => r.customerName === activeCustomer);
        if (customerRules.length === 0) return basePrice;

        const findBestRule = (scopeRules: PricingRule[]) => {
            let r = scopeRules.find(r => r.category === item.category && r.model !== 'All' && (item.model || '').includes(r.model));
            if (!r) r = scopeRules.find(r => r.category === item.category && r.model === 'All');
            if (!r) r = scopeRules.find(r => r.category === 'All');
            return r;
        };

        let appliedRule: PricingRule | undefined;
        if (activeSite) appliedRule = findBestRule(customerRules.filter(r => r.siteName === activeSite));
        if (!appliedRule) appliedRule = findBestRule(customerRules.filter(r => !r.siteName));

        if (appliedRule) {
            if (appliedRule.method === 'percent_of_list' && (item.listPrice || 0) > 0) {
                return Math.round((item.listPrice || 0) * (appliedRule.value / 100));
            } else if (appliedRule.method === 'markup_on_cost' && (item.costPrice || 0) > 0) {
                return Math.round((item.costPrice || 0) * (1 + (appliedRule.value / 100)));
            }
        }

        return basePrice;
    };

    const SortIcon = ({ field, config }: { field: SortField, config: SortConfig }) => {
        if (config.field !== field) return <ArrowUpDown size={12} className="text-slate-300" />;
        return config.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    const isSearchActive = Object.values(filters).some(v => typeof v === 'string' && v.trim() !== '') || showRevisedOnly;

    const filteredItems = !isSearchActive ? [] : items.filter(item => {
        return (
            (!filters.category || item.category.includes(filters.category)) &&
            (!filters.name || item.name.toLowerCase().includes(filters.name.toLowerCase())) &&
            (!filters.manufacturer || (item.manufacturer || '').toLowerCase().includes(filters.manufacturer.toLowerCase())) &&
            (!filters.model || `${item.model || ''} ${item.dimensions || ''} `.toLowerCase().includes(filters.model.toLowerCase())) &&
            (!filters.location || (item.location || '').toLowerCase().includes(filters.location.toLowerCase())) &&
            (!showRevisedOnly || (item.previousListPrice && item.previousListPrice !== item.listPrice) || (item.previousCostPrice && item.previousCostPrice !== item.listPrice))
        );
    });

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

        if (sortConfig.direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    const allVisibleIds = filteredItems.map(i => i.id);
    const isAllSelected = filteredItems.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

    const totalFilteredValue = filteredItems.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0);

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            {/* Table Controls */}
            <div className="p-2 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-wrap">
                <div className="hidden lg:flex items-center gap-2 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 shadow-sm animate-fade-in">
                    <Landmark size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mr-2 shrink-0">表示中在庫総額:</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">¥{filteredItems.reduce((acc, item) => acc + ((item.costPrice || 0) * (item.quantity || 0)), 0).toLocaleString()}</span>
                </div>

                <button
                    onClick={() => setShowRevisedOnly(!showRevisedOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${showRevisedOnly ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'}`}
                >
                    {showRevisedOnly ? '★ 価格改定ありを表示中' : '☆ 改定履歴を表示'}
                </button>

                <div className="flex items-center gap-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 shadow-sm min-w-0">
                    <User size={12} className="text-slate-400 shrink-0 sm:hidden" />
                    <User size={14} className="text-slate-400 shrink-0 hidden sm:block" />
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 sm:mr-2 shrink-0">顧客:</span>
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
                        <MapPin size={12} className="text-slate-400 shrink-0 sm:hidden" />
                        <MapPin size={14} className="text-slate-400 shrink-0 hidden sm:block" />
                        <select
                            value={activeSite || ''}
                            onChange={(e) => onSiteChange(e.target.value || null)}
                            className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-700 flex-grow truncate min-w-0"
                        >
                            <option value="">全現場共通</option>
                            {Array.from(new Set(pricingRules.filter(r => r.customerName === activeCustomer && r.siteName).map(r => r.siteName as string))).map(site => (
                                <option key={site} value={site}>{site}</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedIds.size > 0 && (
                    <div className="bg-slate-900 text-white px-3 sm:px-6 py-2 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 shadow-lg animate-in slide-in-from-bottom-2 fade-in">
                        <span className="text-[10px] sm:text-xs font-black whitespace-nowrap text-center sm:text-left">{selectedIds.size}件選択中</span>
                        <div className="hidden sm:block h-4 w-px bg-slate-700"></div>

                        <div className="flex items-center gap-1.5 sm:gap-2 justify-center">
                            <select value={calcType} onChange={e => setCalcType(e.target.value as any)} className="bg-slate-800 text-[10px] sm:text-xs border border-slate-700 rounded-lg px-1.5 sm:px-2 py-1 outline-none">
                                <option value="list_selling_rate">定価の〇% (売値)</option>
                                <option value="list_cost_rate">定価の〇% (仕入値)</option>
                                <option value="cost_markup">仕入値+〇% (売値)</option>
                                <option value="cost_rate">利益率〇% (売値)</option>
                            </select>
                            <input type="number" value={calcRate} onChange={e => setCalcRate(e.target.value)} placeholder="%" className="w-12 sm:w-16 bg-slate-800 text-white text-[10px] sm:text-xs border border-slate-700 rounded-lg px-1.5 sm:px-2 py-1 outline-none text-center" disabled={isProcessing} />
                            <button onClick={handleBulkCalc} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-colors whitespace-nowrap min-w-[50px] sm:min-w-[60px]">
                                {isProcessing ? '更新中...' : '適用'}
                            </button>
                        </div>

                        <div className="hidden sm:block h-4 w-px bg-slate-700"></div>

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
                                const appliedPrice = getAppliedPrice(item);
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
                                                <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-600">
                                                    {item.listPrice > 0 ? `定¥${Math.floor(item.listPrice).toLocaleString()}` : 'OPEN'}
                                                </span>
                                                {item.previousListPrice && item.previousListPrice !== item.listPrice && (
                                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 line-through decoration-slate-300">
                                                        定¥{Math.floor(item.previousListPrice).toLocaleString()}
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
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-base font-mono font-black text-blue-700">¥{(appliedPrice || 0).toLocaleString()}</span>
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
                                            </div>
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
