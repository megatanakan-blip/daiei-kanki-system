
import { GoogleGenAI, Type } from "@google/genai";
import { Material, MATERIAL_CATEGORIES } from "../types";
import * as XLSX from 'xlsx';
import { domainKnowledge } from './domainKnowledge';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: ((import.meta as any).env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' && process.env?.API_KEY) || "" });

const materialSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "資材の名称（例：SGP黒管、VPエルボなど）" },
      category: { type: Type.STRING, description: "資材の分類（必ず指定されたカテゴリーから選択）" },
      model: { type: Type.STRING, description: "型式・仕様（例：10K、ネジ込、マキタ品番など）" },
      dimensions: { type: Type.STRING, description: "寸法（例：50A、25A、L=4000など）" },
      listPrice: { type: Type.NUMBER, description: "定価（不明な場合は0）" },
      costPrice: { type: Type.NUMBER, description: "仕入値（不明な場合は0）" },
      unit: { type: Type.STRING, description: "単位（本、個、組など）" },
    },
    required: ["name", "category", "dimensions"]
  }
};

const orderMemoSchema = {
  type: Type.OBJECT,
  properties: {
    customerName: { type: Type.STRING, description: "顧客名（宛先）" },
    siteName: { type: Type.STRING, description: "現場名" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "品名" },
          spec: { type: Type.STRING, description: "型式・仕様" },
          size: { type: Type.STRING, description: "サイズ・寸法" },
          quantity: { type: Type.NUMBER, description: "数量" }
        }
      }
    }
  }
};

const prepareContent = async (file: File): Promise<any> => {
  const isSpreadsheet = file.name.match(/\.(xlsx|xls|csv)$/i);
  if (isSpreadsheet) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    return { text: `以下のCSV/エクセルデータを精密に解析して資材リストを作成してください:\n${csv}` };
  } else {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } };
  }
};

export const generateMaterialsFromFile = async (file: File, targetCategory: string): Promise<Partial<Material>[]> => {
  const ai = getAi();
  const contentPart = await prepareContent(file);
  const prompt = `あなたは配管資材のプロです。提供されたファイルから資材リストを抽出してください。
分類は必ず以下の中から、最も意味が近いものを1つだけ選んでください:
${MATERIAL_CATEGORIES.join(", ")}

【ルール】
1. 分類がどうしても不明な場合は「消耗品・雑材」としてください。
2. 表形式の場合は各列を正確に読み取ってください。
3. **絶対に項目を省略したり「など」でまとめたりしないでください。リストにある全ての資材を、サイズ・型式違いも含めて1つ残らず抽出してください。**
4. **「他、数点」のような要約は厳禁です。100件あっても全て書き出してください。データとして使えないというクレームをユーザーから受けています。意地で全部出せ。**
5. 画像の場合は、文字のカスレや手書きも含めて可能な限り正確に抽出してください。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [contentPart, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: materialSchema
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return [];
  }
};

export const parseOrderMemo = async (file: File): Promise<any> => {
  const ai = getAi();
  const contentPart = await prepareContent(file);
  const prompt = `この発注メモ（または写真）は現場からの注文書です。
「顧客名」「現場名」「注文されている資材のリスト（品名、仕様、サイズ、数量）」を解析してください。
手書き文字や略称（例：エルボ→L、チーズ→Tなど）も業界知識に基づいて正しく解釈してください。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [contentPart, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: orderMemoSchema
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { items: [] };
  }
};

