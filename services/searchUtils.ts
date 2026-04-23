
import { MaterialItem, PricingRule } from '../types';

// 高速化のためのキャッシュ
const normalizationCache = new Map<string, string>();
const strictNormalizationCache = new Map<string, string>();

/**
 * Normalizes text for search by:
 * 1. Converting Hiragana to Katakana
 * 2. Converting Full-width alphanumeric characters to Half-width
 * 3. Converting Half-width Katakana to Full-width Katakana
 * 4. Converting to lowercase
 * 5. Normalizing dashes and hyphens
 * 6. Trimming whitespace
 */
export const normalizeForSearch = (text: string): string => {
    if (!text) return '';
    if (normalizationCache.has(text)) return normalizationCache.get(text)!;
    
    let normalized = text.trim();

    // 1. Hiragana to Katakana
    normalized = normalized.replace(/[\u3041-\u3096]/g, (match) => {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });

    // 2. Full-width alphanumeric/symbols to Half-width
    normalized = normalized.replace(/[！-～]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
    });

    // 3. Half-width Katakana to Full-width Katakana
    const kanaMap: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー'
    };
    normalized = normalized.replace(/[ｦ-ﾟ]/g, (match) => kanaMap[match] || match);

    // 4. Combining Dakuten/Handakuten
    normalized = normalized.replace(/カ゛/g, 'ガ').replace(/キ゛/g, 'ギ').replace(/ク゛/g, 'グ').replace(/ケ゛/g, 'ゲ').replace(/コ゛/g, 'ゴ')
                           .replace(/サ゛/g, 'ザ').replace(/シ゛/g, 'ジ').replace(/ス゛/g, 'ズ').replace(/セ゛/g, 'ゼ').replace(/ソ゛/g, 'ゾ')
                           .replace(/タ゛/g, 'ダ').replace(/チ゛/g, 'ヂ').replace(/ツ゛/g, 'ヅ').replace(/テ゛/g, 'デ').replace(/ト゛/g, 'ド')
                           .replace(/ハ゛/g, 'バ').replace(/ヒ゛/g, 'ビ').replace(/フ゛/g, 'ブ').replace(/ヘ゛/g, 'ベ').replace(/ホ゛/g, 'ボ')
                           .replace(/ハ゜/g, 'パ').replace(/ヒ゜/g, 'ピ').replace(/フ゜/g, 'プ').replace(/ヘ゜/g, 'ペ').replace(/ホ゜/g, 'ポ')
                           .replace(/ウ゛/g, 'ヴ');

    // 5. Lowercase
    normalized = normalized.toLowerCase();

    // 6. Unify hyphens/dashes to "-"
    normalized = normalized.replace(/[ーｰ－‐‑‒–—―⁃－-]/g, '-');

    // 7. Space normalization
    normalized = normalized.replace(/　/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ');

    const result = normalized.trim();
    normalizationCache.set(text, result);
    return result;
};

const strictNorm = (s: string): string => {
    if (!s) return '';
    if (strictNormalizationCache.has(s)) return strictNormalizationCache.get(s)!;

    let n = normalizeForSearch(s);
    // Remove corporate suffixes
    n = n.replace(/株式会社|有限会社|合同会社|合資会社|合名会社|（株）|\(株\)|㈱|（有）|\(有\)|㈲|（合）|（名）/g, '');
    // Remove all non-alphanumeric/Japanese characters
    const result = n.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '');
    strictNormalizationCache.set(s, result);
    return result;
};

// Cache for customer-specific rules to avoid repeated filtering
let lastPricingRules: PricingRule[] | null = null;
let customerRulesCache = new Map<string, PricingRule[]>();

/**
 * Calculates applied price based on customer and site rules.
 * Optimized for high performance with caching.
 */
