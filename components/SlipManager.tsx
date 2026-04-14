
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Slip, SlipItem, SlipType, DeliveryTime, DeliveryDestination, MaterialItem, PricingRule, Customer } from '../types';
import { X, Trash2, Printer, FileText, ShoppingCart, Save, HardHat, Loader2, Edit3, FileOutput, CheckSquare, Square, Search, MapPin, Clock, Users, Info, RotateCcw, AlertTriangle, ArrowRight, Package, Layers, Check, PlusCircle, Calculator, History, Archive, FileStack, ChevronDown, ChevronRight, Building2, Eye, EyeOff, Calendar, User, UserCheck, Camera, Sparkles, Plus, Minus, MessageSquare, Edit2, LayoutGrid, FileSearch, Database, Mail, GripVertical } from 'lucide-react';
import * as storage from '../services/firebaseService';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { normalizeForSearch, filterAndSortItems, getAppliedPrice } from '../services/searchUtils';
import { parseReturnMemo } from '../services/geminiService';

import { AppSettings } from '../types';

const DEFAULT_COMPANY_INFO: AppSettings = {
    companyName: "大栄管機株式会社",
    postalCode: "〒080-0048",
    address: "北海道帯広市西18条北1丁目1-14",
    phone: "0155-35-6815",
    fax: "0155-36-2661",
    email: "daieikanki@f1.octv.ne.jp",
    invoiceNumber: "T8460101000829",
    categories: [],
    banks: [
        { bankName: "帯広信用金庫", branchName: "西支店", accountType: "当座", accountNumber: "005322", accountHolder: "大栄管機(株)" },
    ]
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

// 返品の単価・時期選択モーダル
const ReturnResolutionModal = ({ results, onApply, onClose }: { results: any[], onApply: (items: any[]) => void, onClose: () => void }) => {
    const [resolutions, setResolutions] = useState<any[]>(results.map(r => ({
        ...r,
        selectedItem: r.suggestedItems && r.suggestedItems.length === 1 ? r.suggestedItems[0] : null,
        confirmedQuantity: r.quantity
    })));

    const handleSelect = (resultIdx: number, item: any) => {
        const next = [...resolutions];
        next[resultIdx].selectedItem = item;
        setResolutions(next);
    };

    const isValid = resolutions.every(r => r.selectedItem);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-rose-50/50">
                    <div>
                        <h2 className="text-xl font-black text-rose-900 flex items-center gap-2">
                            <Sparkles className="text-rose-500" /> 返品単価・時期の最終確認
                        </h2>
                        <p className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-widest">Select relevant delivery records</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-rose-100 rounded-xl transition-all"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                    {resolutions.map((res, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-5 border shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">手書き解析結果:</span>
                                    <div className="text-base font-black text-slate-800">{res.originalText} <span className="text-rose-600 ml-2">数量: {res.quantity}</span></div>
                                </div>
                                {res.selectedItem && <div className="bg-emerald-500 text-white text-[8px] px-2 py-1 rounded-full font-black animate-pulse">MATCHED</div>}
                            </div>

                            {res.suggestedItems && res.suggestedItems.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">納品履歴から一つ選択してください:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {res.suggestedItems.map((item: any, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSelect(idx, item)}
                                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${res.selectedItem?.id === item.id ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-slate-100 hover:border-rose-200 bg-white'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-black text-sm text-slate-700">{item.date} 納品分</span>
                                                    <span className="font-mono font-black text-emerald-600">¥{item.price.toLocaleString()}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold flex justify-between">
                                                    <span>{item.name} {item.model}</span>
                                                    <span>可能残数: {item.maxAvailable}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-3">
                                    <AlertTriangle size={20} />
                                    履歴に一致する品物が見つかりませんでした。
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t bg-white flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200">閉じる</button>
                    <button 
                        onClick={() => onApply(resolutions)}
                        disabled={!isValid}
                        className={`flex-[2] py-4 font-black rounded-2xl shadow-xl transition-all ${isValid ? 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95' : 'bg-slate-300 text-white cursor-not-allowed'}`}
                    >
                        {resolutions.filter(r => r.selectedItem).length}件を返品リストに追加
                    </button>
                </div>
            </div>
        </div>
    );
};

const generateSlipNumber = () => {
    const d = new Date();
    const datePart = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${datePart}-${randomPart}`;
};

const normalize = (s: string) => s.toLowerCase().trim();
const formatSiteName = (n?: string) => n?.trim() || '一般・共通';

const cleanForFirestore = (obj: any) => {
    const json = JSON.parse(JSON.stringify(obj));
    if (json.id) delete json.id;
    return json;
};

const getSlipLabel = (type: SlipType, constructionName?: string) => {
    const isGlobal = constructionName === '全現場一括集計';
    switch (type) {
        case 'outbound': return '出庫伝票 (作業・ピッキング用)';
        case 'provisional': return '仮納品書 (御納品明細)';
        case 'delivery': return '納品明細書';
        case 'invoice': return '請求明細書';
        case 'return': return '返品伝票';
        case 'reslip': return '欠品伝票(未納分)';
        case 'cover': return isGlobal ? '御請求書 (総括表)' : '御計算書 (現場総括)';
        default: return '伝票';
    }
};

const DeliveryTimeLabels: Record<DeliveryTime, string> = {
    morning_first: '朝一番', am: '午前中', afternoon_first: '昼一番', pm: '午後', none: '指定なし'
};

const DestLabels: Record<DeliveryDestination, string> = {
    site: '現場', factory: '工場', office: '事務所', home: 'ご自宅', bring: 'ご持参', carrier: '運送便', none: '未指定'
};

const SlipPage = ({ slip, pageNum, totalPages, forceDisplayPrice = false, settings, onUpdateSlip }: {
    slip: Slip,
    pageNum?: number,
    totalPages?: number,
    forceDisplayPrice?: boolean,
    settings: AppSettings | null,
    onUpdateSlip?: (updates: Partial<Slip>) => void
}) => {
    const info = settings || DEFAULT_COMPANY_INFO;
    const isReturn = slip.type === 'return' || (slip.items && slip.items.some(i => (i.deliveredQuantity ?? i.quantity) < 0));
    const isCover = slip.type === 'cover';

    // 内部計算用の値を抽出
    const prevAmt = slip.previousBillingAmount || 0;
    const payRec = slip.paymentReceived || 0;
    const carriedForward = prevAmt - payRec;
    const currentSales = slip.totalAmount || 0;
    const currentTax = slip.taxAmount || 0;
    const currentGrandTotal = carriedForward + currentSales + currentTax;

    const isGlobal = slip.constructionName === '全現場一括集計';
    const isDetail = slip.type === 'invoice' || slip.type === 'delivery';

    // 出庫・納品系の伝票か
    const isWorkSlip = slip.type === 'outbound';
    const isProvisional = slip.type === 'provisional' || slip.type === 'reslip';
    const isDualQty = isWorkSlip || isProvisional;

    // 金額表示のロジック
    // 納品明細書(delivery)、請求明細書(invoice)、返品伝票(return)、総括表(cover)のみ金額を表示
    // 出庫伝票(outbound)、仮納品書(provisional)、欠品伝票(reslip)は金額を表示しない（forceDisplayPriceがtrueの場合を除く）
    const displayPrice = forceDisplayPrice || ['delivery', 'invoice', 'return', 'cover'].includes(slip.type);

    if (isCover) {
        return (
            <div className="bg-white p-10 text-slate-900 flex flex-col h-full w-full box-border">
                <div className="w-full border-b-4 border-slate-900 pb-4 mb-6 text-center shrink-0">
                    <h1 className="text-4xl font-serif font-bold tracking-[0.2em] mb-2">{isGlobal ? '御請求書' : '御計算書'}</h1>
                    <p className="text-slate-500 font-mono text-xs font-bold">No. {slip.slipNumber || 'SUMMARY'}</p>
                </div>
                <div className="flex flex-col flex-grow gap-4 min-h-0 overflow-hidden">
                    <div className="flex justify-between items-start shrink-0">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold border-b-2 border-slate-800 pb-1 inline-block min-w-[300px]">{slip.customerName} 御中</h2>
                            {!isGlobal && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-2"><span className="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">現場名</span><span className="text-xl font-bold text-slate-700 underline underline-offset-8 decoration-slate-300">{formatSiteName(slip.constructionName)}</span></div>
                                    {slip.customerOrderNumber && <div className="flex items-center gap-2"><span className="bg-slate-500 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">注文番号</span><span className="text-base font-bold text-slate-600">No. {slip.customerOrderNumber}</span></div>}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4 items-start text-right text-[10px]">
                            <div>
                                <h3 className="text-base font-bold mb-0.5">{info.companyName}</h3>
                                <p>{info.postalCode} {info.address}</p>
                                <p className="mt-1 font-bold">TEL: {info.phone} / FAX: {info.fax}</p>
                                <p className="font-bold">登録番号: {info.invoiceNumber}</p>
                                <div className="mt-1 flex flex-col items-end gap-0.5">
                                    <div className="text-slate-500 flex items-center justify-end gap-2 text-[10px]">
                                        <span className="font-bold">受注日:</span>
                                        <input 
                                            type="date" 
                                            value={slip.orderDate || slip.date || new Date().toISOString().split('T')[0]} 
                                            onChange={(e) => onUpdateSlip?.({ orderDate: e.target.value })}
                                            className="bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-0.5 text-right w-24 print:hidden cursor-pointer hover:bg-slate-100"
                                        />
                                        <span className="hidden print:block">{slip.orderDate || slip.date ? new Date(slip.orderDate || slip.date).toLocaleDateString('ja-JP') : new Date().toLocaleDateString('ja-JP')}</span>
                                    </div>
                                    <div className="text-slate-500 flex items-center justify-end gap-2 text-[10px]">
                                        <span className="font-bold">出庫日:</span>
                                        <input 
                                            type="date" 
                                            value={slip.date || new Date().toISOString().split('T')[0]} 
                                            onChange={(e) => onUpdateSlip?.({ date: e.target.value })}
                                            className="bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-0.5 text-right w-24 print:hidden cursor-pointer hover:bg-slate-100"
                                        />
                                        <span className="hidden print:block">{slip.date ? new Date(slip.date).toLocaleDateString('ja-JP') : new Date().toLocaleDateString('ja-JP')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col flex-grow gap-4 min-h-0">
                        {/* 請求内訳テーブル */}
                        <div className="w-full shrink-0">
                            {isGlobal ? (
                                <table className="w-full border-collapse border-b-2 border-slate-900 border-x-2 border-t text-[10px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <th className="py-1 px-2 border-r border-slate-400 text-center font-bold w-[16%] text-[9px]">前回御請求額</th>
                                            <th className="py-1 px-2 border-r border-slate-400 text-center font-bold w-[16%] text-[9px]">今回御入金額</th>
                                            <th className="py-1 px-2 border-r border-slate-400 text-center font-bold w-[16%] text-[9px]">繰越残高</th>
                                            <th className="py-1 px-2 border-r border-slate-400 text-center font-bold w-[18%] text-[9px]">今回売上額(税抜)</th>
                                            <th className="py-1 px-2 border-r border-slate-400 text-center font-bold w-[14%] text-[9px]">消費税(10%)</th>
                                            <th className="py-1 px-2 text-center font-bold w-[20%] bg-slate-900 text-white text-[9px]">今回御請求額</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="h-10 text-center text-sm font-mono font-bold">
                                            <td className="border-r border-slate-300 px-1 relative">
                                                <input
                                                    type="number"
                                                    value={prevAmt}
                                                    onChange={(e) => onUpdateSlip?.({ previousBillingAmount: parseInt(e.target.value) || 0 })}
                                                    onWheel={e => (e.target as HTMLElement).blur()}
                                                    className="w-full text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-1 print:hidden no-spin-buttons"
                                                />
                                                <span className="hidden print:block">¥{prevAmt.toLocaleString()}</span>
                                            </td>
                                            <td className="border-r border-slate-300 px-1 relative">
                                                <input
                                                    type="number"
                                                    value={payRec}
                                                    onChange={(e) => onUpdateSlip?.({ paymentReceived: parseInt(e.target.value) || 0 })}
                                                    onWheel={e => (e.target as HTMLElement).blur()}
                                                    className="w-full text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-1 print:hidden no-spin-buttons"
                                                />
                                                <span className="hidden print:block">¥{payRec.toLocaleString()}</span>
                                            </td>
                                            <td className="border-r border-slate-300">¥{carriedForward.toLocaleString()}</td>
                                            <td className="border-r border-slate-300">¥{currentSales.toLocaleString()}</td>
                                            <td className="border-r border-slate-300">¥{currentTax.toLocaleString()}</td>
                                            <td className="bg-slate-50 text-base font-black border-slate-900 border-l-2">¥{currentGrandTotal.toLocaleString()}-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex justify-center py-6">
                                    <table className="w-[50%] border-collapse border-b-4 border-slate-900 border-x-2 border-t">
                                        <thead>
                                            <tr className="bg-slate-900 text-white">
                                                <th className="py-2 px-4 text-center font-bold text-[11px] tracking-widest">今回売上額 (税抜) / Monthly Sales Excl. Tax</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="h-16 text-center">
                                                <td className="text-3xl font-mono font-black text-slate-900">
                                                    ¥{currentSales.toLocaleString()}-
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        {isGlobal && slip.siteSummaries && (
                            <div className="border rounded-xl overflow-hidden shadow-sm bg-white flex flex-col flex-grow max-h-[480px]">
                                <div className="bg-slate-800 text-white px-4 py-2 text-[10px] font-bold flex justify-between tracking-widest shrink-0"><span>現場別 売上内訳 (税抜)</span><span>小計金額</span></div>
                                <div className="p-0 divide-y divide-slate-100 overflow-y-auto">
                                    {slip.siteSummaries.map((site, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px] py-1.5 px-4 hover:bg-slate-50">
                                            <span className="font-bold text-slate-700">{site.name}</span>
                                            <span className="font-mono font-bold">{(site.total || 0) < 0 ? `▲¥${Math.abs(site.total || 0).toLocaleString()}` : `¥${(site.total || 0).toLocaleString()}`}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-auto pt-4 border-t border-slate-200 shrink-0 flex justify-between items-end gap-8">
                            <div className="flex-grow">
                                {isGlobal ? (
                                    <>
                                        <div className="font-bold text-slate-600 underline decoration-slate-300 mb-2 text-[10px]">【振込先】</div>
                                        <div className="grid grid-cols-1 gap-y-1.5 text-[10px]">
                                            {(info.banks || []).map((bank, idx) => (
                                                <div key={idx} className="flex items-center border-b border-slate-100 pb-1">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold whitespace-nowrap">{bank.bankName} {bank.branchName}</span>
                                                        <span className="font-mono text-slate-600">{bank.accountType} {bank.accountNumber} {bank.accountHolder}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-20"></div> // Spacer for site cover
                                )}
                            </div>
                            {isGlobal && (
                                <table className="border-collapse border border-slate-900 w-48 text-[9px] shrink-0 mb-1">
                                    <tbody>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="border-r border-slate-900 py-1 text-center font-bold">検印</td>
                                            <td className="border-r border-slate-900 py-1 text-center font-bold">経理</td>
                                            <td className="py-1 text-center font-bold">担当</td>
                                        </tr>
                                        <tr className="h-16">
                                            <td className="border-r border-slate-900"></td>
                                            <td className="border-r border-slate-900"></td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white pt-8 pb-6 px-10 text-slate-900 flex flex-col justify-between h-full w-full box-border">
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-3">
                    <h1 className={`text-2xl font-serif font-bold tracking-widest ${isReturn ? 'text-red-700' : ''}`}>{getSlipLabel(slip.type, slip.constructionName)}</h1>
                    <div className="text-right font-mono text-xs">
                        <p className="font-bold">No. {slip.slipNumber || 'PENDING'}</p>
                        <div className="flex items-center justify-end gap-1">
                            <input 
                                type="date" 
                                value={slip.date || ''} 
                                onChange={(e) => onUpdateSlip?.({ date: e.target.value })}
                                className="bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-0.5 text-right w-24 print:hidden cursor-pointer hover:bg-slate-50"
                            />
                            <p className="hidden print:block">{slip.date}</p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-start mb-3">
                    <div className="w-[60%]">
                        <h2 className="text-xl font-bold underline underline-offset-4 mb-3">{slip.customerName} 御中</h2>
                        <div className="flex items-center gap-2 mb-2"><span className="text-[9px] font-bold border border-slate-400 px-1 rounded bg-slate-50 uppercase">現場</span><span className="font-bold text-base">{formatSiteName(slip.constructionName)}</span></div>
                        <div className="text-[10px] space-y-1 text-slate-600 font-medium">
                            <p>【配送先】 {DestLabels[slip.deliveryDestination]} / {DeliveryTimeLabels[slip.deliveryTime]}</p>
                            <div className="flex gap-4">
                                <p>【発注者】 {slip.orderingPerson || '未指定'} 様</p>
                                {slip.customerOrderNumber && <p>【注文番号】 {slip.customerOrderNumber}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="w-[40%] text-right text-[10px]">
                        <h3 className="text-sm font-bold mb-1">{info.companyName}</h3>
                        <p>{info.postalCode} {info.address}</p>
                        <p className="mt-1 font-bold">TEL: {info.phone} / FAX: {info.fax}</p>
                        <p className="font-bold">Email: {info.email}</p>
                        <p className="mt-1 font-black">登録番号: {info.invoiceNumber}</p>
                        <div className="mt-1 font-bold">受付担当: {slip.receivingPerson || '本部'}</div>
                    </div>
                </div>
                <table className="w-full border-collapse table-fixed text-[10px] border-2 border-slate-900">
                    <thead>
                        <tr className="bg-slate-100 border-b-2 border-slate-900">
                            <th className="py-1 px-1 w-[4%] border-r border-slate-900 text-center">No</th>
                            {isDetail && <th className="py-1 px-1 w-[8%] border-r border-slate-900 text-center">月日</th>}
                            <th className={`py-1 px-2 text-left border-r border-slate-900 ${isDetail ? 'w-[28%]' : 'w-[32%]'}`}>品名 / メーカー</th>
                            <th className={`py-1 px-2 text-left border-r border-slate-900 ${displayPrice ? 'w-[25%]' : 'w-[40%]'}`}>型式 / 寸法</th>
                            {isDualQty ? (
                                <>
                                    <th className="py-1 px-2 text-right w-[10%] border-r border-slate-900">受注数</th>
                                    <th className={`py-1 px-2 text-center w-[10%] border-slate-900 ${displayPrice ? 'border-r' : ''}`}>{isWorkSlip ? '出庫数' : '納品数'}</th>
                                </>
                            ) : (
                                <th className={`py-1 px-2 text-right w-[10%] border-slate-900 ${displayPrice ? 'border-r' : ''}`}>数量</th>
                            )}
                            {displayPrice && <th className="py-1 px-2 text-right w-[10%] border-r border-slate-900">単価</th>}
                            {displayPrice && <th className="py-1 px-2 text-right w-[15%]">金額</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 16 }).map((_, idx) => {
                            const item = slip.items?.[idx];
                            const orderedQty = item ? item.quantity : 0;
                            // 出庫作業票(outbound)の場合は、納品数欄を強制的に白抜き(null)にする
                            const deliveredQty = item ? (isWorkSlip ? null : (item.deliveredQuantity ?? item.quantity)) : null;
                            const amount = item ? ((item.appliedPrice || 0) * (item.deliveredQuantity ?? item.quantity)) : 0;

                            const isLastRow = idx === 15;
                            return (
                                <tr key={idx} className={`${isLastRow ? '' : 'border-b'} h-[10mm] border-slate-200 ${orderedQty < 0 ? 'bg-red-50 text-red-600 font-bold' : ''}`}>
                                    <td className="text-center border-r">{idx + 1}</td>
                                    {isDetail && <td className="text-center border-r font-mono">{item?.date?.slice(5).replace('-', '/') || ''}</td>}
                                    <td className="px-2 border-r truncate font-bold">
                                        <div>{item?.name || ''}</div>
                                        {item?.manufacturer && <div className="text-[8px] text-slate-500 font-normal leading-tight">{item.manufacturer}</div>}
                                        {item?.sourceSlipNo && <div className="text-[7px] text-slate-400 font-mono leading-none mt-0.5">伝票: {item.sourceSlipNo}</div>}
                                    </td>
                                    <td className="px-2 border-r truncate">{item ? `${item.model} ${item.dimensions}` : ''}</td>

                                    {isDualQty ? (
                                        <>
                                            <td className={`px-2 text-right border-r font-mono ${isProvisional ? 'text-slate-500' : ''}`}>
                                                {item ? (orderedQty < 0 ? `▲${Math.abs(orderedQty).toLocaleString()}` : orderedQty.toLocaleString()) : ''}
                                            </td>
                                            <td className={`px-2 text-center font-mono font-black ${!item ? '' : (deliveredQty === null ? 'bg-slate-50' : (deliveredQty !== orderedQty ? 'text-rose-600' : ''))} ${displayPrice ? 'border-r' : ''}`}>
                                                {/* 出庫伝票(isWorkSlip)かつアイテムがある場合は、手書き用に空欄を表示 */}
                                                {item ? (deliveredQty === null ? '' : (deliveredQty < 0 ? `▲${Math.abs(deliveredQty).toLocaleString()}` : deliveredQty.toLocaleString())) : ''}
                                            </td>
                                        </>
                                    ) : (
                                        <td className={`px-2 text-right font-mono ${displayPrice ? 'border-r' : ''}`}>
                                            {item ? (orderedQty < 0 ? `▲${Math.abs(orderedQty).toLocaleString()}` : orderedQty.toLocaleString()) : ''}
                                        </td>
                                    )}

                                    {displayPrice && <td className="px-2 text-right border-r font-mono">{item ? `¥${(item.appliedPrice || 0).toLocaleString()}` : ''}</td>}
                                    {displayPrice && <td className="px-2 text-right font-mono font-bold">{item ? (amount < 0 ? `▲¥${Math.abs(amount).toLocaleString()}` : `¥${amount.toLocaleString()}`) : ''}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="mt-auto pt-4 flex justify-between items-end gap-4">
                    <div className="flex-grow">
                        {slip.note && (
                            <div className="p-3 border-2 border-slate-300 rounded-[1rem] text-[10px] text-slate-700 min-h-[15mm]">
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">備考 / Memo</div>
                                <div className="whitespace-pre-wrap leading-relaxed">{slip.note}</div>
                            </div>
                        )}
                    </div>

                    {displayPrice && (
                        <div className="border-2 border-slate-800 p-2 bg-slate-50 min-w-[200px] shadow-sm">
                            {isDetail ? (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-base pt-1 font-black text-slate-900"><span className="text-slate-700">税抜合計金額 (10%対象)</span><span className="font-mono underline underline-offset-2 decoration-double decoration-slate-900">¥{(slip.totalAmount || 0).toLocaleString()}</span></div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center font-bold text-[8px] border-b border-slate-300 pb-1 mb-1 text-slate-500 uppercase tracking-widest">御計算金額 (税抜)</div>
                                    <div className="text-xl font-mono font-black text-center">{(slip.totalAmount || 0) < 0 ? `▲¥${Math.abs(slip.totalAmount || 0).toLocaleString()}` : `¥${(slip.totalAmount || 0).toLocaleString()}`}</div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {!isDetail && (
                    <div className="pt-3 flex justify-end gap-0">
                        {isWorkSlip ? (
                            /* 出庫用: お客様直接引取りサイン欄を追加 */
                            <table className="border-collapse border-2 border-slate-900 w-full text-[8px] h-24">
                                <tbody>
                                    <tr className="bg-slate-50 border-b border-slate-900">
                                        <td className="border-r border-slate-900 py-1 font-black text-center w-[33%]">出庫担当者 (S)</td>
                                        <td className="border-r border-slate-900 py-1 font-black text-center w-[33%]">配送担当者 (D)</td>
                                        <td className="py-1 font-black text-center w-[34%] text-blue-800 bg-blue-50/20">お客様引取</td>
                                    </tr>
                                    <tr className="h-20">
                                        <td className="border-r border-slate-900"></td>
                                        <td className="border-r border-slate-900"></td>
                                        <td className="bg-white"></td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            /* 仮納品書: 現場荷受用 */
                            <table className="border-collapse border-2 border-slate-900 w-full text-[8px] h-24">
                                <tbody>
                                    <tr className="bg-slate-50 border-b border-slate-900">
                                        <td className="border-r border-slate-900 py-1 font-black text-center w-1/4 text-slate-400">出庫印</td>
                                        <td className="border-r border-slate-900 py-1 font-black text-center w-1/4 text-slate-400">配送印</td>
                                        <td className="border-r border-slate-900 py-1 font-black text-center w-1/4">受領 (直接引取)</td>
                                        <td className="py-1 font-black text-center w-1/4 text-blue-800 bg-blue-50/20">現場荷受サイン (受領印)</td>
                                    </tr>
                                    <tr className="h-20 text-center align-middle">
                                        {/* 出庫印 */}
                                        <td className="border-r border-slate-900 group relative">
                                            <input
                                                value={slip.issuerPerson || ''}
                                                onChange={e => onUpdateSlip?.({ issuerPerson: e.target.value })}
                                                placeholder="出庫者"
                                                className="absolute inset-0 w-full h-full opacity-0 focus:opacity-100 hover:opacity-10 dark:hover:opacity-30 bg-white/80 text-center font-black z-10 outline-none text-[10px] print:hidden"
                                            />
                                            {slip.issuerPerson && (
                                                <div className="inline-block border-2 border-red-500 text-red-500 rounded-full w-14 h-14 flex items-center justify-center font-black text-xs rotate-[-12deg] shadow-sm transform transition-transform">
                                                    {slip.issuerPerson}
                                                </div>
                                            )}
                                        </td>
                                        {/* 配送印 */}
                                        <td className="border-r border-slate-900 group relative">
                                            <input
                                                value={slip.deliveryPerson || ''}
                                                onChange={e => onUpdateSlip?.({ deliveryPerson: e.target.value })}
                                                placeholder="配送者"
                                                className="absolute inset-0 w-full h-full opacity-0 focus:opacity-100 hover:opacity-10 dark:hover:opacity-30 bg-white/80 text-center font-black z-10 outline-none text-[10px] print:hidden"
                                            />
                                            {slip.deliveryPerson && (
                                                <div className="inline-block border-2 border-red-500 text-red-500 rounded-full w-14 h-14 flex items-center justify-center font-black text-xs rotate-[-12deg] shadow-sm transform transition-transform">
                                                    {slip.deliveryPerson}
                                                </div>
                                            )}
                                        </td>
                                        {/* 受領印 (直接引取) */}
                                        <td className="border-r border-slate-900 group relative">
                                            <input
                                                value={slip.receiverPerson || ''}
                                                onChange={e => onUpdateSlip?.({ receiverPerson: e.target.value })}
                                                placeholder="受領者"
                                                className="absolute inset-0 w-full h-full opacity-0 focus:opacity-100 hover:opacity-10 dark:hover:opacity-30 bg-white/80 text-center font-black z-10 outline-none text-[10px] print:hidden"
                                            />
                                            {slip.receiverPerson && (
                                                <div className="inline-block border-2 border-red-500 text-red-500 rounded-full w-14 h-14 flex items-center justify-center font-black text-xs rotate-[-12deg] shadow-sm transform transition-transform">
                                                    {slip.receiverPerson}
                                                </div>
                                            )}
                                        </td>
                                        <td className="bg-white"></td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
            <div className="text-[8px] text-slate-400 flex justify-between font-mono mt-4 shrink-0">
                <span>{isWorkSlip ? 'WAREHOUSE OPERATION SLIP - PICKING LIST' : 'PROVISIONAL DELIVERY NOTE - RECEIPT'} / {slip.slipNumber || 'PENDING'}</span>
                {pageNum && <span>Page {pageNum} / {totalPages}</span>}
            </div>
        </div>
    );
};
const CartItemRow = React.memo(({
    item,
    index,
    activeMode,
    onUpdateCart,
    handleRegisterToMaster,
    onDelete
}: {
    item: SlipItem,
    index: number,
    activeMode: 'sales' | 'return',
    onUpdateCart: React.Dispatch<React.SetStateAction<SlipItem[]>>,
    handleRegisterToMaster: (item: SlipItem) => void,
    onDelete: (index: number) => void
}) => {
    const isReturn = activeMode === 'return';
    const [isNoteOpen, setIsNoteOpen] = useState(!!item.slipItemNote);
    const historyInfo = (item as any).historyMonth ? {
        month: (item as any).historyMonth,
        available: (item as any).availableQuantity
    } : null;

    const isExceeding = isReturn && historyInfo && Math.abs(item.quantity) > historyInfo.available;

    return (
        <Draggable draggableId={item.id} index={index}>
            {(provided, snapshot) => (
                <tr
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`group transition-all ${snapshot.isDragging ? 'bg-blue-100 shadow-xl' : 'hover:bg-slate-50'} ${isExceeding ? 'bg-rose-50' : ''}`}
                    style={provided.draggableProps.style}
                >
                    <td className="w-8 text-center">
                        <div className="flex flex-col items-center gap-1">
                            <GripVertical size={16} className="text-slate-300 mx-auto" />
                            <div className="text-[8px] font-mono text-slate-300 transform -rotate-90 origin-center translate-y-2">#{index + 1}</div>
                        </div>
                    </td>
                    <td className="py-4">
                        <div className="flex flex-col gap-1.5">
                            <input
                                value={item.name}
                                onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, name: e.target.value } : pi))}
                                placeholder="品名"
                                className={`w-full bg-transparent border-b border-transparent font-bold ${isReturn ? 'text-rose-900' : 'text-slate-800'} outline-none`}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={item.manufacturer || ''}
                                    onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, manufacturer: e.target.value } : pi))}
                                    placeholder="メーカー"
                                    className="text-xs font-bold text-slate-700 bg-white/50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                                />
                                <input
                                    value={item.model || ''}
                                    onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, model: e.target.value } : pi))}
                                    placeholder="型式"
                                    className="text-xs font-bold text-slate-700 bg-white/50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                                />
                                <input
                                    value={item.dimensions || ''}
                                    onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, dimensions: e.target.value } : pi))}
                                    placeholder="寸法"
                                    className="col-span-2 text-xs font-bold text-slate-700 bg-white/50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                                />
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                {isReturn ? (
                                    historyInfo ? (
                                        <div className="flex gap-1">
                                            <span className="px-1.5 py-0.5 bg-rose-100 text-[8px] font-black text-rose-600 rounded border border-rose-200 uppercase tracking-tighter">
                                                {historyInfo.month} 納品分
                                            </span>
                                            <span className={`px-1.5 py-0.5 ${isExceeding ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'} text-[8px] font-black rounded border border-slate-200`}>
                                                返品可能残: {historyInfo.available}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="px-1.5 py-0.5 bg-amber-50 text-[8px] font-black text-amber-600 rounded border border-amber-200">履歴外アイテム</span>
                                    )
                                ) : (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-black text-slate-400 rounded border border-slate-200">通常入力</span>
                                )}
                                {item.slipItemNote && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-[8px] font-black text-amber-600 rounded border border-amber-200 flex items-center gap-1">
                                        <MessageSquare size={10} /> メモあり
                                    </span>
                                )}
                            </div>
                            {isNoteOpen && (
                                <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                                    <div className="relative group/note">
                                        <MessageSquare size={14} className="absolute left-3 top-3 text-amber-400" />
                                        <textarea
                                            value={item.slipItemNote || ''}
                                            onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, slipItemNote: e.target.value } : pi))}
                                            placeholder="単価調整の理由など（例：傷あり特価、旧材処分など）"
                                            className="w-full pl-9 pr-4 py-2 bg-amber-50/50 border border-amber-100 rounded-xl text-[11px] font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-200 transition-all min-h-[60px] placeholder:text-amber-300"
                                        />
                                        <button 
                                            onClick={() => setIsNoteOpen(false)} 
                                            className="absolute right-2 top-2 p-1 text-amber-400 hover:text-amber-600 opacity-0 group-hover/note:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="text-center">
                        <div className="relative">
                            <input
                                type="number"
                                value={item.quantity}
                                onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, quantity: val } : pi));
                                }}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                className={`w-full py-2 border rounded-xl text-center font-black bg-slate-50 outline-none no-spin-buttons ${isExceeding ? 'border-rose-500 text-rose-600 animate-pulse' : 'focus:border-blue-400'}`}
                            />
                            {isExceeding && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[8px] px-2 py-1 rounded whitespace-nowrap shadow-lg z-50">
                                    実績超過！可能数: {historyInfo.available}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col items-center -space-y-0.5 mb-1 text-[9px] font-black tracking-tighter">
                                <div className="text-slate-400">標準: ¥{(item.sellingPrice || 0).toLocaleString()}</div>
                                {item.listPrice > 0 && <div className="text-slate-300">定価: ¥{item.listPrice.toLocaleString()}</div>}
                            </div>
                            <input
                                type="number"
                                value={item.appliedPrice || 0}
                                onChange={e => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, appliedPrice: parseInt(e.target.value) || 0 } : pi))}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                className="w-full py-2 border rounded-xl text-center font-black bg-slate-50 outline-none text-emerald-600 focus:ring-2 focus:ring-emerald-500 no-spin-buttons"
                            />
                            <div className="flex items-center gap-1 mt-1">
                                <button 
                                    onClick={() => setIsNoteOpen(!isNoteOpen)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${isNoteOpen ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}
                                >
                                    <MessageSquare size={12} />
                                    {isNoteOpen ? '閉じる' : 'メモ'}
                                </button>
                                <button 
                                    onClick={() => onUpdateCart(p => p.map(pi => pi.id === item.id ? { ...pi, name: pi.name.includes('※特値') ? pi.name.replace(' ※特値', '').replace('※特値', '').trim() : `${pi.name} ※特値` } : pi))}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${item.name.includes('※特値') ? 'bg-rose-100 text-rose-600' : 'text-slate-300 hover:text-rose-400 hover:bg-rose-50'}`}
                                >
                                    <Sparkles size={12} />
                                    特値
                                </button>
                            </div>
                        </div>
                    </td>
                    <td className="text-right">
                        <button onClick={() => onDelete(index)} className="p-2 text-rose-300 hover:text-rose-500">
                            <Trash2 size={18} />
                        </button>
                    </td>
                </tr>
            )}
        </Draggable>
    );
});

export const SlipManager: React.FC<{
    mode: 'sales' | 'return';
    initialTab?: 'create' | 'pending' | 'reslip' | 'history';
    onClose: () => void;
    cart: SlipItem[];
    onUpdateCart: React.Dispatch<React.SetStateAction<SlipItem[]>>;
    onClearCart: () => void;
    defaultCustomer: string | null;
    customers: Customer[];
    pricingRules: PricingRule[];
    masterItems: MaterialItem[];
    settings: AppSettings | null;
    onTabChange?: (tab: 'create' | 'pending' | 'reslip' | 'history') => void;
    onEditModeChange?: (isEditing: boolean) => void;
}> = ({ mode, initialTab = 'create', onClose, cart, onUpdateCart, onClearCart, defaultCustomer, customers, pricingRules, masterItems, settings, onTabChange, onEditModeChange }) => {
    const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'reslip' | 'history'>(initialTab);
    const [activeMode, setActiveMode] = useState<'sales' | 'return'>(mode);

    // Sync internal state with prop if it changes? Or just init? 
    // Usually standard is to rely on internal, but notifying parent.
    const handleTabChange = (tab: 'create' | 'pending' | 'reslip' | 'history') => {
        setActiveTab(tab);
        if (onTabChange) onTabChange(tab);
    };
    const [slips, setSlips] = useState<Slip[]>([]);
    
    // Auto-chunk slips > 16 items for printing pagination without modifying internal slip logic
    const [rawPrintingSlips, setRawPrintingSlips] = useState<Slip[]>([]);
    const printingSlips = useMemo(() => {
        const result: Slip[] = [];
        rawPrintingSlips.forEach(slip => {
            if (slip.type === 'cover') {
                result.push(slip);
                return;
            }
            const limit = 16;
            if (!slip.items || slip.items.length <= limit) {
                result.push(slip);
                return;
            }
            for (let i = 0; i < slip.items.length; i += limit) {
                const chunk = slip.items.slice(i, i + limit);
                result.push({
                    ...slip,
                    id: `${slip.id || 'p'}-pg${Math.floor(i/limit) + 1}`,
                    items: chunk,
                });
            }
        });
        return result;
    }, [rawPrintingSlips]);
    const setPrintingSlips = setRawPrintingSlips;

    const [confirmingOutbound, setConfirmingOutbound] = useState<Slip | null>(null);
    const [actualQuantities, setActualQuantities] = useState<Record<string, number>>({});
    const [issuerName, setIssuerName] = useState('');
    const [editingSlipId, setEditingSlipId] = useState<string | null>(null);
    const [preEditTab, setPreEditTab] = useState<'create' | 'pending' | 'reslip' | 'history'>('pending');
    const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);

    useEffect(() => {
        if (onEditModeChange) onEditModeChange(!!editingSlipId);
    }, [editingSlipId, onEditModeChange]);
    const [previewScale, setPreviewScale] = useState(1);
    const [forceDisplayPrice, setForceDisplayPrice] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            // A4 width in px (approximate for screen)
            // 210mm is roughly 794px at 96dpi. We want some padding.
            // We can just use the window width / 2 or so for the preview to fit nicely.
            // Let's try to fit 210mm into the available width with some margin.
            const availableWidth = window.innerWidth - 64; // loose padding
            const availableHeight = window.innerHeight - 100; // header padding
            const a4Width = 794; // 210mm @ 96dpi
            const a4Height = 1123; // 297mm @ 96dpi

            const scaleW = availableWidth / a4Width;
            const scaleH = availableHeight / a4Height;

            // Use the smaller scale to fit entirely, but cap at 1.0 or slightly larger if big screen
            setPreviewScale(Math.min(scaleW, scaleH, 1.2));
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [customerName, setCustomerName] = useState<string>(defaultCustomer || '');
    const [siteName, setSiteName] = useState('');
    const [orderingPerson, setOrderingPerson] = useState('');
    const [customerOrderNumber, setCustomerOrderNumber] = useState('');
    const [receivingPerson, setReceivingPerson] = useState('');
    const [slipDate, setSlipDate] = useState(new Date().toISOString().slice(0, 10));
    const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
    const [time, setTime] = useState<DeliveryTime>('none');
    const [dest, setDest] = useState<DeliveryDestination>('none');
    const [note, setNote] = useState('');

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showSiteSuggestions, setShowSiteSuggestions] = useState(false);
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set<string>());
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzingReturn, setIsAnalyzingReturn] = useState(false);
    const [returnAmbiguityResults, setReturnAmbiguityResults] = useState<any[]>([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Map<string, any>>(new Map());
    const [showReturnResolutionModal, setShowReturnResolutionModal] = useState(false);

    useEffect(() => {
        const unsubscribe = storage.subscribeToSlips(setSlips);
        return () => { if (unsubscribe && typeof unsubscribe === 'function') (unsubscribe as any)(); };
    }, []);

    // 顧客・現場が変更された際にカート内の単価を自動再計算する
    useEffect(() => {
        if (cart.length === 0) return;
        
        const nextCart = cart.map(item => {
            // マスターに存在する資材のみ再計算対象とする（自由入力行は除外）
            const master = masterItems.find(mi => mi.id === item.id);
            if (!master) return item;
            
            const newPrice = getAppliedPrice(master, customerName, siteName, pricingRules);
            if (newPrice !== item.appliedPrice) {
                return { ...item, appliedPrice: newPrice };
            }
            return item;
        });

        // 差分がある場合のみ更新を実行
        const isChanged = nextCart.some((it, idx) => it.appliedPrice !== cart[idx].appliedPrice);
        if (isChanged) {
            onUpdateCart(nextCart);
        }
    }, [customerName, siteName, pricingRules, masterItems, onUpdateCart]); // cart.lengthの変化も含むために、cartは依存に含めず、内容比較で制御

    const { pendingOutbounds, archivedSlips, reslips } = useMemo(() => {
        const pending: Slip[] = []; const archived: Slip[] = []; const res: Slip[] = [];
        slips.forEach((s: Slip) => {
            if (s.type === 'reslip') res.push(s);
            else if (s.type === 'outbound') { if (!s.isClosed) pending.push(s); }
            else archived.push(s);
        });
        return { pendingOutbounds: pending, archivedSlips: archived, reslips: res };
    }, [slips]);

    const handleReturnAIAnalysis = async (file: File) => {
        if (!customerName || !siteName) return alert('顧客名と現場名を先に選択してください。');
        
        setIsAnalyzingReturn(true);
        try {
            const context = siteHistoryItems.map(h => ({
                id: h.id + '-' + h.historyMonth + '-' + h.appliedPrice,
                name: h.name,
                model: h.model,
                dimensions: h.dimensions,
                price: h.appliedPrice,
                date: h.historyMonth,
                maxAvailable: h.availableQuantity
            }));

            const result = await (storage as any).parseReturnMemoInFirebase ? await (storage as any).parseReturnMemoInFirebase(file, context) : await parseReturnMemo(file, context);
            if (result && result.matches) {
                setReturnAmbiguityResults(result.matches);
                setShowReturnResolutionModal(true);
            }
        } catch (error) {
            console.error(error);
            alert('AI解析中にエラーが発生しました。');
        } finally {
            setIsAnalyzingReturn(false);
        }
    };



    const existingSiteNames = useMemo(() => {
        if (!customerName) return [];
        const sites = new Set<string>();
        pricingRules.forEach(r => {
            if (r.customerName === customerName && r.siteName) {
                sites.add(r.siteName);
            }
        });
        return Array.from(sites).sort();
    }, [customerName, pricingRules]);

    const filteredSiteSuggestions = useMemo(() => {
        if (!siteName.trim()) return existingSiteNames;
        const q = siteName.toLowerCase();
        return existingSiteNames.filter(s => s.toLowerCase().includes(q));
    }, [siteName, existingSiteNames]);

    const handleApplyAIResults = (confirmedItems: any[]) => {
        const newCartItems = confirmedItems.filter(ci => ci.selectedItem).map(item => ({
            ...item.selectedItem,
            quantity: -Math.abs(item.quantity),
            deliveredQuantity: 0,
            id: generateId(),
            historyMonth: item.selectedItem.date,
            availableQuantity: item.selectedItem.maxAvailable,
            updatedAt: Date.now()
        }));
        onUpdateCart(prev => [...prev, ...newCartItems]);
        setShowReturnResolutionModal(false);
    };

    const filteredSuggestions = useMemo(() => {
        if (!customerName || !showSuggestions) return [];
        return customers.filter((c: Customer) => normalize(c.name).includes(normalize(customerName))).slice(0, 5);
    }, [customerName, showSuggestions, customers]);

    // 現場の納品履歴アイテム（過去の「山」）の計算
    const siteHistoryItems = useMemo(() => {
        if (!customerName || !siteName) return [];
        
        // (キー) -> 実績データ
        const historyMap = new Map<string, { 
            name: string; model: string; dims: string; price: number; month: string; 
            totalDelivered: number; totalReturned: number; item: SlipItem 
        }>();

        slips.forEach(s => {
            // 現在編集中の伝票は実績計算から除外して、過剰返品チェックの二重カウントを防ぐ
            if (s.customerName === customerName && s.constructionName === siteName && s.id !== editingSlipId) {
                const month = s.date.slice(0, 7); // YYYY-MM
                if (s.type === 'provisional' || s.type === 'delivery') {
                    s.items.forEach(item => {
                        const key = `${item.name}-${item.model}-${item.dimensions}-${item.appliedPrice}-${month}`;
                        if (!historyMap.has(key)) {
                            historyMap.set(key, { 
                                name: item.name, model: item.model, dims: item.dimensions, 
                                price: item.appliedPrice, month, 
                                totalDelivered: 0, totalReturned: 0, item 
                            });
                        }
                        const entry = historyMap.get(key)!;
                        entry.totalDelivered += (item.deliveredQuantity || item.quantity);
                    });
                } else if (s.type === 'return') {
                    s.items.forEach(item => {
                        const key = `${item.name}-${item.model}-${item.dimensions}-${item.appliedPrice}-${item.date?.slice(0, 7) || month}`;
                        if (historyMap.has(key)) {
                            historyMap.get(key)!.totalReturned += Math.abs(item.quantity);
                        }
                    });
                }
            }
        });

        return Array.from(historyMap.values())
            .map(entry => ({
                ...entry.item,
                availableQuantity: entry.totalDelivered - entry.totalReturned,
                totalDelivered: entry.totalDelivered,
                totalReturned: entry.totalReturned,
                historyMonth: entry.month,
                appliedPrice: entry.price
            }))
            .filter(i => i.availableQuantity > 0);
    }, [customerName, siteName, slips]);

    const itemSuggestions = useMemo(() => {
        if (!itemSearchQuery.trim()) return [];
        if (activeMode === 'return') {
            // 返品モード時は納品履歴から検索
            return siteHistoryItems.filter(i => 
                normalizeForSearch(i.name).includes(normalizeForSearch(itemSearchQuery)) ||
                normalizeForSearch(i.model || '').includes(normalizeForSearch(itemSearchQuery)) ||
                normalizeForSearch(i.dimensions || '').includes(normalizeForSearch(itemSearchQuery))
            ).slice(0, 30);
        }
        return filterAndSortItems(masterItems, itemSearchQuery).slice(0, 30);
    }, [itemSearchQuery, masterItems, activeMode, siteHistoryItems]);

    const handleAddFromMaster = (item: any) => {
        const price = getAppliedPrice(item, customerName, siteName, pricingRules);
        const itemToAdd = activeMode === 'return' 
            ? { ...item, quantity: -1, deliveredQuantity: 0, appliedPrice: price }
            : { ...item, quantity: 1, appliedPrice: price, deliveredQuantity: 1 };
        
        onUpdateCart(prev => [...prev, itemToAdd]);
        setItemSearchQuery(''); setShowItemSuggestions(false);
        setSelectedSuggestions(new Map());
    };

    const handleToggleSuggestion = (item: any) => {
        const key = item.id + (item.historyMonth || '');
        const next = new Map(selectedSuggestions);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.set(key, item);
        }
        setSelectedSuggestions(next);
    };

    const handleBulkAdd = () => {
        if (selectedSuggestions.size === 0) return;
        const itemsToAdd = Array.from(selectedSuggestions.values()).map((item: any) => {
            const price = getAppliedPrice(item, customerName, siteName, pricingRules);
            return activeMode === 'return'
                ? { ...item, quantity: -1, deliveredQuantity: 0, appliedPrice: price }
                : { ...item, quantity: 1, appliedPrice: price, deliveredQuantity: 1 };
        });
        onUpdateCart(prev => [...prev, ...itemsToAdd]);
        setItemSearchQuery(''); setShowItemSuggestions(false);
        setSelectedSuggestions(new Map());
    };

    const handleManualAdd = useCallback(() => {
        const newItem: SlipItem = {
            id: generateId(),
            category: '消耗品・雑材',
            name: '',
            manufacturer: '',
            model: '',
            dimensions: '',
            quantity: 1,
            unit: '個',
            location: '',
            listPrice: 0,
            sellingPrice: 0,
            costPrice: 0,
            appliedPrice: 0,
            deliveredQuantity: 1,
            updatedAt: Date.now()
        };
        onUpdateCart(prev => [...prev, newItem]);
    }, [onUpdateCart]);

    const handleDeleteFromCart = useCallback((index: number) => {
        onUpdateCart(prev => prev.filter((_, i) => i !== index));
    }, [onUpdateCart]);

    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(cart);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        onUpdateCart(items);
    }, [cart, onUpdateCart]);

    const handleRegisterToMaster = useCallback(async (item: SlipItem) => {
        if (!item.name) return alert('品名を入力してください');
        if (window.confirm(`${item.name} (${item.model}) を資材マスターに登録しますか？`)) {
            const materialData: Omit<MaterialItem, 'id' | 'updatedAt'> = {
                name: item.name,
                model: item.model || '',
                dimensions: item.dimensions || '',
                manufacturer: item.manufacturer || '',
                category: item.category || '消耗品・雑材',
                unit: item.unit || '個',
                costPrice: item.costPrice || 0,
                listPrice: item.listPrice || 0,
                sellingPrice: item.sellingPrice || item.appliedPrice || 0,
                quantity: 0,
                location: '',
                notes: '伝票から自動登録'
            };
            await storage.addMaterial(materialData);
            alert('資材マスターに登録しました。');
            // IDを更新して、再登録を防ぐ
            onUpdateCart(prev => prev.map(i => i.id === item.id ? { ...i, id: 'registered-' + Date.now() } : i));
        }
    }, [onUpdateCart]);



    const handleSave = async () => {
        if (!customerName || cart.length === 0 || !receivingPerson.trim()) {
            return alert("必須項目（顧客、受付担当）を入力してください。");
        }
        setIsSaving(true);
        try {
            const processedItems = cart.map((i: SlipItem) => {
                // Ensure returns stay negative only if they are not intentionally positive (like fees)
                // Use i.quantity as-is to allow user flexibility in post-edit scenarios
                const qty = i.quantity;
                return { ...i, quantity: qty, deliveredQuantity: qty, date: slipDate };
            });

            // 返品モード時の過剰数量チェック
            if (activeMode === 'return') {
                const overReturns = processedItems.filter(i => {
                    const avail = (i as any).availableQuantity;
                    return avail !== undefined && Math.abs(i.quantity) > avail;
                });
                if (overReturns.length > 0) {
                    const names = overReturns.map(i => i.name).join(', ');
                    if (!window.confirm(`${names} の返品数が納品実績を超えていますが、よろしいですか？`)) {
                        setIsSaving(false);
                        return;
                    }
                }
            }

            const total = processedItems.reduce((s, i) => s + ((i.appliedPrice || 0) * i.quantity), 0);

            if (editingSlipId) {
                const updateData: Partial<Slip> = {
                    date: slipDate, orderDate, customerName, constructionName: siteName, items: processedItems,
                    totalAmount: total, taxAmount: Math.round(total * 0.1), grandTotal: Math.round(total * 1.1),
                    note, deliveryTime: time, deliveryDestination: dest, orderingPerson, customerOrderNumber, receivingPerson
                };
                try {
                    await storage.updateSlip(editingSlipId, updateData);
                    setEditingSlipId(null);
                    onClearCart();
                    handleTabChange(preEditTab); // return to the tab we came from
                } catch (e: any) {
                    alert(`保存に失敗しました: ${e?.message || '不明なエラー'}`);
                }
                return;
            } else {
                const gid = generateId();
                const sNo = generateSlipNumber();
                const newSlip: Omit<Slip, 'id'> = {
                    createdAt: Date.now(), date: slipDate, orderDate, customerName, constructionName: siteName, items: processedItems.map(i => ({ ...i, sourceSlipNo: sNo })),
                    totalAmount: total, taxAmount: Math.round(total * 0.1), grandTotal: Math.round(total * 1.1),
                    note, deliveryTime: time, deliveryDestination: dest, groupId: gid, slipNumber: sNo,
                    orderingPerson, customerOrderNumber, receivingPerson, type: activeMode === 'return' ? 'return' : 'outbound', isClosed: activeMode === 'return'
                };
                await storage.addSlip(cleanForFirestore(newSlip));
                // 新規保存時は自動的にピッキング用伝票を表示（金額表示なし）
                setPrintingSlips([{ ...newSlip, id: generateId() } as Slip]);
                onClearCart();
                handleTabChange(activeMode === 'return' ? 'history' : 'pending');
            }
        } finally { setIsSaving(false); }
    };

    const handleConfirmDelivery = async () => {
        if (!confirmingOutbound) return;
        if (!issuerName.trim()) {
            alert('出庫担当者の名前を入力してください。');
            return;
        }
        const issuer = issuerName.trim();

        const hasNegativeQuantity = confirmingOutbound.items.some(i => (actualQuantities[i.id] ?? i.quantity) < 0);
        if (hasNegativeQuantity) {
            alert('エラー: 出庫数にマイナスの値が含まれています。0以上の数値を入力してください。');
            return;
        }

        const hasOverQuantity = confirmingOutbound.items.some(i => (actualQuantities[i.id] ?? i.quantity) > i.quantity);
        if (hasOverQuantity && !window.confirm('受注数を超える数量が入力されています。よろしいですか？')) {
            return;
        }

        setIsSaving(true);
        try {
            const deliveredItems: SlipItem[] = []; const missingItems: SlipItem[] = [];
            confirmingOutbound.items.forEach((item, idx) => {
                const key = `${item.id}-${idx}`;
                const actual = actualQuantities[key] ?? item.quantity;
                const shortage = item.quantity - actual;
                if (actual > 0) deliveredItems.push({ ...item, quantity: item.quantity, deliveredQuantity: actual, sourceSlipNo: confirmingOutbound.slipNumber });
                if (shortage > 0) missingItems.push({ ...item, quantity: shortage, deliveredQuantity: 0 });
            });

            const total = deliveredItems.reduce((s, i) => s + ((i.appliedPrice || 0) * (i.deliveredQuantity ?? 0)), 0);
            const provSlip: Omit<Slip, 'id'> = {
                ...cleanForFirestore(confirmingOutbound),
                type: 'provisional',
                items: deliveredItems,
                totalAmount: total,
                grandTotal: Math.round(total * 1.1),
                taxAmount: Math.round(total * 0.1),
                slipNumber: confirmingOutbound.slipNumber,
                createdAt: Date.now(),
                issuerPerson: issuer,
                isClosed: true,
                isHandled: true // Sync correctly back to LINK so the order is marked completed
            };

            await storage.addSlip(cleanForFirestore(provSlip));
            if (confirmingOutbound.id) await storage.updateSlip(confirmingOutbound.id, { isClosed: true, isHandled: true });

            if (missingItems.length > 0) {
                const rs: Omit<Slip, 'id'> = {
                    ...cleanForFirestore(confirmingOutbound),
                    type: 'reslip',
                    items: missingItems,
                    totalAmount: 0,
                    taxAmount: 0,
                    grandTotal: 0,
                    slipNumber: `${confirmingOutbound.slipNumber}-RES`,
                    createdAt: Date.now() + 50,
                    note: (confirmingOutbound.note || '') + ' [欠品分再伝票]',
                    isClosed: false
                };
                await storage.addSlip(cleanForFirestore(rs));
            }
            setConfirmingOutbound(null);
            setIssuerName('');
            handleTabChange(missingItems.length > 0 ? 'reslip' : 'pending');
            // お客様渡し用の仮納品書を発行
            setPrintingSlips([{ ...provSlip, id: generateId() } as Slip]);
        } finally { setIsSaving(false); }
    };

    const handleInvoiceIssuance = (cName: string, targetSite: string | null, allSlipsForCustomer: Slip[]) => {
        const closingDay = customers.find(c => c.name === cName)?.closingDay || 99;
        const [y, m] = targetMonth.split('-').map(Number);
        
        // 発行日（締日）の計算
        const lastDayOfMonth = new Date(y, m, 0).getDate();
        const invoiceDay = (closingDay === 99 || closingDay > lastDayOfMonth) ? lastDayOfMonth : closingDay;
        const calculatedInvoiceDate = `${y}-${String(m).padStart(2, '0')}-${String(invoiceDay).padStart(2, '0')}`;

        let start: string, end: string;
        if (closingDay === 99) { start = `${y}-${String(m).padStart(2, '0')}-01`; end = `${y}-${String(m).padStart(2, '0')}-31`; }
        else {
            const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
            const pLastDay = new Date(py, pm, 0).getDate();
            const startDay = Math.min(closingDay + 1, pLastDay);
            start = `${py}-${String(pm).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
            end = `${y}-${String(m).padStart(2, '0')}-${String(closingDay).padStart(2, '0')}`;
        }
        const validSlips = allSlipsForCustomer.filter(s => s.date >= start && s.date <= end && (s.type === 'provisional' || s.type === 'return'));
        if (validSlips.length === 0) return alert("対象期間内に確定済みのデータが存在しません。");

        const siteItemsMap = new Map<string, Map<string, SlipItem & { sourceSlipNo?: string }>>();
        const siteTotals = new Map<string, number>();

        validSlips.forEach(s => {
            const currentSKey = formatSiteName(s.constructionName);
            if (!siteItemsMap.has(currentSKey)) siteItemsMap.set(currentSKey, new Map());
            const itemsMap = siteItemsMap.get(currentSKey)!;

            s.items.forEach(i => {
                const qty = i.deliveredQuantity ?? i.quantity; if (qty === 0) return;
                const isReturning = s.type === 'return' || qty < 0;
                const itemKey = `${s.date}_${s.slipNumber || 'UNK'}_${isReturning ? 'RET' : 'SALE'}_${i.name}_${i.model}_${i.appliedPrice}`;

                if (itemsMap.has(itemKey)) {
                    const ex = itemsMap.get(itemKey)!;
                    ex.quantity += qty;
                    ex.deliveredQuantity = ex.quantity;
                } else {
                    itemsMap.set(itemKey, {
                        ...i,
                        name: isReturning ? `(返品) ${i.name}` : i.name,
                        quantity: qty,
                        deliveredQuantity: qty,
                        date: s.date,
                        sourceSlipNo: s.slipNumber
                    });
                }
                siteTotals.set(currentSKey, (siteTotals.get(currentSKey) || 0) + ((i.appliedPrice || 0) * qty));
            });
        });

        const allDocs: Slip[] = [];
        const siteEntries = Array.from(siteTotals.entries());
        const totalNet = siteEntries.reduce((acc, e) => acc + e[1], 0);
        const totalTax = Math.round(totalNet * 0.1);

        if (!targetSite) {
            allDocs.push({
                id: 'cover-' + Date.now(), customerName: cName, constructionName: '全現場一括集計', items: [], totalAmount: totalNet,
                taxAmount: totalTax, grandTotal: totalNet + totalTax, date: calculatedInvoiceDate, type: 'cover',
                createdAt: Date.now(), siteSummaries: siteEntries.map(([name, total]) => ({ name, total })), deliveryTime: 'none', deliveryDestination: 'none',
                slipNumber: `INV-${targetMonth.replace('-', '')}`, isClosed: true,
                previousBillingAmount: 0, paymentReceived: 0, carriedForwardAmount: 0
            } as Slip);
        }

        siteItemsMap.forEach((items, sName) => {
            if (targetSite && formatSiteName(targetSite) !== sName) return;
            const sItems = Array.from(items.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const sNet = sItems.reduce((acc, b) => acc + ((b.appliedPrice || 0) * (b.deliveredQuantity || 0)), 0);
            const sTax = Math.round(sNet * 0.1);
            const siteSlipNo = `DET-${targetMonth.replace('-', '')}-${sName.substring(0, 4)}`;
            const baseMeta: any = { customerName: cName, constructionName: sName, totalAmount: sNet, taxAmount: sTax, grandTotal: sNet + sTax, date: calculatedInvoiceDate, createdAt: Date.now(), isClosed: true, slipNumber: siteSlipNo };
            allDocs.push({ ...baseMeta, id: 'site-cover-' + sName, type: 'cover' });
            // 納品明細書 (日付別分割表示)
            const dateGroups = new Map<string, (SlipItem & { sourceSlipNo?: string })[]>();
            sItems.forEach(i => {
                const d = i.date || 'unknown';
                if (!dateGroups.has(d)) dateGroups.set(d, []);
                dateGroups.get(d)!.push(i);
            });

            Array.from(dateGroups.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, dItems]) => {
                const dNet = dItems.reduce((acc, b) => acc + ((b.appliedPrice || 0) * (b.deliveredQuantity || 0)), 0);
                const dTax = Math.round(dNet * 0.1);
                for (let i = 0; i < dItems.length; i += 16) {
                    allDocs.push({
                        ...baseMeta,
                        id: `delivery-${sName}-${date}-${i}`,
                        type: 'delivery',
                        items: dItems.slice(i, i + 16) as SlipItem[],
                        totalAmount: dNet,
                        taxAmount: dTax,
                        grandTotal: dNet + dTax,
                        date: date,
                        slipNumber: `DLV-${date.replace(/-/g, '')}${i > 0 ? `-${i/16 + 1}` : ''}`
                    });
                }
            });

            // 請求明細書 (一覧形式維持)
            for (let i = 0; i < sItems.length; i += 16) {
                const chunk = sItems.slice(i, i + 16);
                allDocs.push({
                    ...baseMeta,
                    id: `invoice-${sName}-${i}`,
                    type: 'invoice',
                    items: chunk,
                    slipNumber: `${siteSlipNo}-I${i / 16 + 1}`
                });
            }
        });
        setPrintingSlips(allDocs);
    };

    const handleClose = () => {
        if (editingSlipId) {
            if (!window.confirm("編集内容が保存されていませんがよろしいですか？")) {
                return;
            }
            // Reset edit state
            setEditingSlipId(null);
            onUpdateCart([]);
        }
        onClose();
    };

    const handleEditSlip = (s: Slip) => {
        if (!s.id) {
            alert('エラー: 伝票IDが見つかりません。伝票履歴から再度アクセスしてください。');
            return;
        }
        setPreEditTab(activeTab); // 編集前のタブを記憶
        setEditingSlipId(s.id);
        setActiveMode(s.type === 'return' ? 'return' : 'sales'); // 伝票タイプに合わせてモードを切り替え
        setCustomerName(s.customerName);
        setSiteName(s.constructionName || '');
        setOrderingPerson(s.orderingPerson || '');
        setCustomerOrderNumber(s.customerOrderNumber || '');
        setReceivingPerson(s.receivingPerson || '');
        setSlipDate(s.date);
        setOrderDate(s.orderDate || s.date);
        setTime(s.deliveryTime);
        setDest(s.deliveryDestination);
        setNote(s.note || '');
        onUpdateCart(s.items);
        handleTabChange('create');
    };

    const customerHierarchy = useMemo(() => {
        const map = new Map<string, Map<string, Slip[]>>();
        const keywords = historySearchQuery.toLowerCase().trim().split(/[\s\u3000]+/).filter(k => k.length > 0);
        const [y, m] = targetMonth.split('-').map(Number);

        // Filter logic: Check customer/site name OR item details
        const matches = (s: Slip) => {
            if (keywords.length === 0) return true;
            return keywords.every(q => {
                const metaMatch = s.customerName.toLowerCase().includes(q) || (s.constructionName || '').toLowerCase().includes(q);
                if (metaMatch) return true;
                // Check items
                return s.items.some(i =>
                    i.name.toLowerCase().includes(q) ||
                    (i.model || '').toLowerCase().includes(q) ||
                    (i.dimensions || '').toLowerCase().includes(q)
                );
            });
        };

        archivedSlips.filter(s => matches(s)).forEach(s => {
            const customer = customers.find(c => c.name === s.customerName);
            const closingDay = customer?.closingDay || 99;
            
            let start: string, end: string;
            if (closingDay === 99) {
                start = `${y}-${String(m).padStart(2, '0')}-01`;
                end = `${y}-${String(m).padStart(2, '0')}-31`;
            } else {
                const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
                const pLastDay = new Date(py, pm, 0).getDate();
                const startDay = Math.min(closingDay + 1, pLastDay);
                start = `${py}-${String(pm).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
                end = `${y}-${String(m).padStart(2, '0')}-${String(closingDay).padStart(2, '0')}`;
            }

            if (s.date >= start && s.date <= end) {
                if (!map.has(s.customerName)) map.set(s.customerName, new Map());
                const siteMap = map.get(s.customerName)!;
                const currentSiteKey = s.constructionName || '一般・共通';
                if (!siteMap.has(currentSiteKey)) siteMap.set(currentSiteKey, []);
                siteMap.get(currentSiteKey)!.push(s);
            }
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [archivedSlips, historySearchQuery, targetMonth, customers]);

    const tabs = initialTab === 'history'
        ? [{ id: 'history', label: '納品・請求履歴', icon: History }]
        : (editingSlipId
            ? [{ id: 'create', label: '仮納品書の修正', icon: Edit3 }]
            : [
                { id: 'create', label: '1. 出庫・返品作成', icon: Edit2 },
                { id: 'pending', label: `2. 出庫待ち (${pendingOutbounds.length})`, icon: Clock },
                { id: 'reslip', label: `3. 欠品・未納分 (${reslips.length})`, icon: AlertTriangle }
            ]);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {deletingSlipId && (
                <div className="fixed inset-0 z-[120] bg-slate-900/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-rose-600" />
                            </div>
                            <div>
                                <p className="font-black text-slate-900">伝票の削除</p>
                                <p className="text-xs text-slate-500 mt-0.5">この伝票を完全に削除します。元に戻せません。</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={() => setDeletingSlipId(null)} className="flex-1 py-2.5 rounded-xl border font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">キャンセル</button>
                            <button onClick={async () => { await storage.deleteSlip(deletingSlipId); setDeletingSlipId(null); }} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-sm hover:bg-rose-700 active:scale-95 transition-all">削除する</button>
                        </div>
                    </div>
                </div>
            )}
            {confirmingOutbound && (
                <div className="fixed inset-0 z-[110] bg-slate-900/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-slate-50 font-bold flex justify-between items-center"><h3>出庫実数の確定 (No. {confirmingOutbound.slipNumber})</h3><button onClick={() => { setConfirmingOutbound(null); setIssuerName(''); }}><X /></button></div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b text-slate-400 text-xs"><th className="text-left pb-2">品名 / 規格</th><th className="w-20 pb-2 text-center">受注数</th><th className="w-28 pb-2 text-center">出庫確定数</th></tr></thead>
                                <tbody className="divide-y">{confirmingOutbound.items.map((i, idx) => {
                                    const key = `${i.id}-${idx}`;
                                    const actual = actualQuantities[key] ?? i.quantity;
                                    const isOver = actual > i.quantity;
                                    const isNegative = actual < 0;
                                    return (
                                        <tr key={key} className={isOver || isNegative ? 'bg-rose-50/30' : ''}>
                                            <td className="py-3">
                                                <div className="font-bold">{i.name}</div>
                                                <div className="text-xs text-slate-600 font-bold font-mono tracking-tight">{i.model} {i.dimensions}</div>
                                            </td>
                                            <td className="text-center font-bold text-slate-400">{i.quantity}</td>
                                            <td>
                                                <div className="flex flex-col items-center">
                                                    <input
                                                        type="number"
                                                        value={actual}
                                                        onChange={e => setActualQuantities({ ...actualQuantities, [key]: parseInt(e.target.value) || 0 })}
                                                        onWheel={e => (e.target as HTMLElement).blur()}
                                                        className={`w-full border-2 rounded-xl py-2 text-center font-black text-lg outline-none transition-all no-spin-buttons ${isOver || isNegative ? 'border-rose-500 bg-white text-rose-600' : 'border-slate-100 bg-slate-50 text-blue-600 focus:border-blue-400'}`}
                                                    />
                                                    {isOver && <span className="text-[9px] text-rose-500 font-black mt-1">受注数を超過！</span>}
                                                    {isNegative && <span className="text-[9px] text-rose-500 font-black mt-1">マイナスは入力不可！</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t space-y-3">
                            <div>
                                <label className="block text-xs font-black text-slate-600 mb-1">出庫担当者名 <span className="text-rose-500">*必須</span></label>
                                <input
                                    type="text"
                                    value={issuerName}
                                    onChange={e => setIssuerName(e.target.value)}
                                    placeholder="担当者名を入力..."
                                    className="w-full border-2 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:border-blue-400 transition-colors"
                                    onKeyDown={e => e.key === 'Enter' && handleConfirmDelivery()}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setConfirmingOutbound(null); setIssuerName(''); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">キャンセル</button>
                                <button onClick={handleConfirmDelivery} disabled={!issuerName.trim()} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">数量を確定して仮納品書発行</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {printingSlips.length > 0 && (
                <>
                    <style>{`
                        @media print {
                            /* Hide the entire app */
                            body > #root { display: none !important; }
                            
                            /* Show only the portal */
                            #slip-print-portal { display: block !important; }
                            
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                width: 100% !important;
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                            }
                            
                            @page {
                                size: A4;
                                margin: 0;
                            }
                            
                            .slip-print-page {
                                width: 210mm;
                                height: 297mm;
                                page-break-after: always;
                                break-after: page;
                                overflow: hidden;
                                margin: 0;
                                padding: 0;
                                background: white;
                            }
                            
                            .slip-print-page:last-child {
                                page-break-after: auto;
                                break-after: auto;
                            }
                            
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                        
                        @media screen {
                            #slip-print-portal { display: none !important; }
                        }
                    `}</style>

                    {/* Screen preview version */}
                    <div className="print-preview-screen fixed inset-0 z-[300] bg-slate-900 overflow-auto flex flex-col items-center">
                        <div className="w-full sticky top-0 z-[120] bg-slate-800/90 p-4 flex justify-between items-center shadow-xl">
                            <div className="flex items-center gap-6">
                                <button onClick={() => setPrintingSlips([])} className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold hover:bg-white/20 transition-colors">閉じる</button>
                            </div>
                            <div className="flex items-center gap-4">
                                {printingSlips.some(s => s.type === 'provisional' || s.type === 'reslip' || s.type === 'outbound') && (
                                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors">
                                        <input type="checkbox" checked={forceDisplayPrice} onChange={e => setForceDisplayPrice(e.target.checked)} className="w-4 h-4 rounded border-slate-500 text-emerald-600 focus:ring-emerald-500 bg-slate-800" />
                                        <span className="text-xs font-bold text-white whitespace-nowrap">金額を表示して印刷</span>
                                    </label>
                                )}
                                <div className="flex items-center gap-1 bg-slate-700/50 px-2 py-1.5 rounded-lg border border-slate-600">
                                    <button onClick={() => setPreviewScale(s => Math.max(0.3, s - 0.1))} className="p-1 hover:bg-slate-600 rounded text-white transition-colors"><Minus size={16} /></button>
                                    <span className="text-xs font-mono font-bold text-white w-12 text-center">{Math.round(previewScale * 100)}%</span>
                                    <button onClick={() => setPreviewScale(s => Math.min(3.0, s + 0.1))} className="p-1 hover:bg-slate-600 rounded text-white transition-colors"><Plus size={16} /></button>
                                </div>
                                <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Printer size={18} /> 印刷を開始</button>
                            </div>
                        </div>
                        <div className="flex-grow w-full overflow-auto bg-slate-900 relative">
                            <div className="flex flex-col items-center py-8 origin-top min-h-full" style={{ minWidth: `calc(210mm * ${previewScale} + 64px)` }}>
                                <div className="flex flex-col items-center gap-8 origin-top" style={{ transform: `scale(${previewScale})` }}>
                                    {printingSlips.map((slip, idx) => (
                                        <div key={slip.id || idx} className="bg-white shadow-2xl shrink-0" style={{ width: '210mm', height: '297mm', overflow: 'hidden' }}>
                                            <SlipPage
                                                slip={slip}
                                                pageNum={idx + 1}
                                                totalPages={printingSlips.length}
                                                forceDisplayPrice={forceDisplayPrice}
                                                settings={settings}
                                                onUpdateSlip={(updates) => {
                                                    setPrintingSlips(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
                                                    const baseId = slip.id ? slip.id.replace(/-pg\d+$/, '') : null;
                                                    if (baseId && !baseId.startsWith('cover-') && baseId.length > 10) {
                                                        storage.updateSlip(baseId, updates).catch(console.error);
                                                    }
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Print-only version - rendered directly to body via Portal */}
                    {typeof document !== 'undefined' && ReactDOM.createPortal(
                        <div id="slip-print-portal">
                            {printingSlips.map((s, i) => (
                                <div key={`print-${s.id || i}`} className="slip-print-page">
                                    <SlipPage slip={s} pageNum={i + 1} totalPages={printingSlips.length} forceDisplayPrice={forceDisplayPrice} settings={settings} />
                                </div>
                            ))}
                        </div>,
                        document.body
                    )}
                </>
            )}
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${initialTab === 'history' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} rounded-2xl flex items-center justify-center shadow-sm`}>
                            {initialTab === 'history' ? <History size={24} /> : <FileOutput size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {initialTab === 'history' ? '伝票・請求履歴管理' : (editingSlipId ? (activeMode === 'return' ? '返品伝票の修正中' : '出庫伝票の修正中') : '現場出庫・返品処理')}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {initialTab === 'history' ? 'Invoice & Records Management' : (editingSlipId ? 'Modifying Existing Slip' : 'Active Shipping Operations')}
                            </p>
                        </div>
                    </div>
                    {initialTab === 'create' && !editingSlipId && (
                        <div className="flex bg-slate-100 p-1 rounded-xl mr-4 shrink-0">
                            <button onClick={() => setActiveMode('sales')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeMode === 'sales' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>通常出庫</button>
                            <button onClick={() => setActiveMode('return')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeMode === 'return' ? 'bg-white shadow text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>返品処理</button>
                        </div>
                    )}
                    <button onClick={handleClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
                </div>
                {!editingSlipId && (
                    <div className="flex border-b bg-white overflow-hidden">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => handleTabChange(tab.id as any)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-black border-b-4 transition-all ${activeTab === tab.id ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-400 hover:bg-slate-50/50'}`}>
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex-grow overflow-hidden flex flex-col bg-slate-100 p-8 overflow-y-auto">
                    {activeTab === 'create' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">顧客名 <span className="text-rose-500">*</span></label><input value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }} className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500" placeholder="顧客を検索" />{showSuggestions && filteredSuggestions.length > 0 && (<div className="absolute z-10 w-full bg-white border shadow-lg rounded-2xl mt-1 overflow-hidden">{filteredSuggestions.map(c => <div key={c.id} onClick={() => { setCustomerName(c.name); setShowSuggestions(false); }} className="p-4 hover:bg-blue-50 cursor-pointer text-sm font-bold border-b last:border-0">{c.name}</div>)}</div>)}</div>
                                        <div className="relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">現場名</label>
                                            <input 
                                                value={siteName} 
                                                onChange={e => { setSiteName(e.target.value); setShowSiteSuggestions(true); }} 
                                                onFocus={() => setShowSiteSuggestions(true)}
                                                className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500" 
                                                placeholder="一般・共通" 
                                            />
                                            {showSiteSuggestions && filteredSiteSuggestions.length > 0 && (
                                                <div className="absolute z-10 w-full bg-white border shadow-lg rounded-2xl mt-1 overflow-hidden">
                                                    {filteredSiteSuggestions.map(s => (
                                                        <div 
                                                            key={s} 
                                                            onClick={() => { setSiteName(s); setShowSiteSuggestions(false); }} 
                                                            className="p-4 hover:bg-blue-50 cursor-pointer text-sm font-bold border-b last:border-0"
                                                        >
                                                            {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">発注者</label><input value={orderingPerson} onChange={e => setOrderingPerson(e.target.value)} placeholder="発注者名" className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold" /></div>
                                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">注文番号</label><input value={customerOrderNumber} onChange={e => setCustomerOrderNumber(e.target.value)} placeholder="注文番号" className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">受付担当 <span className="text-rose-500">*</span></label><input value={receivingPerson} onChange={e => setReceivingPerson(e.target.value)} placeholder="担当者名" className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold" /></div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">備考</label>
                                            <input value={note} onChange={e => setNote(e.target.value)} placeholder="指示事項・備考などの入力..." className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">配送先指定</label><select value={dest} onChange={e => setDest(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500">{Object.entries(DestLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">希望配送時間</label><select value={time} onChange={e => setTime(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500">{Object.entries(DeliveryTimeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">受注日</label><input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">出庫日</label><input type="date" value={slipDate} onChange={e => setSlipDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    </div>
                                    <div className="border-t pt-6">
                                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 grow flex flex-col min-h-0">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-sm font-black flex items-center gap-2"><ShoppingCart size={18} className="text-blue-600" /> 出庫資材リスト ({cart.length})</h3>
                                                <div className="flex gap-2">
                                                    <button onClick={handleManualAdd} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-md active:scale-95">
                                                        <Plus size={14} /> 自由入力行を追加
                                                    </button>
                                                    <button onClick={() => onClearCart()} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors">
                                                        <Trash2 size={14} /> 全て削除
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 mb-6 no-print">
                                                <div className="relative flex-grow">
                                                    <Search className={`absolute left-4 top-4 ${activeMode === 'return' ? 'text-rose-400' : 'text-slate-400'}`} size={18} />
                                                    <input 
                                                        value={itemSearchQuery} 
                                                        onChange={e => { setItemSearchQuery(e.target.value); setShowItemSuggestions(true); }} 
                                                        placeholder={activeMode === 'return' ? "現場の納品履歴から資材をピックアップ..." : "複数キーワードで資材を検索（例: VP 50 エルボ）"} 
                                                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 ${activeMode === 'return' ? 'border-rose-100 focus:border-rose-500' : 'border-slate-100 focus:border-blue-500'} rounded-2xl font-bold transition-all outline-none shadow-inner text-sm`} 
                                                    />
                                                    {showItemSuggestions && itemSuggestions.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100] rounded-[1.5rem] mt-2 flex flex-col overflow-hidden max-h-[440px]">
                                                            <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b flex justify-between items-center">
                                                                <span>検索結果 ({itemSuggestions.length}件)</span>
                                                                {selectedSuggestions.size > 0 && <span className="text-blue-600">{selectedSuggestions.size}件 選択中</span>}
                                                            </div>
                                                            <div className="flex-grow overflow-y-auto divide-y divide-slate-100">
                                                                {itemSuggestions.map((i: any) => {
                                                                    const key = i.id + (i.historyMonth || '');
                                                                    const isSelected = selectedSuggestions.has(key);
                                                                    return (
                                                                        <div 
                                                                            key={key} 
                                                                            className={`group p-4 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                                                        >
                                                                            <div 
                                                                                onClick={(e) => { e.stopPropagation(); handleToggleSuggestion(i); }} 
                                                                                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 group-hover:border-blue-400 bg-white'}`}
                                                                            >
                                                                                {isSelected ? <Check size={16} strokeWidth={4} /> : <div className="w-1.5 h-1.5 bg-slate-200 rounded-full group-hover:bg-blue-300"></div>}
                                                                            </div>
                                                                            <div 
                                                                                onClick={() => handleAddFromMaster(i)} 
                                                                                className="flex-grow min-w-0"
                                                                            >
                                                                                <div className="flex justify-between items-center mb-0.5">
                                                                                    <span className="font-extrabold text-sm truncate group-hover:text-blue-700 transition-colors">{i.name}</span>
                                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                                        {i.historyMonth && <span className="text-[9px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-black">{i.historyMonth} 納品</span>}
                                                                                        <div className="flex flex-col items-end">
                                                                                            <span className="text-sm font-black text-blue-700">¥{(i.appliedPrice || 0).toLocaleString()}</span>
                                                                                            <span className="text-[9px] font-bold text-slate-400">標準: ¥{(i.sellingPrice || 0).toLocaleString()}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-xs text-slate-700 font-mono font-bold truncate tracking-tight">
                                                                                        {i.manufacturer && <span className="mr-2 text-slate-500 bg-slate-100 px-1.5 py-0.5 text-[10px] font-black rounded">{i.manufacturer}</span>}
                                                                                        {i.model} {i.dimensions}
                                                                                    </span>
                                                                                    <span className="text-[9px] font-bold text-slate-300 group-hover:text-blue-400 transition-colors">クリックで即時追加</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="p-4 bg-slate-50 border-t flex gap-3">
                                                                <button 
                                                                    onClick={() => { setItemSearchQuery(''); setShowItemSuggestions(false); setSelectedSuggestions(new Map()); }} 
                                                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
                                                                >
                                                                    キャンセル
                                                                </button>
                                                                <div className="flex-grow"></div>
                                                                {selectedSuggestions.size > 0 ? (
                                                                    <button 
                                                                        onClick={handleBulkAdd} 
                                                                        className="flex-grow py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <PlusCircle size={14} />
                                                                        選択した {selectedSuggestions.size} 件をカートに追加
                                                                    </button>
                                                                ) : (
                                                                    <p className="text-[10px] text-slate-400 font-bold self-center italic">アイテムをクリックして選択</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {activeMode === 'return' && (
                                                    <label className={`flex items-center gap-3 px-6 py-4 ${isAnalyzingReturn ? 'bg-slate-400' : 'bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700'} text-white rounded-2xl font-black text-xs cursor-pointer shadow-xl transition-all active:scale-95 shrink-0`}>
                                                        {isAnalyzingReturn ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                                        <span>{isAnalyzingReturn ? 'AI解析中...' : '手書きメモを解析'}</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleReturnAIAnalysis(file);
                                                        }} disabled={isAnalyzingReturn} />
                                                    </label>
                                                )}
                                            </div>
                                            <table className="w-full text-sm">
                                                <thead><tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b pb-2"><th className="w-8"></th><th className="pb-2 text-left">品名 / 明細</th><th className="w-24 text-center pb-2">数量</th><th className="w-32 text-center pb-2">適用単価 / 標準価格</th><th className="w-12"></th></tr></thead>
                                                <DragDropContext onDragEnd={handleDragEnd}>
                                                    <Droppable droppableId="cart-items">
                                                        {(provided) => (
                                                            <tbody
                                                                {...provided.droppableProps}
                                                                ref={provided.innerRef}
                                                                className="divide-y"
                                                            >
                                                                {cart.map((item, idx) => (
                                                                    <CartItemRow
                                                                        key={item.id}
                                                                        item={item}
                                                                        index={idx}
                                                                        activeMode={activeMode}
                                                                        onUpdateCart={onUpdateCart}
                                                                        handleRegisterToMaster={handleRegisterToMaster}
                                                                        onDelete={handleDeleteFromCart}
                                                                    />
                                                                ))}
                                                                {provided.placeholder}
                                                            </tbody>
                                                        )}
                                                    </Droppable>
                                                </DragDropContext>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border flex flex-col gap-6 shadow-xl sticky top-0 h-fit">
                                <h3 className="font-black border-b pb-4 text-slate-700 uppercase tracking-widest text-xs">出庫アクション</h3>
                                <button onClick={handleSave} disabled={isSaving || cart.length === 0} className={`w-full py-5 ${activeMode === 'return' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white font-black rounded-2xl shadow-2xl transition-all active:scale-95 disabled:bg-slate-300 uppercase tracking-widest text-sm`}>
                                    {isSaving ? <Loader2 className="animate-spin mx-auto" /> : (editingSlipId ? '修正内容で確定' : (activeMode === 'return' ? '返品伝票を保存' : '出庫伝票を保存'))}
                                </button>
                                {editingSlipId ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                                        <p className="text-[10px] text-amber-600 leading-relaxed font-bold">【修正モード】金額や数量を調整し、「修正内容で確定」を押すと履歴が更新されます。</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 border rounded-2xl text-center">
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-bold">保存後、伝票は「出庫待ち」に移動します。作業用伝票を印刷してピッキングを開始してください。</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'history' ? (
                        <div className="flex flex-col h-full overflow-hidden animate-fade-in">
                            <div className="bg-white rounded-[2rem] border-b p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm mb-6">
                                <div className="flex items-center gap-3 shrink-0"><span className="text-xs font-black text-slate-400 uppercase tracking-widest">対象月:</span><input type="month" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} className="px-4 py-2.5 border rounded-2xl font-black bg-slate-50 outline-none" /></div>
                                <div className="flex-grow relative w-full"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={historySearchQuery} onChange={e => setHistorySearchQuery(e.target.value)} placeholder="顧客名、現場名、または商品名・型式で検索して履歴を呼び出し..." className="w-full pl-14 pr-6 py-3.5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" /></div>
                                <button
                                    onClick={() => {
                                        if (isAdminUnlocked) {
                                            setIsAdminUnlocked(false);
                                            return;
                                        }
                                        const pw = prompt('管理者パスワードを入力してください');
                                        if (pw === (settings?.adminPassword || '0000')) {
                                            setIsAdminUnlocked(true);
                                        } else if (pw !== null) {
                                            alert('パスワードが違います');
                                        }
                                    }}
                                    className={`p-3 rounded-2xl flex items-center gap-2 transition-all ${isAdminUnlocked ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                    title={isAdminUnlocked ? "金額を非表示" : "金額を表示 (管理者専用)"}
                                >
                                    {isAdminUnlocked ? <EyeOff size={20} /> : <Eye size={20} />}
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">{isAdminUnlocked ? 'HIDE TOTAL' : 'SHOW TOTAL'}</span>
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto space-y-6">
                                {customerHierarchy.map(([c, sMap]) => (
                                    <div key={c} className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                                        <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer" onClick={() => setExpandedCustomers(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; })}>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <Building2 size={24} className="text-emerald-400" />
                                                <h3 className="text-lg md:text-xl font-black truncate">{c}</h3>
                                                {isAdminUnlocked && (
                                                    <div className="ml-4 px-3 py-1 bg-emerald-400/10 border border-emerald-400/20 rounded-full flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                                                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-tighter">TOTAL:</span>
                                                        <span className="text-base md:text-lg font-mono font-black text-emerald-400">
                                                            ¥{Math.round((Array.from(sMap.values()).flat() as Slip[]).reduce((acc, s) => acc + (s.grandTotal ?? ((s.totalAmount || 0) * 1.1)), 0)).toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] font-black text-emerald-400 opacity-60">(税込)</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                                <button onClick={(e) => { e.stopPropagation(); handleInvoiceIssuance(c, null, Array.from(sMap.values()).flat() as Slip[]); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 px-4 md:px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all">一括請求書を発行</button>
                                                {expandedCustomers.has(c) ? <ChevronDown size={24} className="shrink-0" /> : <ChevronRight size={24} className="shrink-0" />}
                                            </div>
                                        </div>
                                        {expandedCustomers.has(c) && (
                                            <div className="p-6 space-y-6 bg-slate-50/30">
                                                {Array.from(sMap.entries()).map(([sNameVal, slipList]) => (
                                                    <div key={sNameVal} className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
                                                        <div className="p-4 bg-slate-100/50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                            <span className="font-black text-sm px-2 truncate block w-full sm:w-auto">{formatSiteName(sNameVal)}</span>
                                                            <button onClick={() => handleInvoiceIssuance(c, sNameVal, slipList)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md transition-all active:scale-95">現場別明細発行</button>
                                                        </div>
                                                        <div className="divide-y">
                                                            {slipList.map(sl => (
                                                                <div key={sl.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 flex-grow">
                                                                        <div className="font-mono text-slate-400 text-xs sm:w-28 shrink-0">{sl.date}</div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-sm whitespace-nowrap">{getSlipLabel(sl.type)}</span>
                                                                            <span className="text-[9px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded shrink-0">No.{sl.slipNumber || 'UNK'}</span>
                                                                        </div>
                                                                        <div className="sm:hidden border-t border-slate-100 my-1"></div>
                                                                        <div className="font-mono font-black text-slate-900 sm:w-32 sm:text-right">
                                                                            ¥{(sl.totalAmount || 0).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-end gap-3 shrink-0">
                                                                        <button 
                                                                            onClick={() => sl.id && storage.updateSlip(sl.id, { isReviewed: !sl.isReviewed })} 
                                                                            className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${sl.isReviewed ? 'text-emerald-500 bg-emerald-50/50 hover:bg-emerald-100' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                                                            title={sl.isReviewed ? "確認済み (クリックで解除)" : "未確認 (クリックで確認完了)"}
                                                                        >
                                                                            {sl.isReviewed ? <CheckSquare size={18} /> : <Square size={18} />}
                                                                        </button>
                                                                        <button onClick={() => { setPrintingSlips([sl]); }} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="再印刷">
                                                                            <Printer size={18} />
                                                                        </button>
                                                                        {(sl.type === 'provisional' || sl.type === 'return') && (
                                                                            <button onClick={() => handleEditSlip(sl)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="修正">
                                                                                <Edit3 size={18} />
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => sl.id && setDeletingSlipId(sl.id)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="削除">
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            {(activeTab === 'pending' ? pendingOutbounds : reslips).map(s => (
                                <div key={s.id} className="bg-white p-4 md:p-6 rounded-[2rem] border flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm hover:shadow-xl transition-all border-l-8 border-l-blue-600 gap-4">
                                    <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
                                        <div className={`w-12 h-12 md:w-16 md:h-16 shrink-0 ${activeTab === 'reslip' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'} rounded-[1.5rem] flex items-center justify-center shadow-inner`}><FileText size={24} className="md:w-8 md:h-8" /></div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-black text-base md:text-lg text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
                                                {s.customerName} <span className="text-xs text-slate-400 font-bold tracking-tight inline-block">({formatSiteName(s.constructionName)})</span>
                                                {s.source === 'link' && <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm">LINK注文</span>}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-1 font-bold uppercase tracking-widest flex items-center gap-2">
                                                <span>{new Date(s.createdAt).toLocaleString()}</span>
                                                <span className="hidden md:inline text-slate-300 mx-2">|</span>
                                                <span className="hidden md:inline">SlipNo: {s.slipNumber || 'UNK'}</span>
                                                <span className="hidden md:inline text-slate-300 mx-2">|</span>
                                                <span>{s.items.length} Items</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        {activeTab === 'pending' ? (
                                            <>
                                                <button onClick={() => { setConfirmingOutbound(s); setActualQuantities(s.items.reduce((a, v, idx) => ({ ...a, [`${v.id}-${idx}`]: v.quantity }), {} as Record<string, number>)); }} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black shadow-xl shadow-blue-100 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap">
                                                    <span className="md:hidden">実数入力</span><span className="hidden md:inline">実数確定して仮納品書発行</span>
                                                </button>
                                                <button onClick={() => { setPrintingSlips([s]); }} className="flex-1 md:flex-none bg-white border border-slate-200 px-4 md:px-6 py-3 rounded-2xl text-[10px] md:text-[11px] font-black hover:bg-slate-50 transition-all uppercase tracking-widest whitespace-nowrap">
                                                    <span className="md:hidden">プレビュー</span><span className="hidden md:inline">出庫用伝票を印刷</span>
                                                </button>
                                                <button onClick={() => handleEditSlip(s)} className="p-3 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-2xl transition-all" title="内容を修正">
                                                    <Edit3 size={20} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={async () => { onUpdateCart(s.items.map(i => ({ ...i, quantity: i.quantity }))); setCustomerName(s.customerName); setSiteName(s.constructionName || ''); handleTabChange('create'); if (s.id) await storage.deleteSlip(s.id); }} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black shadow-xl shadow-emerald-100 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap">
                                                <span className="md:hidden">再作成</span><span className="hidden md:inline">欠品分を再作成</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                const info = settings || DEFAULT_COMPANY_INFO;
                                                const customer = customers.find(c => c.name === s.customerName);
                                                const email = customer?.email || "";
                                                const subject = `【${info.companyName}】${getSlipLabel(s.type, s.constructionName)}のご案内 (#${s.slipNumber})`;
                                                const body = `${s.customerName} 様\n\n平素より大変お世話になっております。${info.companyName}でございます。\n${s.constructionName || "一般"} 現場の${getSlipLabel(s.type, s.constructionName)}をお送りいたします。\n\n詳細につきましては、本メールまたはシステム画面よりご確認ください。\n\n--------------------------------------------------\n発行番号: ${s.slipNumber}\n発行日: ${s.date}\n計金額 (税抜): ¥${(s.totalAmount || 0).toLocaleString()}\n--------------------------------------------------\n\nご確認のほど何卒よろしくお願い申し上げます。\n\n${info.companyName}\n${info.address}\nTEL: ${info.phone}\n${info.email}`;
                                                window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                            }}
                                            className="p-3 text-slate-500 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
                                            title="メールで送信"
                                        >
                                            <Mail size={20} />
                                        </button>
                                        <button onClick={() => s.id && setDeletingSlipId(s.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="削除"><Trash2 size={20} /></button>
                                    </div>
                                </div>
                            ))}
                            {(activeTab === 'pending' ? pendingOutbounds : reslips).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                                    <History size={64} className="opacity-10 mb-6" />
                                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-30">現在、対象の伝票はありません</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {showReturnResolutionModal && (
                <ReturnResolutionModal
                    results={returnAmbiguityResults}
                    onApply={handleApplyAIResults}
                    onClose={() => setShowReturnResolutionModal(false)}
                />
            )}
            <style>{`
                .no-spin-buttons::-webkit-outer-spin-button,
                .no-spin-buttons::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .no-spin-buttons {
                    -moz-appearance: textfield;
                }
                         @media print {
                            @page { size: A4; margin: 0; }
                            body { -webkit-print-color-adjust: exact; }
                            .print-hidden, .print\\:hidden { display: none !important; }
                            #print-target {
                                transform: none !important;
                                width: 100% !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                        }
                    `}</style>
        </div >
    );
};
