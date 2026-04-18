
import { MaterialItem } from '../types';

/**
 * Normalizes text for search by:
 * 1. Converting Hiragana to Katakana
 * 2. Converting Full-width alphanumeric characters to Half-width
 * 3. Converting Half-width Katakana to Full-width Katakana
 * 4. Converting to lowercase
 * 5. Trimming whitespace
 */
export const normalizeForSearch = (text: string): string => {
    if (!text) return '';
    
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
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー', ' ': '　'
    };
    normalized = normalized.split('').map(char => kanaMap[char] || char).join('');

    // Handle voiced/semi-voiced sounds in half-width (simplified approach)
    normalized = normalized.replace(/カ゛/g, 'ガ').replace(/キ゛/g, 'ギ').replace(/ク゛/g, 'グ').replace(/ケ゛/g, 'ゲ').replace(/コ゛/g, 'ゴ')
        .replace(/サ゛/g, 'ザ').replace(/シ゛/g, 'ジ').replace(/ス゛/g, 'ズ').replace(/セ゛/g, 'ゼ').replace(/ソ゛/g, 'ゾ')
        .replace(/タ゛/g, 'ダ').replace(/チ゛/g, 'ヂ').replace(/ツ゛/g, 'ヅ').replace(/テ゛/g, 'デ').replace(/ト゛/g, 'ド')
        .replace(/ハ゛/g, 'バ').replace(/ヒ゛/g, 'ビ').replace(/フ゛/g, 'ブ').replace(/ヘ゛/g, 'ベ').replace(/ホ゛/g, 'ボ')
        .replace(/ハ゜/g, 'パ').replace(/ヒ゜/g, 'ピ').replace(/フ゜/g, 'プ').replace(/ヘ゜/g, 'ペ').replace(/ホ゜/g, 'ポ');

    // 4. Lowercase
    normalized = normalized.toLowerCase();

    // 5. Replace full-width space with half-width and collapse multiple spaces for consistency
    normalized = normalized.replace(/　/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ');

    return normalized.trim();
};

export const calculateRelevanceScore = (item: MaterialItem, keywords: string[]): number => {
    if (keywords.length === 0) return 0;

    let totalScore = 0;

    const fields = {
        name: normalizeForSearch(item.name || ''),
        model: normalizeForSearch(item.model || ''),
        dimensions: normalizeForSearch(item.dimensions || ''),
        manufacturer: normalizeForSearch(item.manufacturer || ''),
        category: normalizeForSearch(item.category || ''),
        location: normalizeForSearch(item.location || '')
    };

    // 1. AND filter logic (MUST match all keywords somewhere)
    const matchesAll = keywords.every(k => 
        fields.name.includes(k) || 
        fields.model.includes(k) || 
        fields.dimensions.includes(k) || 
        fields.manufacturer.includes(k) || 
        fields.category.includes(k) ||
        fields.location.includes(k)
    );

    if (!matchesAll) return -1;

    // 2. Full query match boost (across name, model, dimensions)
    const combinedKeyFields = `${fields.name} ${fields.model} ${fields.dimensions}`.trim();
    const fullQuery = keywords.join(' ');
    if (combinedKeyFields === fullQuery) totalScore += 10000;
    else if (combinedKeyFields.startsWith(fullQuery)) totalScore += 5000;

    keywords.forEach((k, idx) => {
        // Higher weight for the first keyword
        const multiplier = idx === 0 ? 2 : 1;

        // 3. Exact matches (Absolute priority)
        if (fields.model === k) totalScore += 5000 * multiplier;
        if (fields.dimensions === k) totalScore += 4000 * multiplier;
        if (fields.name === k) totalScore += 3000 * multiplier;

        // 4. Boundary matches (e.g., "S" matches "モルコ S" as a word)
        const boundaryRegex = new RegExp(`(^|\\s|[-/])${k}($|\\s|[-/])`, 'i');
        if (boundaryRegex.test(fields.model)) totalScore += 1000 * multiplier;
        if (boundaryRegex.test(fields.dimensions)) totalScore += 800 * multiplier;
        if (boundaryRegex.test(fields.name)) totalScore += 600 * multiplier;

        // 5. Starts-with matches
        if (fields.model.startsWith(k)) totalScore += 500 * multiplier;
        if (fields.dimensions.startsWith(k)) totalScore += 400 * multiplier;
        if (fields.name.startsWith(k)) totalScore += 300 * multiplier;
        if (fields.manufacturer.startsWith(k)) totalScore += 100 * multiplier;

        // 6. Basic presence
        if (fields.name.includes(k)) totalScore += 50;
        if (fields.model.includes(k)) totalScore += 40;
        if (fields.dimensions.includes(k)) totalScore += 30;
        if (fields.manufacturer.includes(k)) totalScore += 20;
        if (fields.category.includes(k)) totalScore += 10;
        if (fields.location.includes(k)) totalScore += 5;
    });

    return totalScore;
};

