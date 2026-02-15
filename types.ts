
export const MATERIAL_CATEGORIES = [
  "鋼管類", "銅管類", "ステンレス管類", "塩ビ管類", "CD・PF管類", "ダクト類", "ポリパイプ", "ボイド管", "ワンダーチューブ", "その他管",
  "鋼管継手", "銅管継手", "ステンレス継手", "排水継手", "樹脂管継手", "その他継手",
  "フランジ・パッキン", "バルブ", "支持金物", "アンカー・ボルト",
  "保温材", "シール材", "空調部材", "排気筒関連", "衛生器具", "計器類", "機器類", "工具", "建材", "消耗品・雑材"
] as const;

export type Category = typeof MATERIAL_CATEGORIES[number];

export interface Material {
  id: string;
  category: string;
  name: string;
  manufacturer?: string;
  model: string;
  dimensions: string;
  size?: string;
  quantity: number;
  unit: string;
  location: string;
  notes?: string;
  listPrice: number;
  sellingPrice: number;
  costPrice: number;
  sourceUrl?: string;
  updatedAt: number;
}

export type MaterialItem = Material;

export type SortField = keyof Omit<Material, 'id' | 'updatedAt' | 'sourceUrl' | 'category'> | 'profitMargin';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface Customer {
  id: string;
  name: string;
  closingDay?: number;
}

export interface PricingRule {
  id: string;
  customerName: string;
  siteName?: string;
  category: string;
  model: string;
  method: 'percent_of_list' | 'markup_on_cost';
  value: number;
}

export type SlipType = 'outbound' | 'provisional' | 'delivery' | 'invoice' | 'return' | 'reslip' | 'cover';

export interface SlipItem extends Material {
  quantity: number;
  deliveredQuantity?: number;
  appliedPrice: number;
  date?: string;
  sourceSlipNo?: string;
}

export type DeliveryTime = 'morning_first' | 'am' | 'afternoon_first' | 'pm' | 'none';
export type DeliveryDestination = 'site' | 'factory' | 'office' | 'home' | 'bring' | 'carrier' | 'none';

export interface Slip {
  id: string;
  groupId?: string;
  slipNumber?: string;
  createdAt: number;
  date: string;
  customerName: string;
  constructionName?: string;
  type: SlipType;
  items: SlipItem[];
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  note?: string;
  deliveryTime: DeliveryTime;
  deliveryDestination: DeliveryDestination;
  isClosed?: boolean;
  siteSummaries?: { name: string; total: number }[];
  orderingPerson?: string;
  receivingPerson?: string;
  issuerPerson?: string;
}

export type EstimateStatus = 'pending' | 'accepted' | 'rejected' | 'converted';

export interface Estimate extends Omit<Slip, 'type' | 'isClosed'> {
  status: EstimateStatus;
  validUntil: string;
}