export const getAppliedPrice = (item: MaterialItem, activeCustomer: string | null, activeSite: string | null, pricingRules: PricingRule[]): number => {
    const basePrice = item.sellingPrice || 0;
    if (!activeCustomer || !pricingRules || pricingRules.length === 0) return basePrice;

    // Clear cache if the source rules array has changed
    if (pricingRules !== lastPricingRules) {
        customerRulesCache.clear();
        normalizationCache.clear();
        strictNormalizationCache.clear();
        lastPricingRules = pricingRules;
    }

    // Pre-filter rules for the current customer (cached)
    let customerRules = customerRulesCache.get(activeCustomer);
    if (!customerRules) {
        const normCust = normalizeForSearch(activeCustomer);
        customerRules = pricingRules.filter(r => normalizeForSearch(r.customerName) === normCust);

        if (customerRules.length === 0) {
            const sc = strictNorm(activeCustomer);
            customerRules = pricingRules.filter(r => strictNorm(r.customerName) === sc);
        }
        customerRulesCache.set(activeCustomer, customerRules);
    }

    if (customerRules.length === 0) return basePrice;

    const findBestRule = (scopeRules: PricingRule[]) => {
        // 1. Exact Material ID Match
        let r = scopeRules.find(r => r.materialId === item.id);
        if (r) return r;

        // 2. Name + Category + Model Match (for duplicate items)
        const normName = normalizeForSearch(item.name);
        const normCat = normalizeForSearch(item.category);
        const normModel = normalizeForSearch(item.model || '');
        r = scopeRules.find(r => 
            normalizeForSearch(r.materialName || '') === normName &&
            normalizeForSearch(r.category) === normCat &&
            normalizeForSearch(r.model || '') === normModel
        );
        if (r) return r;

        // 3. Category + Model Match
        if (item.model) {
            r = scopeRules.find(r => 
                normalizeForSearch(r.category) === normCat && 
                normalizeForSearch(r.model || '') === normModel && 
                !r.materialId
            );
            if (r) return r;
        }

        // 4. Category Match (model: 'All')
        r = scopeRules.find(r => 
            normalizeForSearch(r.category) === normCat && 
            (!r.model || r.model === 'All' || r.model === '') && 
            !r.materialId
        );
        return r;
    };

    // Site common check
    const isCommonSite = (siteName: string | undefined | null) => {
        if (!siteName) return true;
        const norm = normalizeForSearch(siteName);
        return norm === '' || norm === 'キョウツウ' || norm === 'ゼンゲンジャウキョウツウ' || norm === 'イッパン';
    };

    // Priority: 1. Site-specific rule, 2. Customer-common rule
    let rule: PricingRule | undefined;
    if (activeSite && activeSite !== '' && !isCommonSite(activeSite)) {
        const normSite = normalizeForSearch(activeSite);
        const siteRules = customerRules.filter(r => !isCommonSite(r.siteName) && normalizeForSearch(r.siteName || '') === normSite);
        rule = findBestRule(siteRules);
    }

    if (!rule) {
        const commonRules = customerRules.filter(r => isCommonSite(r.siteName));
        rule = findBestRule(commonRules);
    }

    if (rule) {
        if (rule.method === 'fixed_price') {
            return rule.value;
        } else if (rule.method === 'percent_of_list' && item.listPrice > 0) {
            return Math.round(item.listPrice * (rule.value / 100));
        } else if (rule.method === 'markup_on_cost' && item.costPrice > 0) {
            return Math.round(item.costPrice * (1 + (rule.value / 100)));
        }
    }

    return basePrice;
};

/**
 * Filter and sort items based on multiple search terms.
 * Optimized with caching.
 */
export const filterAndSortItems = (items: MaterialItem[], searchTerms: string): MaterialItem[] => {
    if (!searchTerms.trim()) return items;

    const terms = searchTerms.split(/\s+/).map(t => normalizeForSearch(t)).filter(t => t.length > 0);
    
    return items
        .filter(item => {
            const name = normalizeForSearch(item.name);
            const category = normalizeForSearch(item.category);
            const model = normalizeForSearch(item.model || '');
            const maker = normalizeForSearch(item.maker || '');
            const number = normalizeForSearch(item.shelfNumber || '');
            
            return terms.every(term => 
                name.includes(term) || 
                category.includes(term) || 
                model.includes(term) || 
                maker.includes(term) || 
                number.includes(term)
            );
        })
        .sort((a, b) => {
            // Priority matches for first term
            const firstTerm = terms[0];
            const aName = normalizeForSearch(a.name);
            const bName = normalizeForSearch(b.name);
            
            const aStarts = aName.startsWith(firstTerm);
            const bStarts = bName.startsWith(firstTerm);
            
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            return aName.localeCompare(bName);
        });
};