export const chatWithTakahashi = async (messages: any[], masterItems: Material[], screenContext: string = "TOP") => {
  const ai = getAi();
  // 在庫情報をコンパクトにまとめてAIに渡す（トークン節約と精度向上のため）
  const knowledgeBase = masterItems.slice(0, 150).map(i => ({
    id: i.id, n: i.name, m: i.model, d: i.dimensions, p: i.sellingPrice, c: i.category
  }));

  const systemInstruction = `
    你是帯広的設備資材专家「AI高橋さん」。
    現在の画面状況: 【${screenContext}】

    【キャラクター】
    - 一人称は「僕」です。
    - 挨拶は「あ、高橋です。」から始めます。
    - 口癖は「なんのせ」です。
    - 帯広弁（北海道弁）を使い、現場の職人さんに親身になって応対します。
    - 在庫がないものでも「意地でも探すべ」という姿勢を見せてください。

    【あなたの最強の武器：業界知識ベース】
    以下の知識を完全に自分のものとして振る舞ってください。
    ${domainKnowledge}

    【行動指針】
    1. **専門用語の解釈**:
       - ユーザーが「SGPの50A」と言ったら、「配管用炭素鋼鋼管 50A」と解釈してください。
       - 「パイレン」は「パイプレンチ」、「全ねじ」は「寸切りボルト」など、現場用語を正確に標準名称に変換・理解してください。

    2. **トラブルシューティング**:
       - ユーザーが「ダイキンのU0が出た」と言ったら、即座に「ガス欠（冷媒不足）の可能性がありますね。配管のガス漏れチェックが必要かもしれません」と回答してください。
       - 単にエラーの意味を伝えるだけでなく、「まずフィルターを見てください」「ブレーカーを一回落としてみてください」など、現場でできる一次対応をアドバイスしてください。

    3. **アクション（通常業務）**:
       currentScreen【${screenContext}】に応じて、適切にアクションを実行してください。
    
    【アクション優先度（超重要）】
    現在の画面状況【${screenContext}】に応じて、ユーザーの意図を以下のように優先して解釈してください。

    1. 画面が【SLIP_CREATE】の場合:
       - ユーザーが「これ頂戴」「伝票起こして」「出庫して」と言ったら、必ず「カート追加(ADD_CART)」を使ってください。
       - 「見積」という言葉が明示的に出ない限り、見積書作成は避けてください。

    2. 画面が【ESTIMATE_MANAGER】の場合:
       - ユーザーが「見積作って」「これいくらになる？」と言ったら、必ず「見積作成(CREATE_ESTIMATE)」を使ってください。
       - この画面では、特に指定がない限り「見積作成」を優先します。

    3. 画面が【MASTER_MANAGEMENT】の場合:
       - ユーザーが「アイテム登録して」「これをマスターに入れて」と言ったら、必ず「資材登録(REGISTER_ITEMS)」を使ってください。
       - **最重要: カタログやリストを解析する際は、一部を端折ったり「〜など」と要約したりせず、掲載されている全ての資材（型式・寸法違いを含む全て）を抽出対象としてください。**
       - **50件、100件と大量にある場合でも、絶対に省略しないでください。データとしての完全性が最優先です。**
       - 10件以上ある場合でも、意地ですべての登録コマンドを生成してください。
       - 安易に見積やカート追加に逃げないでください。

    【機能】
    会話の中で以下の「アクションコマンド」を末尾に付与することで、システムを操作できます。
    - カート追加: [[ACTION:ADD_CART:[{"id":"資材ID","name":"品名","quantity":数量}]]]
      ※伝票作成、出庫処理、現場への持ち出しの際に使用。
    - 見積作成: [[ACTION:CREATE_ESTIMATE:[{"id":"新規","name":"品名","quantity":数量,"listPrice":定価,"costPrice":原価,"model":"型式","unit":"単位"}]]]
      ※正式な見積書の発行、価格検討の際に使用。
    - 資材登録: [[ACTION:REGISTER_ITEMS:[{"name":"品名","category":"分類","model":"型式","dimensions":"寸法","listPrice":定価,"costPrice":原価,"unit":"単位"}]]]
      ※新しい資材をマスターに登録する際に使用。
    - 情報更新: [[ACTION:UPDATE_INFO:{"customerName":"顧客名","siteName":"現場名"}]]

    【あなたの知識（在庫リスト）】
    ${JSON.stringify(knowledgeBase)}
  `;

  // Mock mode for test environment or missing API key
  const apiKey = ((import.meta as any).env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' && process.env?.API_KEY);

  if (!apiKey || (typeof apiKey === 'string' && apiKey.includes('PLACEHOLDER'))) {
    console.warn("AI Takahashi: Running in MOCK MODE due to missing API key.");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    // Simple mock logic to return different responses based on input
    const lastUserMessage = messages[messages.length - 1];
    const userText = lastUserMessage?.parts?.[0]?.text || "";

    let mockText = "あ、高橋です。テスト環境だもんで、まだ本調子じゃないけど、なんのせ頑張るわ。\n";
    if (userText.includes("見積")) {
      mockText += "見積もりだね、了解。適当に見繕っておくわ。\n[[ACTION:CREATE_ESTIMATE:[{\"name\":\"テスト用資材A\",\"quantity\":10,\"listPrice\":1000,\"costPrice\":500,\"model\":\"TEST-001\",\"unit\":\"個\"}]]]";
    } else if (userText.includes("在庫")) {
      mockText += "在庫確認かい？全部あることにしておくべ。\n[[ACTION:ADD_CART:[{\"id\":\"mock-1\",\"name\":\"テスト用パイプ\",\"quantity\":5}]]]";
    } else {
      mockText += `「${userText}」ってことだね。詳しくは本番環境で聞いてくれや。`;
    }

    return {
      text: mockText,
      candidates: [{ groundingMetadata: { groundingChunks: [] } }]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: messages,
    config: {
      systemInstruction,
      tools: [{ googleSearch: {} }], // 帯広の天気や現場情報のリサーチに使用
    }
  });

  return response;
};
