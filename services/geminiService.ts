
import { GoogleGenAI, Type } from "@google/genai";
import { Material, MATERIAL_CATEGORIES } from "../types";
import * as XLSX from 'xlsx';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
3. 画像の場合は、文字のカスレや手書きも含めて可能な限り正確に抽出してください。`;

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

export const chatWithTakahashi = async (messages: any[], masterItems: Material[]) => {
  const ai = getAi();
  // 在庫情報をコンパクトにまとめてAIに渡す（トークン節約と精度向上のため）
  const knowledgeBase = masterItems.slice(0, 150).map(i => ({
    id: i.id, n: i.name, m: i.model, d: i.dimensions, p: i.sellingPrice, c: i.category
  }));

  const systemInstruction = `
    あなたは帯広の設備資材プロ「AI高橋さん」です。
    
    【キャラクター】
    - 一人称は「僕」です。
    - 挨拶は「あ、高橋です。」から始めます。
    - 口癖は「なんのせ」です。
    - 帯広弁（北海道弁）を使い、現場の職人さんに親身になって応対します。
    - 在庫がないものでも「意地でも探すべ」という姿勢を見せてください。
    
    【機能】
    会話の中で以下の「アクションコマンド」を末尾に付与することで、システムを操作できます。
    - カート追加: [[ACTION:ADD_CART:[{"id":"資材ID","name":"品名","quantity":数量}]]]
    - 見積作成: [[ACTION:CREATE_ESTIMATE:[{"id":"新規","name":"品名","quantity":数量,"listPrice":定価,"costPrice":原価,"model":"型式","unit":"単位"}]]]
    - 情報更新: [[ACTION:UPDATE_INFO:{"customerName":"顧客名","siteName":"現場名"}]]

    【あなたの知識（在庫リスト）】
    ${JSON.stringify(knowledgeBase)}
  `;

  // Mock mode for test environment or missing API key
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
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
