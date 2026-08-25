/**
 * 機能制限・準備中フラグ設定（No. 1 対応）
 * 開ける際は 1箇所の設定（true）で簡単に開放可能です。
 */
export const FEATURE_FLAGS = {
  // LINK（顧客スマホ連携機能）
  enableLINK: false,
  // 繰越・入金の画面処理
  enableCarryOverPayment: true,
  // AI高橋機能
  enableAITakahashi: false,
  // 未使用集計画面機能
  enableUnusedAnalytics: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const FEATURE_DISABLED_MESSAGES: Record<FeatureFlagKey, string> = {
  enableLINK: 'LINK機能（顧客スマホ連携）は現在準備中です',
  enableCarryOverPayment: '繰越・入金管理機能は現在準備中です',
  enableAITakahashi: 'AI高橋アシスタント機能は現在準備中です',
  enableUnusedAnalytics: '詳細分析集計機能は現在準備中です',
};