const naturalCompare = (a: string, b: string): number => {
    // 設備業界の寸法記号（A, W, インチ分数など）を考慮した自然順序ソート
    const ax: any[] = [];
    const bx: any[] = [];

    // 数値と非数値の境界で分割して配列化
    a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || Infinity, $2 || ""]); return ""; });
    b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || Infinity, $2 || ""]); return ""; });

    while (ax.length && bx.length) {
        const an = ax.shift();
        const bn = bx.shift();
        const nn = an[0] - bn[0] || an[1].localeCompare(bn[1]);
        if (nn) return nn;
    }

    return ax.length - bx.length;
};

export const filterAndSortItems = (items: MaterialItem[], query: string): MaterialItem[] => {
    const normalizedQuery = normalizeForSearch(query);
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 0);
    if (keywords.length === 0) return items;

    return items
        .map(item => ({ item, score: calculateRelevanceScore(item, keywords) }))
        .filter(result => result.score >= 0)
        .sort((a, b) => {
            // 1. スコア順（検索クエリとの関連性）
            if (b.score !== a.score) return b.score - a.score;
            
            // 2. スコアが同じなら「寸法(dimensions)」フィールドで自然順序ソート
            return naturalCompare(a.item.dimensions || "", b.item.dimensions || "");
        })
        .map(result => result.item);
};

/**
 * 顧客・現場別の単価ルールを適用した価格を算出します
 */
export const getAppliedPrice = (item: MaterialItem, activeCustomer: string | null, activeSite: string | null, pricingRules: any[]): number => {
    const basePrice = item.sellingPrice || 0;
    if (!activeCustomer) return basePrice;

    const normCust = normalizeForSearch(activeCustomer);
    const customerRules = pricingRules.filter(r => normalizeForSearch(r.customerName) === normCust);
    if (customerRules.length === 0) return basePrice;

    const findBestRule = (scopeRules: any[]) => {
        // 1. 資材IDでの完全一致 (最優先)
        let r = scopeRules.find(r => r.materialId === item.id);
        if (r) return r;

        // 2. カテゴリー + 型式での一致
        if (item.model) {
            r = scopeRules.find(r => r.category === item.category && r.model === item.model && !r.materialId);
            if (r) return r;
        }

        // 3. カテゴリー全体での一致 (model: 'All')
        r = scopeRules.find(r => r.category === item.category && r.model === 'All' && !r.materialId);
        return r;
    };

    // 優先順位: 1. 現場別ルール 2. 顧客共通ルール
    let rule: any;
    if (activeSite && activeSite !== '') {
        const normSite = normalizeForSearch(activeSite);
        const siteRules = customerRules.filter(r => normalizeForSearch(r.siteName || '') === normSite);
        rule = findBestRule(siteRules);
    }

    if (!rule) {
        const commonRules = customerRules.filter(r => !r.siteName || r.siteName === '');
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
