/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import {
  Flame,
  Plus,
  Trash2,
  Download,
  Upload,
  BookOpen,
  Save,
  Image as ImageIcon,
  Clock,
  Layers,
  Wind,
  AlertTriangle,
  CheckCircle2,
  X,
  Sliders,
  RotateCcw
} from 'lucide-react';

interface LiquidIngredient {
  id: string;
  name: string;
  percentage: number | string;
  waterContent: number | string;
  deletable: boolean;
}

interface DryIngredient {
  id: string;
  name: string;
  percentage: number | string;
  deletable: boolean;
}

interface FlourBlendItem {
  id: string;
  name: string;
  percentage: number | string;
  deletable: boolean;
}

interface SourdoughStarterItem {
  id: string;
  name: string;
  percentage: number | string;
  waterRatio: number; // 粉水比 1 : waterRatio (預設 1 即 1:1)
  deletable: boolean;
}

interface OvenSettings {
  mode: 'dual' | 'single'; // 'dual' = 獨立上下火, 'single' = 單一溫度(上下同溫)
  topTemp: number | string;         // 上火 (°C)
  bottomTemp: number | string;      // 下火 (°C)
  bakeTime: number | string;        // 第一階段時間 (分鐘)
  enableStage2: boolean;   // 是否啟用二段烤溫 (掉頭/調溫)
  stage2TopTemp: number | string;   // 二段上火 (°C)
  stage2BottomTemp: number | string;// 二段下火 (°C)
  stage2BakeTime: number | string;  // 二段時間 (分鐘)
  rackPosition: string;    // 烤盤位置: 上層 / 中層 / 中下層 / 下層
  assistMode: string;      // 輔助模式: 標準無蒸汽 / 入爐蒸汽 / 旋風對流
  notes: string;           // 烘烤備註 (例如：12分鐘掉頭、上色蓋鋁箔紙)
}

interface SavedRecipe {
  id: string;
  recipeName: string;
  targetDoughWeight: number | string;
  targetHydration: number | string;
  mainFlourName?: string;
  blendedFlours?: FlourBlendItem[];
  tzPercent: number | string;
  tzRatio: number;
  sdPercent: number | string;
  sourdoughs?: SourdoughStarterItem[];
  divideCount: number | string;
  oven: OvenSettings;
  liquidIngredients: LiquidIngredient[];
  ingredients: DryIngredient[];
  createdAt: string;
}

interface OvenPreset {
  label: string;
  category: string;
  topTemp: number;
  bottomTemp: number;
  bakeTime: number;
  enableStage2?: boolean;
  stage2TopTemp?: number;
  stage2BottomTemp?: number;
  stage2BakeTime?: number;
  rackPosition: string;
  assistMode: string;
  notes: string;
}

const OVEN_PRESETS: OvenPreset[] = [
  {
    label: '山形吐司',
    category: '170°C / 210°C · 35分',
    topTemp: 170,
    bottomTemp: 210,
    bakeTime: 35,
    rackPosition: '下層',
    assistMode: '標準無蒸汽',
    notes: '入爐約 12 分鐘表面上色後可蓋鋁箔紙防焦'
  },
  {
    label: '帶蓋吐司',
    category: '200°C / 210°C · 32分',
    topTemp: 200,
    bottomTemp: 210,
    bakeTime: 32,
    rackPosition: '下層',
    assistMode: '標準無蒸汽',
    notes: '帶蓋烘烤受熱均勻，出爐立即重震脫模'
  },
  {
    label: '台式甜麵包/餐包',
    category: '190°C / 170°C · 15分',
    topTemp: 190,
    bottomTemp: 170,
    bakeTime: 10,
    enableStage2: true,
    stage2TopTemp: 180,
    stage2BottomTemp: 160,
    stage2BakeTime: 5,
    rackPosition: '中層',
    assistMode: '標準無蒸汽',
    notes: '前段 10 分鐘上色後烤盤掉頭，後段微降上火烤 5 分鐘'
  },
  {
    label: '法式長棍/歐包',
    category: '230°C / 220°C · 22分',
    topTemp: 230,
    bottomTemp: 220,
    bakeTime: 12,
    enableStage2: true,
    stage2TopTemp: 210,
    stage2BottomTemp: 200,
    stage2BakeTime: 10,
    rackPosition: '中下層',
    assistMode: '入爐蒸汽',
    notes: '入爐噴蒸汽 5 秒，12 分鐘後排氣降溫續烤至表皮酥脆'
  },
  {
    label: '貝果 / 鹽可頌',
    category: '210°C / 190°C · 18分',
    topTemp: 210,
    bottomTemp: 190,
    bakeTime: 18,
    rackPosition: '中層',
    assistMode: '入爐蒸汽',
    notes: '烤至第 12 分鐘烤盤掉頭使上色均勻'
  },
  {
    label: '戚風蛋糕',
    category: '170°C / 150°C · 35分',
    topTemp: 170,
    bottomTemp: 150,
    bakeTime: 12,
    enableStage2: true,
    stage2TopTemp: 155,
    stage2BottomTemp: 150,
    stage2BakeTime: 23,
    rackPosition: '中下層',
    assistMode: '標準無蒸汽',
    notes: '前 12 分鐘結皮畫線，後段降上火慢烤熟透'
  }
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function parseNum(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

const STORAGE_KEY = 'bakers_calculator_saved_recipes_v2';

export default function App() {
  // 基本配方狀態 - 預設空白，無任何預設數字
  const [recipeName, setRecipeName] = useState<string>('');
  const [targetDoughWeight, setTargetDoughWeight] = useState<number | string>('');
  const [targetHydration, setTargetHydration] = useState<number | string>('');
  const [mainFlourName, setMainFlourName] = useState<string>('高筋麵粉');
  const [blendedFlours, setBlendedFlours] = useState<FlourBlendItem[]>([
    { id: 'flour-blend-1', name: '全麥麵粉', percentage: '', deletable: false }
  ]);
  const [tzPercent, setTzPercent] = useState<number | string>('');
  const [tzRatio, setTzRatio] = useState<number>(5);
  const [sourdoughs, setSourdoughs] = useState<SourdoughStarterItem[]>([
    { id: 'sd-starter-1', name: '自製酵母 (天然酵母)', percentage: '', waterRatio: 1, deletable: false }
  ]);
  const [divideCount, setDivideCount] = useState<number | string>('');

  // 烤箱溫度設定 (包含上下火) - 預設空白
  const [oven, setOven] = useState<OvenSettings>({
    mode: 'dual',
    topTemp: '',
    bottomTemp: '',
    bakeTime: '',
    enableStage2: false,
    stage2TopTemp: '',
    stage2BottomTemp: '',
    stage2BakeTime: '',
    rackPosition: '中層',
    assistMode: '標準無蒸汽',
    notes: ''
  });

  // 液體材料狀態 - 預設無預設數字，保持空白
  const [liquidIngredients, setLiquidIngredients] = useState<LiquidIngredient[]>([
    { id: 'liq-milk', name: '牛奶 (Milk)', percentage: '', waterContent: '', deletable: true },
    { id: 'liq-egg', name: '雞蛋 (Egg)', percentage: '', waterContent: '', deletable: true }
  ]);

  // 乾性材料狀態 - 預設無預設數字，保持空白
  const [ingredients, setIngredients] = useState<DryIngredient[]>([
    { id: 'dry-salt', name: '鹽 (Salt)', percentage: '', deletable: false },
    { id: 'dry-yeast', name: '速發酵母 (Yeast)', percentage: '', deletable: false },
    { id: 'dry-sugar', name: '糖 (Sugar)', percentage: '', deletable: true },
    { id: 'dry-butter', name: '奶油 (Butter)', percentage: '', deletable: true }
  ]);

  // 配方簿與通知狀態
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id);
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const captureCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
    } catch {
      // ignore storage errors
    }
  }, [savedRecipes]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3000);
  };

  // 更新烤箱設定
  const updateOven = <K extends keyof OvenSettings>(key: K, value: OvenSettings[K]) => {
    setOven(prev => {
      const next = { ...prev, [key]: value };
      if (next.mode === 'single') {
        if (key === 'topTemp') next.bottomTemp = value as string | number;
        if (key === 'mode') {
          next.bottomTemp = prev.topTemp;
          next.stage2BottomTemp = prev.stage2TopTemp;
        }
        if (key === 'stage2TopTemp') next.stage2BottomTemp = value as string | number;
      }
      return next;
    });
  };

  const applyOvenPreset = (preset: OvenPreset) => {
    setOven({
      mode: 'dual',
      topTemp: preset.topTemp,
      bottomTemp: preset.bottomTemp,
      bakeTime: preset.bakeTime,
      enableStage2: Boolean(preset.enableStage2),
      stage2TopTemp: preset.stage2TopTemp ?? Math.max(0, preset.topTemp - 15),
      stage2BottomTemp: preset.stage2BottomTemp ?? Math.max(0, preset.bottomTemp - 10),
      stage2BakeTime: preset.stage2BakeTime ?? 5,
      rackPosition: preset.rackPosition,
      assistMode: preset.assistMode,
      notes: preset.notes
    });
    showToast(`已套用「${preset.label}」烤溫：上火 ${preset.topTemp}°C / 下火 ${preset.bottomTemp}°C`);
  };

  // 精準烘焙百分比計算
  const calc = useMemo(() => {
    const doughW = Math.max(0, parseNum(targetDoughWeight));
    const hasDoughWeight = parseNum(targetDoughWeight) > 0;
    const hasTargetHydration = String(targetHydration).trim() !== '';
    const hydration = Math.max(0, parseNum(targetHydration));

    const dryPercentage = ingredients.reduce((sum, ing) => sum + parseNum(ing.percentage), 0);

    // 計算液體材料提供之水份百分比與固形物百分比 (相對於總麵粉 100%)
    let liquidProvidedWaterPercent = 0;
    let liquidSolidPercentage = 0;

    liquidIngredients.forEach(liq => {
      const pct = parseNum(liq.percentage);
      if (pct > 0) {
        // 若有填寫含水量則使用，若留白且有填寫比例則預設 100% 水份
        const rawWc = liq.waterContent === '' ? 100 : parseNum(liq.waterContent);
        const wc = Math.min(100, Math.max(0, rawWc));
        const waterPart = (pct * wc) / 100;
        const solidPart = pct - waterPart;
        liquidProvidedWaterPercent += waterPart;
        liquidSolidPercentage += solidPart;
      }
    });

    const tzPct = Math.max(0, parseNum(tzPercent));
    const tzRat = tzRatio || 5;

    // 多種自製酵母 / 天然酵母加總 (相對於總麵粉 100%)
    const sdPct = sourdoughs.reduce((sum, sd) => sum + Math.max(0, parseNum(sd.percentage)), 0);

    // 酵種水份百分比 (相對於總麵粉 100%)
    const tzWaterPercent = tzPct * tzRat;
    const sdWaterPercent = sourdoughs.reduce((sum, sd) => {
      const pct = Math.max(0, parseNum(sd.percentage));
      const rat = sd.waterRatio > 0 ? Number(sd.waterRatio) : 1;
      return sum + pct * rat;
    }, 0);
    const prefWaterPercent = tzWaterPercent + sdWaterPercent;

    // 所有材料與酵種合計提供之總水份百分比 (基準為 100% 總麵粉)
    const totalProvidedWaterPercent = liquidProvidedWaterPercent + prefWaterPercent;

    // 水量超標判斷：
    // 只要材料與酵種提供的總水份百分比 > 0，且超過目標水合率 (+0.05% 公差)，即觸發警告
    const waterExcessPercent = totalProvidedWaterPercent - hydration;
    const isWaterExceededByPercent = totalProvidedWaterPercent > 0.05 && waterExcessPercent > 0.05;

    // 混合副粉百分比加總 (相對於總麵粉 100%)
    const blendedFlourTotalPercent = blendedFlours.reduce(
      (sum, f) => sum + Math.max(0, parseNum(f.percentage)),
      0
    );

    // 麵粉超標判斷：混合副粉% + 湯種提撥% + 所有天然酵母提撥% 超過 100%
    const totalAllocatedFlourPercent = blendedFlourTotalPercent + tzPct + sdPct;
    const flourExcessPercent = Math.max(0, totalAllocatedFlourPercent - 100);
    const flourWarning = totalAllocatedFlourPercent > 100.05;

    const totalPercentage = 100 + hydration + dryPercentage + liquidSolidPercentage;
    const totalFlourWeight = totalPercentage > 0 && doughW > 0 ? doughW / (totalPercentage / 100) : 0;
    const totalWaterWeight = totalFlourWeight > 0 ? (totalFlourWeight * hydration) / 100 : 0;

    const computedBlendedFlours = blendedFlours.map(f => {
      const pct = Math.max(0, parseNum(f.percentage));
      const weight = totalFlourWeight > 0 ? (totalFlourWeight * pct) / 100 : 0;
      return {
        ...f,
        pct,
        weight
      };
    });

    const blendedFlourTotalWeight = computedBlendedFlours.reduce((sum, f) => sum + f.weight, 0);

    const tzFlourWeight = totalFlourWeight > 0 ? (totalFlourWeight * tzPct) / 100 : 0;
    const tzWaterWeight = tzFlourWeight * tzRat;
    const tzTotalWeight = tzFlourWeight + tzWaterWeight;

    const computedSourdoughs = sourdoughs.map(sd => {
      const pct = Math.max(0, parseNum(sd.percentage));
      const ratio = sd.waterRatio > 0 ? Number(sd.waterRatio) : 1;
      const flourWeight = totalFlourWeight > 0 ? (totalFlourWeight * pct) / 100 : 0;
      const waterWeight = flourWeight * ratio;
      const totalStarterWeight = flourWeight + waterWeight;
      return {
        ...sd,
        pct,
        ratio,
        flourWeight,
        waterWeight,
        totalStarterWeight
      };
    });

    const sdFlourWeight = computedSourdoughs.reduce((sum, sd) => sum + sd.flourWeight, 0);
    const sdWaterWeight = computedSourdoughs.reduce((sum, sd) => sum + sd.waterWeight, 0);

    let totalWeight = totalFlourWeight + totalWaterWeight;
    let liquidProvidedWater = 0;

    const computedLiquids = liquidIngredients.map(liq => {
      const pct = parseNum(liq.percentage);
      const rawWc = liq.waterContent === '' ? 100 : parseNum(liq.waterContent);
      const wc = Math.min(100, Math.max(0, rawWc));
      const waterPct = (pct * wc) / 100;
      const weight = totalFlourWeight > 0 ? (totalFlourWeight * pct) / 100 : 0;
      const waterWeight = weight * (wc / 100);
      const solidWeight = weight - waterWeight;
      if (totalFlourWeight > 0) {
        totalWeight += solidWeight;
        liquidProvidedWater += waterWeight;
      }
      return {
        ...liq,
        weight,
        waterWeight,
        waterPercent: waterPct
      };
    });

    const computedDry = ingredients.map(ing => {
      const pct = parseNum(ing.percentage);
      const weight = totalFlourWeight > 0 ? (totalFlourWeight * pct) / 100 : 0;
      if (totalFlourWeight > 0) {
        totalWeight += weight;
      }
      return {
        ...ing,
        weight
      };
    });

    const mainDoughFlourWeight =
      totalFlourWeight > 0
        ? totalFlourWeight - blendedFlourTotalWeight - tzFlourWeight - sdFlourWeight
        : 0;
    const prefWaterRemaining = tzWaterWeight + sdWaterWeight;
    const mainDoughWaterWeight = totalFlourWeight > 0 ? totalWaterWeight - prefWaterRemaining - liquidProvidedWater : 0;

    const waterWarning = isWaterExceededByPercent || (hasDoughWeight && mainDoughWaterWeight < -0.05);

    const excessWaterGrams =
      totalFlourWeight > 0 && waterExcessPercent > 0.05
        ? (waterExcessPercent * totalFlourWeight) / 100
        : totalFlourWeight > 0 && mainDoughWaterWeight < -0.05
          ? Math.abs(mainDoughWaterWeight)
          : 0;

    const remainingWaterPercent = Math.max(0, hydration - totalProvidedWaterPercent);
    const remainingWaterGrams = Math.max(0, mainDoughWaterWeight);
    const primaryFlourTotalPercent = Math.max(0, 100 - blendedFlourTotalPercent);
    const mainDoughFlourPercent = Math.max(0, 100 - blendedFlourTotalPercent - tzPct - sdPct);

    const mainRecipeItems: Array<{
      name: string;
      weight: number;
      percentLabel?: string;
      colorClass: string;
      hexColor: string;
      isMain?: boolean;
      isPref?: boolean;
    }> = [];

    const primaryLabel = mainFlourName.trim() || '高筋麵粉';

    if (totalFlourWeight > 0) {
      if (mainDoughFlourWeight > 0.05) {
        mainRecipeItems.push({
          name: `主麵團${primaryLabel} (${Number(mainDoughFlourPercent.toFixed(1))}%)`,
          weight: mainDoughFlourWeight,
          percentLabel: `${Number(mainDoughFlourPercent.toFixed(1))}%`,
          colorClass: 'text-amber-900',
          hexColor: '#78350f',
          isMain: true
        });
      }

      computedBlendedFlours.forEach(bf => {
        if (bf.weight > 0.05) {
          const bfLabel = bf.name.trim() || '混合麵粉';
          mainRecipeItems.push({
            name: `主麵團${bfLabel} (${Number(bf.pct.toFixed(1))}%)`,
            weight: bf.weight,
            percentLabel: `${Number(bf.pct.toFixed(1))}%`,
            colorClass: 'text-amber-800',
            hexColor: '#92400e',
            isMain: true
          });
        }
      });

      if (flourWarning || mainDoughFlourWeight < -0.05) {
        mainRecipeItems.push({
          name: `⚠️ 麵粉配比與提撥超過 100% (超額 +${Number(flourExcessPercent.toFixed(1))}%)`,
          weight: 0,
          colorClass: 'text-red-600',
          hexColor: '#dc2626',
          isMain: true
        });
      }

      if (mainDoughWaterWeight > 0.05) {
        mainRecipeItems.push({
          name: `主麵團純加水量 (${Number(remainingWaterPercent.toFixed(1))}%)`,
          weight: mainDoughWaterWeight,
          percentLabel: `${Number(remainingWaterPercent.toFixed(1))}%`,
          colorClass: 'text-blue-700',
          hexColor: '#1d4ed8',
          isMain: true
        });
      } else if (waterWarning || mainDoughWaterWeight < -0.05) {
        mainRecipeItems.push({
          name: `⚠️ 主麵團純加水 (已超標 ${Number(excessWaterGrams.toFixed(1))}g 倒扣至 0g)`,
          weight: 0,
          colorClass: 'text-red-600',
          hexColor: '#dc2626',
          isMain: true
        });
      }

      computedLiquids.forEach(liq => {
        if (liq.weight > 0) {
          mainRecipeItems.push({
            name: `${liq.name} (${liq.percentage}%)`,
            weight: liq.weight,
            percentLabel: `${liq.percentage}%`,
            colorClass: 'text-blue-800',
            hexColor: '#1e40af'
          });
        }
      });

      if (tzTotalWeight > 0) {
        mainRecipeItems.push({
          name: `湯種 [提撥 ${tzPercent}% 麵粉・1:${tzRat}] (粉${Number(tzFlourWeight.toFixed(1))}g + 水${Number(tzWaterWeight.toFixed(1))}g)`,
          weight: tzTotalWeight,
          percentLabel: `${tzPercent}%`,
          colorClass: 'text-orange-700',
          hexColor: '#c2410c',
          isPref: true
        });
      }

      computedSourdoughs.forEach(sd => {
        if (sd.totalStarterWeight > 0) {
          const sdLabel = sd.name.trim() || '自製酵母';
          mainRecipeItems.push({
            name: `${sdLabel} [提撥 ${sd.percentage}% 麵粉・1:${sd.ratio}] (粉${Number(sd.flourWeight.toFixed(1))}g + 水${Number(sd.waterWeight.toFixed(1))}g)`,
            weight: sd.totalStarterWeight,
            percentLabel: `${sd.percentage}%`,
            colorClass: 'text-orange-700',
            hexColor: '#c2410c',
            isPref: true
          });
        }
      });

      computedDry.forEach(ing => {
        if (ing.weight > 0) {
          mainRecipeItems.push({
            name: `${ing.name} (${ing.percentage}%)`,
            weight: ing.weight,
            percentLabel: `${ing.percentage}%`,
            colorClass: 'text-gray-800',
            hexColor: '#1f2937'
          });
        }
      });
    }

    const allIngredientPercentages: Array<{
      name: string;
      percent: number | string;
      note: string;
      isPref?: boolean;
    }> = [];

    if (mainDoughFlourPercent > 0 && (totalFlourWeight > 0 || tzPct > 0 || sdPct > 0 || blendedFlourTotalPercent > 0)) {
      allIngredientPercentages.push({
        name: `主麵團${primaryLabel}`,
        percent: Number(mainDoughFlourPercent.toFixed(1)),
        note: tzPct > 0 || sdPct > 0 ? '(扣除種麵與副粉後)' : blendedFlourTotalPercent > 0 ? '(扣除副粉後)' : '(總麵粉)'
      });
    }

    computedBlendedFlours
      .filter(bf => bf.pct > 0)
      .forEach(bf => {
        allIngredientPercentages.push({
          name: `主麵團${bf.name.trim() || '混合麵粉'}`,
          percent: Number(bf.pct.toFixed(1)),
          note: '(混合麵粉)'
        });
      });

    if (tzPct > 0) {
      allIngredientPercentages.push({
        name: '湯種',
        percent: tzPercent,
        note: `(提撥麵粉・1:${tzRat}・總重${Number((tzPct * (1 + tzRat)).toFixed(1))}%)`,
        isPref: true
      });
    }

    computedSourdoughs
      .filter(sd => sd.pct > 0)
      .forEach(sd => {
        allIngredientPercentages.push({
          name: sd.name.trim() || '自製酵母',
          percent: sd.percentage,
          note: `(提撥麵粉・1:${sd.ratio}・總重${Number((sd.pct * (1 + sd.ratio)).toFixed(1))}%)`,
          isPref: true
        });
      });

    if (remainingWaterPercent > 0.05) {
      allIngredientPercentages.push({
        name: '主麵團純加水量',
        percent: Number(remainingWaterPercent.toFixed(1)),
        note: ''
      });
    }

    computedLiquids
      .filter(l => parseNum(l.percentage) > 0)
      .forEach(l => {
        allIngredientPercentages.push({
          name: l.name,
          percent: l.percentage,
          note: l.waterContent !== '' ? `(含水${l.waterContent}%)` : ''
        });
      });

    computedDry
      .filter(d => parseNum(d.percentage) > 0)
      .forEach(d => {
        allIngredientPercentages.push({
          name: d.name,
          percent: d.percentage,
          note: ''
        });
      });

    const ingredientExportData = allIngredientPercentages;

    const portions = Math.max(1, Math.floor(parseNum(divideCount) || 1));
    const perPortion = totalWeight > 0 ? totalWeight / portions : 0;
    const totalBakeMinutes =
      parseNum(oven.bakeTime) + (oven.enableStage2 ? parseNum(oven.stage2BakeTime) : 0);

    return {
      hasDoughWeight,
      hasTargetHydration,
      targetHydrationNum: hydration,
      totalFlourWeight,
      totalWaterWeight,
      tzPct,
      tzRat,
      sdPct,
      primaryFlourTotalPercent,
      blendedFlourTotalPercent,
      mainDoughFlourPercent,
      mainDoughFlourWeight,
      computedBlendedFlours,
      computedSourdoughs,
      flourExcessPercent,
      tzFlourWeight,
      tzWaterWeight,
      sdFlourWeight,
      sdWaterWeight,
      computedLiquids,
      computedDry,
      mainRecipeItems,
      ingredientExportData,
      totalWeight,
      portions,
      perPortion,
      totalBakeMinutes,
      liquidProvidedWaterPercent,
      prefWaterPercent,
      totalProvidedWaterPercent,
      waterExcessPercent,
      excessWaterGrams,
      remainingWaterPercent,
      remainingWaterGrams,
      waterWarning,
      flourWarning: flourWarning || (hasDoughWeight && mainDoughFlourWeight < -0.05)
    };
  }, [
    targetDoughWeight,
    targetHydration,
    mainFlourName,
    blendedFlours,
    tzPercent,
    tzRatio,
    sourdoughs,
    divideCount,
    liquidIngredients,
    ingredients,
    oven.bakeTime,
    oven.enableStage2,
    oven.stage2BakeTime
  ]);

  // 新增/更新/刪除天然酵母 - 新增時亦預設空白
  const handleAddSourdough = () => {
    setSourdoughs(prev => [
      ...prev,
      {
        id: generateId(),
        name: `天然酵母 ${prev.length + 1}`,
        percentage: '',
        waterRatio: 1,
        deletable: true
      }
    ]);
  };

  const handleUpdateSourdough = (
    id: string,
    field: keyof SourdoughStarterItem,
    value: string | number
  ) => {
    setSourdoughs(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteSourdough = (id: string) => {
    setSourdoughs(prev => prev.filter(item => item.id !== id));
  };

  // 新增/更新/刪除混合麵粉 - 新增時亦預設空白
  const handleAddBlendedFlour = () => {
    setBlendedFlours(prev => [
      ...prev,
      { id: generateId(), name: '低筋麵粉', percentage: '', deletable: true }
    ]);
  };

  const handleUpdateBlendedFlour = (
    id: string,
    field: keyof FlourBlendItem,
    value: string | number
  ) => {
    setBlendedFlours(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteBlendedFlour = (id: string) => {
    setBlendedFlours(prev => prev.filter(item => item.id !== id));
  };

  // 新增/更新/刪除液體與乾性材料 - 新增時亦預設空白
  const handleAddLiquid = () => {
    setLiquidIngredients(prev => [
      ...prev,
      { id: generateId(), name: '新液體材料', percentage: '', waterContent: '', deletable: true }
    ]);
  };

  const handleUpdateLiquid = (id: string, field: keyof LiquidIngredient, value: string | number) => {
    setLiquidIngredients(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteLiquid = (id: string) => {
    setLiquidIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleAddDry = () => {
    setIngredients(prev => [
      ...prev,
      { id: generateId(), name: '新材料', percentage: '', deletable: true }
    ]);
  };

  const handleUpdateDry = (id: string, field: keyof DryIngredient, value: string | number) => {
    setIngredients(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteDry = (id: string) => {
    setIngredients(prev => prev.filter(item => item.id !== id));
  };

  // 儲存配方至配方簿
  const handleSaveToBook = () => {
    if (calc.waterWarning || calc.flourWarning) {
      if (calc.waterWarning) {
        showToast(
          `材料總水量已超過目標總水份（超額 +${Number(calc.waterExcessPercent.toFixed(1))}%），請修正後再儲存`,
          'error'
        );
      } else {
        showToast('配方比例設定有誤，請修正後再儲存', 'error');
      }
      return;
    }

    const name = recipeName.trim() || '未命名烘焙配方';
    const newEntry: SavedRecipe = {
      id: generateId(),
      recipeName: name,
      targetDoughWeight,
      targetHydration,
      mainFlourName,
      blendedFlours: [...blendedFlours],
      tzPercent,
      tzRatio,
      sdPercent: sourdoughs[0]?.percentage ?? '',
      sourdoughs: [...sourdoughs],
      divideCount,
      oven: { ...oven },
      liquidIngredients: [...liquidIngredients],
      ingredients: [...ingredients],
      createdAt: new Date().toISOString()
    };

    setSavedRecipes(prev => [newEntry, ...prev]);
    showToast(`配方「${name}」已儲存至配方簿！`);
  };

  // 載入配方
  const applyRecipeObject = (recipe: Partial<SavedRecipe> & Record<string, any>) => {
    setRecipeName(recipe.recipeName || '');
    setTargetDoughWeight(recipe.targetDoughWeight ?? '');
    setTargetHydration(recipe.targetHydration ?? '');
    setMainFlourName(recipe.mainFlourName || '高筋麵粉');
    if (recipe.blendedFlours) {
      const parsedFlours =
        typeof recipe.blendedFlours === 'string'
          ? JSON.parse(recipe.blendedFlours)
          : recipe.blendedFlours;
      if (Array.isArray(parsedFlours) && parsedFlours.length > 0) {
        setBlendedFlours(parsedFlours);
      } else {
        setBlendedFlours([{ id: 'flour-blend-1', name: '全麥麵粉', percentage: '', deletable: false }]);
      }
    } else {
      setBlendedFlours([{ id: 'flour-blend-1', name: '全麥麵粉', percentage: '', deletable: false }]);
    }
    setTzPercent(recipe.tzPercent ?? '');
    setTzRatio(Number(recipe.tzRatio) === 1 ? 1 : 5);
    if (recipe.sourdoughs) {
      const parsedSd =
        typeof recipe.sourdoughs === 'string'
          ? JSON.parse(recipe.sourdoughs)
          : recipe.sourdoughs;
      if (Array.isArray(parsedSd) && parsedSd.length > 0) {
        setSourdoughs(
          parsedSd.map((item: any, idx: number) => ({
            id: item.id || generateId(),
            name: item.name || (idx === 0 ? '自製酵母 (天然酵母)' : `天然酵母 ${idx + 1}`),
            percentage: item.percentage ?? '',
            waterRatio: Number(item.waterRatio) > 0 ? Number(item.waterRatio) : 1,
            deletable: idx > 0 ? true : Boolean(item.deletable)
          }))
        );
      } else {
        setSourdoughs([
          { id: 'sd-starter-1', name: '自製酵母 (天然酵母)', percentage: '', waterRatio: 1, deletable: false }
        ]);
      }
    } else {
      setSourdoughs([
        {
          id: 'sd-starter-1',
          name: '自製酵母 (天然酵母)',
          percentage: recipe.sdPercent ?? '',
          waterRatio: 1,
          deletable: false
        }
      ]);
    }
    setDivideCount(recipe.divideCount ?? '');

    if (recipe.oven) {
      setOven({
        mode: recipe.oven.mode === 'single' ? 'single' : 'dual',
        topTemp: recipe.oven.topTemp ?? '',
        bottomTemp: recipe.oven.bottomTemp ?? '',
        bakeTime: recipe.oven.bakeTime ?? '',
        enableStage2: Boolean(recipe.oven.enableStage2),
        stage2TopTemp: recipe.oven.stage2TopTemp ?? '',
        stage2BottomTemp: recipe.oven.stage2BottomTemp ?? '',
        stage2BakeTime: recipe.oven.stage2BakeTime ?? '',
        rackPosition: recipe.oven.rackPosition || '中層',
        assistMode: recipe.oven.assistMode || '標準無蒸汽',
        notes: recipe.oven.notes || ''
      });
    } else if (recipe.topTemp !== undefined || recipe.bottomTemp !== undefined) {
      setOven(prev => ({
        ...prev,
        mode: recipe.isSingleTempMode ? 'single' : 'dual',
        topTemp: recipe.topTemp ?? '',
        bottomTemp: recipe.bottomTemp ?? '',
        bakeTime: recipe.bakeTime ?? '',
        rackPosition: recipe.rackPosition || '中層',
        notes: recipe.bakeNotes || ''
      }));
    }

    if (recipe.liquidIngredients) {
      const parsedLiquids =
        typeof recipe.liquidIngredients === 'string'
          ? JSON.parse(recipe.liquidIngredients)
          : recipe.liquidIngredients;
      if (Array.isArray(parsedLiquids)) setLiquidIngredients(parsedLiquids);
    }

    if (recipe.ingredients) {
      const parsedDry =
        typeof recipe.ingredients === 'string'
          ? JSON.parse(recipe.ingredients)
          : recipe.ingredients;
      if (Array.isArray(parsedDry)) setIngredients(parsedDry);
    }
  };

  // 下載 JSON 配方檔
  const handleExportJson = async () => {
    if (calc.waterWarning || calc.flourWarning) {
      if (calc.waterWarning) {
        showToast(
          `材料總水量已超過目標總水份（超額 +${Number(calc.waterExcessPercent.toFixed(1))}%），請修正後再匯出`,
          'error'
        );
      } else {
        showToast('配方比例設定有誤，請修正後再匯出', 'error');
      }
      return;
    }

    const name = (recipeName.trim() || '未命名配方').replace(/[\\/:*?"<>|]/g, '');
    const payload = {
      recipeName: recipeName.trim() || '未命名配方',
      targetDoughWeight,
      targetHydration,
      mainFlourName,
      blendedFlours: JSON.stringify(blendedFlours),
      tzPercent,
      tzRatio,
      sdPercent: sourdoughs[0]?.percentage ?? '',
      sourdoughs: JSON.stringify(sourdoughs),
      divideCount,
      oven,
      topTemp: oven.topTemp,
      bottomTemp: oven.bottomTemp,
      bakeTime: oven.bakeTime,
      rackPosition: oven.rackPosition,
      bakeNotes: oven.notes,
      isSingleTempMode: oven.mode === 'single',
      liquidIngredients: JSON.stringify(liquidIngredients),
      ingredients: JSON.stringify(ingredients)
    };

    const fileContent = JSON.stringify(payload, null, 2);
    const defaultFileName = `${name}.json`;

    // 優先嘗試使用瀏覽器選擇儲存位置 API，若在 iframe 內受限則自動退回一般下載
    const win = window as Window & {
      showSaveFilePicker?: (options?: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (typeof win.showSaveFilePicker === 'function') {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [
            {
              description: 'JSON 配方檔',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(fileContent);
        await writable.close();
        showToast(`配方檔「${defaultFileName}」儲存成功！`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return; // 使用者取消儲存視窗
        }
        // 若為 SecurityError (如 iframe 限制) 或其他錯誤，自動退回下方傳統下載方式
      }
    }

    try {
      const blob = new Blob([fileContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`已下載配方檔「${defaultFileName}」`);
    } catch (error) {
      console.error('Export JSON error:', error);
      showToast('下載配方檔失敗，請重試', 'error');
    }
  };

  // 下載單頁獨立版 HTML (可直接部署或離線開啟，免編譯)
  const handleDownloadStandaloneHtml = async () => {
    try {
      const res = await fetch('./assets/aistudio/index_b872a86c.html');
      const htmlText = await res.text();
      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('已下載單頁部署版 index.html（可直接上傳或點擊開啟）');
    } catch {
      showToast('下載單頁 HTML 失敗，請重試', 'error');
    }
  };

  // 匯入 JSON 配方檔
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(String(ev.target?.result || '{}'));
        applyRecipeObject(data);
        showToast(`已成功載入配方：「${data.recipeName || '未命名配方'}」`);
      } catch {
        showToast('檔案格式錯誤，無法載入配方', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // 匯出精美配方卡 PNG
  const handleExportCardImage = async () => {
    if (!calc.hasDoughWeight) {
      showToast('請先輸入目標麵團重量！', 'error');
      return;
    }
    if (calc.waterWarning || calc.flourWarning) {
      if (calc.waterWarning) {
        showToast(
          `材料總水量已超過目標總水份（超額 +${Number(calc.waterExcessPercent.toFixed(1))}%），請修正後再匯出圖片！`,
          'error'
        );
      } else {
        showToast('目前配方麵粉比例有誤，請修正後再匯出圖片！', 'error');
      }
      return;
    }
    if (!captureCardRef.current) return;

    setIsExportingImage(true);
    try {
      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(captureCardRef.current, {
        scale: 2.5,
        backgroundColor: '#fdfbf7',
        useCORS: true
      });
      const safeName = (recipeName.trim() || '專屬烘焙配方').replace(/[\\/:*?"<>|]/g, '');
      const link = document.createElement('a');
      link.download = `${safeName}_配方卡.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast('配方卡圖片下載成功！');
    } catch (err) {
      console.error(err);
      showToast('匯出圖片時發生錯誤，請稍後再試', 'error');
    } finally {
      setIsExportingImage(false);
    }
  };

  // 全部清空為空白 - 不預設任何數字
  const handleReset = () => {
    setRecipeName('');
    setTargetDoughWeight('');
    setTargetHydration('');
    setMainFlourName('高筋麵粉');
    setBlendedFlours([
      { id: 'flour-blend-1', name: '全麥麵粉', percentage: '', deletable: false }
    ]);
    setTzPercent('');
    setTzRatio(5);
    setSourdoughs([
      { id: 'sd-starter-1', name: '自製酵母 (天然酵母)', percentage: '', waterRatio: 1, deletable: false }
    ]);
    setDivideCount('');
    setOven({
      mode: 'dual',
      topTemp: '',
      bottomTemp: '',
      bakeTime: '',
      enableStage2: false,
      stage2TopTemp: '',
      stage2BottomTemp: '',
      stage2BakeTime: '',
      rackPosition: '中層',
      assistMode: '標準無蒸汽',
      notes: ''
    });
    setLiquidIngredients([
      { id: 'liq-milk', name: '牛奶 (Milk)', percentage: '', waterContent: '', deletable: true },
      { id: 'liq-egg', name: '雞蛋 (Egg)', percentage: '', waterContent: '', deletable: true }
    ]);
    setIngredients([
      { id: 'dry-salt', name: '鹽 (Salt)', percentage: '', deletable: false },
      { id: 'dry-yeast', name: '速發酵母 (Yeast)', percentage: '', deletable: false },
      { id: 'dry-sugar', name: '糖 (Sugar)', percentage: '', deletable: true },
      { id: 'dry-butter', name: '奶油 (Butter)', percentage: '', deletable: true }
    ]);
    showToast('已清空所有表格數字，重置為空白');
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-gray-800 flex flex-col">
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white font-bold text-sm transition-all ${
              toast.type === 'success' ? 'bg-emerald-700' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-30 bg-[#fdfbf7]/95 backdrop-blur-md border-b border-amber-200/70 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg sm:text-xl font-black tracking-tight text-amber-900 whitespace-nowrap shrink-0"
          >
            🍞 烘焙材料計算器
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a
              href="#dough-section"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              麵團與酵種
            </a>
            <a
              href="#oven-section"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              上下火烤溫
            </a>
            <a
              href="#liquids-section"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              液體折水
            </a>
            <a
              href="#dry-section"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              乾性材料
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsBookModalOpen(true)}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>我的配方簿 ({savedRecipes.length})</span>
            </button>
          </div>
        </div>

        {/* 置頂懸浮超標警告列：無論捲動到哪裡都會即時顯示 */}
        {calc.waterWarning && (
          <div className="max-w-7xl mx-auto mt-2.5 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-black">
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-200" />
              <span>
                ⚠️ 警告：材料總水量（{Number(calc.totalProvidedWaterPercent.toFixed(1))}%）已超過目標總水份（{calc.targetHydrationNum}%）達 +{Number(calc.waterExcessPercent.toFixed(1))}%
                {calc.hasDoughWeight && calc.excessWaterGrams > 0
                  ? `（約超標 ${Number(calc.excessWaterGrams.toFixed(1))} 克）`
                  : ''}
                ！
              </span>
            </div>
            <span className="text-red-100 font-bold text-xs">
              請調高步驟 2「目標總水份」或減少液體材料比例
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {/* Intro Header & Toolbar */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-amber-200/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight">
              烘焙材料與上下火烤箱計算器
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              表格留白無預設數值，輸入目標重量與水合率後立即精準換算。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveToBook}
              className="bg-amber-700 hover:bg-amber-800 text-white font-bold py-2 px-3.5 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>儲存至配方簿</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-3.5 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>下載配方檔 (.json)</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-teal-300 hover:bg-teal-50 text-teal-800 font-bold py-2 px-3.5 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>載入配方檔</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleDownloadStandaloneHtml}
              className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-bold py-2 px-3.5 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
              title="下載免編譯單一 HTML 檔案，可直接上傳部署或離線開啟"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>下載單頁 HTML</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-2 px-3 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              title="全部清空為空白"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>全部清空</span>
            </button>
          </div>
        </div>

        {/* 12-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左側設定區 (7 欄) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 品項名稱設定 */}
            <section className="bg-white rounded-xl p-5 border border-gray-200">
              <label htmlFor="recipeName" className="block text-base font-bold text-gray-800 mb-2">
                品項名稱 (選填)
              </label>
              <input
                id="recipeName"
                type="text"
                value={recipeName}
                onChange={e => setRecipeName(e.target.value)}
                placeholder="例如：法式長棍麵包、山形鮮奶吐司、鹽可頌..."
                className="w-full text-lg font-medium p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-white"
              />
            </section>

            {/* 1 & 2. 麵團總量與水合率、湯種/酵種設定 - 預設留白 */}
            <section
              id="dough-section"
              className="bg-amber-50/80 rounded-xl p-5 border border-amber-200"
            >
              <label
                htmlFor="targetDoughWeight"
                className="block text-base font-bold text-amber-900 mb-2"
              >
                1. 請輸入「目標麵團總重量」(克)
              </label>
              <div className="relative mb-5">
                <input
                  id="targetDoughWeight"
                  type="number"
                  value={targetDoughWeight}
                  placeholder="請輸入目標重量，例如：1000"
                  min={1}
                  step={10}
                  onChange={e => setTargetDoughWeight(e.target.value)}
                  className="w-full text-2xl font-bold p-3 pl-4 pr-24 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-white tabular-nums placeholder:text-gray-300 placeholder:text-lg placeholder:font-normal"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-base">
                  克 (g)
                </span>
              </div>

              <label
                htmlFor="targetHydration"
                className="block text-base font-bold text-blue-900 mb-2 border-t border-amber-200 pt-5 flex items-center justify-between"
              >
                <span>2. 請輸入「目標總水份 (水合率)」(%)</span>
                {calc.waterWarning && (
                  <span className="text-xs bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    已超出目標水量！
                  </span>
                )}
              </label>
              <div className="relative mb-2">
                <input
                  id="targetHydration"
                  type="number"
                  value={targetHydration}
                  placeholder="請輸入水合率，例如：65"
                  min={0}
                  max={200}
                  step={1}
                  onChange={e => setTargetHydration(e.target.value)}
                  className={`w-full text-2xl font-bold p-3 pl-4 pr-16 rounded-lg border outline-none transition-colors tabular-nums placeholder:text-lg placeholder:font-normal ${
                    calc.waterWarning
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-red-300'
                      : 'border-blue-300 bg-white text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-blue-300'
                  }`}
                />
                <span
                  className={`absolute right-4 top-1/2 -translate-y-1/2 font-black text-lg ${
                    calc.waterWarning ? 'text-red-600' : 'text-blue-600'
                  }`}
                >
                  %
                </span>
              </div>

              {/* 水份即時檢核與警示通知 */}
              {calc.waterWarning ? (
                <div className="mt-2.5 p-3.5 bg-red-100/90 border-2 border-red-400 rounded-xl text-red-950 text-xs sm:text-sm flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-black text-red-800 text-sm sm:text-base flex items-center gap-1.5">
                      <span>⚠️ 材料總水量已超過「目標總水份」！</span>
                    </div>
                    <div className="leading-relaxed font-medium">
                      材料清單與酵種已提供水份{' '}
                      <strong className="underline text-red-900 font-black">
                        {Number(calc.totalProvidedWaterPercent.toFixed(1))}%
                      </strong>
                      ，超過目標水合率（{calc.targetHydrationNum}%）達{' '}
                      <strong className="text-red-900 font-black">
                        +{Number(calc.waterExcessPercent.toFixed(1))}%
                      </strong>
                      {calc.hasDoughWeight && calc.excessWaterGrams > 0 && (
                        <span>
                          {' '}
                          (超額約{' '}
                          <strong className="text-red-900 font-black">
                            {Number(calc.excessWaterGrams.toFixed(1))} 克
                          </strong>
                          )
                        </span>
                      )}
                      。
                    </div>
                    <div className="text-xs text-red-800 font-bold bg-white/60 p-2 rounded-lg border border-red-200">
                      💡 建議：請將目標水合率提高至至少 {Number(calc.totalProvidedWaterPercent.toFixed(1))}%，或調降液體材料（如牛奶、水）與酵種比例。
                    </div>
                  </div>
                </div>
              ) : calc.hasTargetHydration && calc.totalProvidedWaterPercent > 0 ? (
                <div className="mt-2 p-2.5 bg-blue-100/70 border border-blue-200 rounded-lg text-blue-900 text-xs flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                    <span>
                      材料已提供水份：<strong>{Number(calc.totalProvidedWaterPercent.toFixed(1))}%</strong> / 目標：<strong>{calc.targetHydrationNum}%</strong>
                    </span>
                  </div>
                  <div className="font-bold text-blue-800 tabular-nums">
                    主麵團尚需純加水：{Number(calc.remainingWaterPercent.toFixed(1))}%
                    {calc.hasDoughWeight && calc.remainingWaterGrams > 0 && (
                      <span className="font-normal text-blue-700 ml-1">
                        ({Number(calc.remainingWaterGrams.toFixed(1))}g)
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* 麵粉配比設定：支援混合兩種或多種麵粉 (總麵粉合計 = 100%) */}
              <div className="space-y-3 mt-6 border-t border-amber-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      🌾 麵粉配比設定（支援混合兩種或多種麵粉，總麵粉合計 = 100%）
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      若只用單一麵粉可不填下方混合比例；若需混粉（如高筋 80% + 全麥 20%），只需輸入副粉比例，主力麵粉會自動扣除。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBlendedFlour}
                    className="text-xs bg-amber-700 hover:bg-amber-800 text-white font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增混合麵粉</span>
                  </button>
                </div>

                {/* 第 1 種：主力麵粉 (自動計算剩餘比例) */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3.5 rounded-lg border border-amber-300 shadow-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-1 rounded shrink-0">
                      主力麵粉
                    </span>
                    <input
                      type="text"
                      value={mainFlourName}
                      onChange={e => setMainFlourName(e.target.value)}
                      placeholder="例如：高筋麵粉"
                      className="w-full sm:w-44 p-1.5 border border-gray-300 rounded text-sm font-bold text-gray-800 focus:ring-1 focus:ring-amber-500 outline-none bg-amber-50/30"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 tabular-nums">
                    <div className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200 font-bold">
                      主麵團比例：
                      <span className="text-sm font-black text-amber-950 ml-0.5">
                        {Number(calc.mainDoughFlourPercent.toFixed(1))}%
                      </span>
                      {(calc.tzPct > 0 || calc.sdPct > 0) && (
                        <span className="text-[11px] text-amber-700 font-normal ml-1">
                          (已扣種麵 {Number((calc.tzPct + calc.sdPct).toFixed(1))}%)
                        </span>
                      )}
                    </div>
                    <div className="text-right min-w-[76px]">
                      <span className="font-black text-amber-900 text-base">
                        {calc.totalFlourWeight > 0
                          ? Number(Math.max(0, calc.mainDoughFlourWeight).toFixed(1))
                          : '—'}
                      </span>
                      <span className="text-xs text-gray-500 ml-0.5">g</span>
                    </div>
                  </div>
                </div>

                {/* 第 2 種 (或更多) 混合副粉列表 */}
                {calc.computedBlendedFlours.map((bf, idx) => (
                  <div
                    key={bf.id}
                    className="flex flex-col gap-2.5 bg-white p-3.5 rounded-lg border border-amber-200/90"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold bg-orange-100 text-orange-900 px-2 py-1 rounded shrink-0">
                          混合粉 {idx + 2}
                        </span>
                        <input
                          type="text"
                          value={bf.name}
                          onChange={e => handleUpdateBlendedFlour(bf.id, 'name', e.target.value)}
                          placeholder="例如：全麥麵粉、低筋麵粉、裸麥粉..."
                          className="w-full sm:w-44 p-1.5 border border-gray-300 rounded text-sm font-bold text-gray-800 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-600 font-medium">佔總麵粉</span>
                          <input
                            type="number"
                            value={bf.percentage}
                            placeholder="0"
                            min={0}
                            max={100}
                            step={1}
                            onChange={e =>
                              handleUpdateBlendedFlour(bf.id, 'percentage', e.target.value)
                            }
                            className="w-16 p-1.5 border border-gray-300 rounded text-center focus:ring-1 focus:ring-amber-500 outline-none font-bold tabular-nums placeholder:text-gray-300"
                          />
                          <span className="text-xs text-gray-600 whitespace-nowrap">%</span>
                        </div>

                        <div className="text-right min-w-[76px] tabular-nums">
                          <span className="font-black text-amber-800 text-base">
                            {bf.weight > 0 ? Number(bf.weight.toFixed(1)) : '—'}
                          </span>
                          <span className="text-xs text-gray-500 ml-0.5">g</span>
                        </div>

                        {bf.deletable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBlendedFlour(bf.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                            title="刪除此混合麵粉"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 常見副粉名稱快速帶入按鈕 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">快速選取名稱：</span>
                      {['全麥麵粉', '低筋麵粉', '中筋麵粉', '裸麥粉', '法國麵包粉'].map(presetName => (
                        <button
                          key={presetName}
                          type="button"
                          onClick={() => handleUpdateBlendedFlour(bf.id, 'name', presetName)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            bf.name === presetName
                              ? 'bg-amber-700 text-white border-amber-700 font-bold'
                              : 'bg-gray-50 hover:bg-amber-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {presetName}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {calc.flourWarning && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      ⚠️ 混合麵粉（{Number(calc.blendedFlourTotalPercent.toFixed(1))}%）與種麵提撥（
                      {Number((calc.tzPct + calc.sdPct).toFixed(1))}%）總和已超過 100%（超額 +
                      {Number(calc.flourExcessPercent.toFixed(1))}%），請調降比例！
                    </span>
                  </div>
                )}
              </div>

              {/* 進階：湯種 / 多種天然酵母 (自製酵母) - 預設留白 */}
              <div className="space-y-3 mt-6 border-t border-amber-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      進階：提撥總麵粉製作湯種 / 天然酵母 (支援兩種以上天然酵母，選填)
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      若有使用請輸入提撥比例，系統會自動從主力麵粉與總水量中扣除，計算主麵團用量。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSourdough}
                    className="text-xs bg-orange-700 hover:bg-orange-800 text-white font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增天然酵母</span>
                  </button>
                </div>

                {/* 湯種 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3.5 rounded-lg border border-amber-200/80">
                  <div className="w-24 font-bold text-amber-900 text-sm shrink-0">湯種</div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tzPercent}
                        placeholder="0"
                        min={0}
                        max={100}
                        step={1}
                        onChange={e => setTzPercent(e.target.value)}
                        className="w-16 p-1.5 border border-gray-300 rounded text-center focus:ring-1 focus:ring-amber-500 outline-none font-bold tabular-nums placeholder:text-gray-300"
                      />
                      <span className="text-xs text-gray-600 whitespace-nowrap">% 麵粉</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={tzRatio}
                        onChange={e => setTzRatio(parseInt(e.target.value, 10) || 5)}
                        className="p-1.5 border border-gray-300 rounded text-xs text-gray-700 bg-white focus:ring-1 focus:ring-amber-500 outline-none font-medium"
                      >
                        <option value={5}>粉水比 1:5</option>
                        <option value={1}>粉水比 1:1</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 bg-amber-50/60 px-3 py-2 rounded border border-amber-100 flex-1 text-center sm:text-right tabular-nums">
                    需預備: 粉{' '}
                    <span className="font-bold text-gray-800">
                      {calc.tzFlourWeight > 0 ? Number(calc.tzFlourWeight.toFixed(1)) : '—'}
                    </span>
                    g / 水{' '}
                    <span className="font-bold text-blue-700">
                      {calc.tzWaterWeight > 0 ? Number(calc.tzWaterWeight.toFixed(1)) : '—'}
                    </span>
                    g
                  </div>
                </div>

                {/* 多種自製酵母 / 天然酵母列表 */}
                {calc.computedSourdoughs.map((sd, idx) => (
                  <div
                    key={sd.id}
                    className="flex flex-col gap-2.5 bg-white p-3.5 rounded-lg border border-amber-200/80"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0 sm:w-48 shrink-0">
                        <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-1 rounded shrink-0">
                          酵母 {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={sd.name}
                          onChange={e => handleUpdateSourdough(sd.id, 'name', e.target.value)}
                          placeholder="例如：魯邦種、水果元種..."
                          className="w-full p-1.5 border border-gray-300 rounded text-sm font-bold text-gray-800 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={sd.percentage}
                            placeholder="0"
                            min={0}
                            max={100}
                            step={1}
                            onChange={e =>
                              handleUpdateSourdough(sd.id, 'percentage', e.target.value)
                            }
                            className="w-16 p-1.5 border border-gray-300 rounded text-center focus:ring-1 focus:ring-amber-500 outline-none font-bold tabular-nums placeholder:text-gray-300"
                          />
                          <span className="text-xs text-gray-600 whitespace-nowrap">% 麵粉</span>
                        </div>
                        <select
                          value={sd.waterRatio}
                          onChange={e =>
                            handleUpdateSourdough(
                              sd.id,
                              'waterRatio',
                              parseFloat(e.target.value) || 1
                            )
                          }
                          className="p-1.5 border border-gray-300 rounded text-xs text-gray-700 bg-white focus:ring-1 focus:ring-amber-500 outline-none font-medium"
                        >
                          <option value={1}>粉水比 1:1 (100%水)</option>
                          <option value={0.5}>粉水比 1:0.5 (硬種 50%水)</option>
                          <option value={0.6}>粉水比 1:0.6 (元種 60%水)</option>
                          <option value={0.8}>粉水比 1:0.8 (80%水)</option>
                          <option value={2}>粉水比 1:2 (液種 200%水)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 flex-1">
                        <div className="text-xs text-gray-600 bg-amber-50/60 px-3 py-2 rounded border border-amber-100 flex-1 text-center sm:text-right tabular-nums">
                          需預備: 粉{' '}
                          <span className="font-bold text-gray-800">
                            {sd.flourWeight > 0 ? Number(sd.flourWeight.toFixed(1)) : '—'}
                          </span>
                          g / 水{' '}
                          <span className="font-bold text-blue-700">
                            {sd.waterWeight > 0 ? Number(sd.waterWeight.toFixed(1)) : '—'}
                          </span>
                          g
                        </div>

                        {sd.deletable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSourdough(sd.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                            title="刪除此天然酵母"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 常見天然酵母名稱快速帶入按鈕 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">快速選取名稱：</span>
                      {[
                        '自製酵母 (天然酵母)',
                        '魯邦種 (Levain)',
                        '水果酵母元種',
                        '波蘭種 (Poolish)',
                        '全麥天然酵種',
                        '老麵'
                      ].map(presetName => (
                        <button
                          key={presetName}
                          type="button"
                          onClick={() => handleUpdateSourdough(sd.id, 'name', presetName)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            sd.name === presetName
                              ? 'bg-orange-700 text-white border-orange-700 font-bold'
                              : 'bg-gray-50 hover:bg-orange-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {presetName}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. 烤箱溫度與烘烤設定 (包含上下火) - 預設留白 */}
            <section
              id="oven-section"
              className="bg-orange-50/85 rounded-xl p-5 border border-orange-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-orange-200 pb-3.5">
                <div>
                  <h2 className="text-xl font-bold text-orange-950 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-600 shrink-0" />
                    <span>3. 烤箱溫度與烘烤設定 (包含上下火)</span>
                  </h2>
                  <p className="text-xs text-orange-800 mt-1">
                    可分別設定上火與下火溫度、烘烤時間、二段掉頭降溫與烤盤層架位置
                  </p>
                </div>

                {/* 獨立上下火 / 單一溫度 切換 */}
                <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-orange-200 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => updateOven('mode', 'dual')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      oven.mode === 'dual'
                        ? 'bg-orange-600 text-white'
                        : 'text-orange-900 hover:bg-orange-50'
                    }`}
                  >
                    獨立上下火
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOven('mode', 'single')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      oven.mode === 'single'
                        ? 'bg-orange-600 text-white'
                        : 'text-orange-900 hover:bg-orange-50'
                    }`}
                  >
                    單一溫度 (上下同溫)
                  </button>
                </div>
              </div>

              {/* 常見烘焙品項快速預設 */}
              <div className="mb-5">
                <div className="text-xs font-bold text-orange-900 mb-2 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-orange-700 shrink-0" />
                  <span>常見品項快速帶入上下火烤溫：</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OVEN_PRESETS.map(preset => {
                    const isActive =
                      oven.topTemp === preset.topTemp &&
                      oven.bottomTemp === preset.bottomTemp &&
                      oven.bakeTime === preset.bakeTime;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyOvenPreset(preset)}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-orange-600 text-white border-orange-700'
                            : 'bg-white hover:bg-orange-100/70 text-gray-800 border-orange-200'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{preset.label}</div>
                        <div
                          className={`text-[11px] tabular-nums mt-0.5 truncate ${
                            isActive ? 'text-orange-100' : 'text-orange-800'
                          }`}
                        >
                          {preset.category}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 第一階段：上火 / 下火 / 烘烤時間 - 預設留白 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
                {/* 上火溫度 */}
                <div className="bg-white p-3.5 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ovenTopTemp" className="text-xs font-bold text-red-700">
                      {oven.mode === 'dual' ? '上火溫度 (Top)' : '烤箱溫度 (全火)'}
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">°C</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.topTemp) || 180;
                        updateOven('topTemp', Math.max(0, cur - 5));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="減少 5°C"
                    >
                      -5
                    </button>
                    <div className="relative flex-1">
                      <input
                        id="ovenTopTemp"
                        type="number"
                        value={oven.topTemp}
                        placeholder="例如：190"
                        min={0}
                        max={350}
                        step={5}
                        onChange={e => updateOven('topTemp', e.target.value)}
                        className="w-full text-2xl font-black text-red-700 p-1.5 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 outline-none text-center bg-orange-50/30 tabular-nums placeholder:text-gray-300 placeholder:text-base placeholder:font-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.topTemp) || 180;
                        updateOven('topTemp', Math.min(350, cur + 5));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="增加 5°C"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* 下火溫度 */}
                <div
                  className={`bg-white p-3.5 rounded-xl border border-orange-200 transition-opacity ${
                    oven.mode === 'single' ? 'opacity-55 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ovenBottomTemp" className="text-xs font-bold text-amber-800">
                      下火溫度 (Bottom)
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">°C</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.bottomTemp) || 180;
                        updateOven('bottomTemp', Math.max(0, cur - 5));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="減少 5°C"
                    >
                      -5
                    </button>
                    <div className="relative flex-1">
                      <input
                        id="ovenBottomTemp"
                        type="number"
                        value={oven.bottomTemp}
                        placeholder="例如：180"
                        min={0}
                        max={350}
                        step={5}
                        onChange={e => updateOven('bottomTemp', e.target.value)}
                        className="w-full text-2xl font-black text-amber-800 p-1.5 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 outline-none text-center bg-orange-50/30 tabular-nums placeholder:text-gray-300 placeholder:text-base placeholder:font-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.bottomTemp) || 180;
                        updateOven('bottomTemp', Math.min(350, cur + 5));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="增加 5°C"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* 烘烤時間 */}
                <div className="bg-white p-3.5 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="ovenBakeTime"
                      className="text-xs font-bold text-gray-700 flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5 text-orange-600" />
                      <span>{oven.enableStage2 ? '前段時間' : '烘烤時間'}</span>
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">分鐘</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.bakeTime) || 15;
                        updateOven('bakeTime', Math.max(1, cur - 1));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="減少 1 分鐘"
                    >
                      -1
                    </button>
                    <div className="relative flex-1">
                      <input
                        id="ovenBakeTime"
                        type="number"
                        value={oven.bakeTime}
                        placeholder="例如：20"
                        min={1}
                        max={240}
                        step={1}
                        onChange={e => updateOven('bakeTime', e.target.value)}
                        className="w-full text-2xl font-black text-gray-800 p-1.5 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 outline-none text-center bg-orange-50/30 tabular-nums placeholder:text-gray-300 placeholder:text-base placeholder:font-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseNum(oven.bakeTime) || 15;
                        updateOven('bakeTime', Math.min(240, cur + 1));
                      }}
                      className="w-8 h-10 rounded-lg border border-gray-200 hover:bg-orange-50 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer"
                      title="增加 1 分鐘"
                    >
                      +1
                    </button>
                  </div>
                </div>
              </div>

              {/* 二段烤溫 / 中途掉頭設定開關 */}
              <div className="mb-4 bg-white/80 rounded-xl p-3.5 border border-orange-200/80">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={oven.enableStage2}
                      onChange={e => updateOven('enableStage2', e.target.checked)}
                      className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                    />
                    <span className="text-sm font-bold text-orange-950">
                      啟用「二段烤溫 / 掉頭調溫」設定 (選填)
                    </span>
                  </div>
                  <span className="text-xs text-orange-700">
                    適合中途掉頭後降上火或排氣續烤
                  </span>
                </label>

                {oven.enableStage2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-orange-100">
                    <div>
                      <label className="block text-xs font-bold text-red-700 mb-1">
                        第二階段 上火 (°C)
                      </label>
                      <input
                        type="number"
                        value={oven.stage2TopTemp}
                        placeholder="例如：175"
                        min={0}
                        max={350}
                        step={5}
                        onChange={e => updateOven('stage2TopTemp', e.target.value)}
                        className="w-full text-lg font-bold text-red-700 p-2 rounded-lg border border-orange-200 text-center bg-white tabular-nums outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-300 placeholder:font-normal"
                      />
                    </div>
                    <div className={oven.mode === 'single' ? 'opacity-55 pointer-events-none' : ''}>
                      <label className="block text-xs font-bold text-amber-800 mb-1">
                        第二階段 下火 (°C)
                      </label>
                      <input
                        type="number"
                        value={oven.stage2BottomTemp}
                        placeholder="例如：170"
                        min={0}
                        max={350}
                        step={5}
                        onChange={e => updateOven('stage2BottomTemp', e.target.value)}
                        className="w-full text-lg font-bold text-amber-800 p-2 rounded-lg border border-orange-200 text-center bg-white tabular-nums outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-300 placeholder:font-normal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        第二階段 時間 (分鐘)
                      </label>
                      <input
                        type="number"
                        value={oven.stage2BakeTime}
                        placeholder="例如：8"
                        min={1}
                        max={240}
                        step={1}
                        onChange={e => updateOven('stage2BakeTime', e.target.value)}
                        className="w-full text-lg font-bold text-gray-800 p-2 rounded-lg border border-orange-200 text-center bg-white tabular-nums outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-300 placeholder:font-normal"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 烤盤層架、蒸汽/旋風模式與備註 */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="ovenRackPosition"
                    className="block text-xs font-bold text-orange-900 mb-1 flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5 text-orange-700" />
                    <span>烤盤層架位置</span>
                  </label>
                  <select
                    id="ovenRackPosition"
                    value={oven.rackPosition}
                    onChange={e => updateOven('rackPosition', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-orange-200 bg-white text-sm font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="中層">中層 (標準受熱)</option>
                    <option value="中下層">中下層 (歐包/吐司)</option>
                    <option value="下層">下層 (山形/高模吐司)</option>
                    <option value="上層">上層 (表面加強上色)</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="ovenAssistMode"
                    className="block text-xs font-bold text-orange-900 mb-1 flex items-center gap-1"
                  >
                    <Wind className="w-3.5 h-3.5 text-orange-700" />
                    <span>蒸汽 / 旋風設定</span>
                  </label>
                  <select
                    id="ovenAssistMode"
                    value={oven.assistMode}
                    onChange={e => updateOven('assistMode', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-orange-200 bg-white text-sm font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="標準無蒸汽">標準無蒸汽</option>
                    <option value="入爐蒸汽">入爐噴蒸汽 (歐包/法棍)</option>
                    <option value="旋風對流">旋風對流開啟</option>
                    <option value="水浴法烘烤">水浴法烘烤 (蛋糕/布丁)</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="ovenNotes"
                    className="block text-xs font-bold text-orange-900 mb-1"
                  >
                    烘烤備註 (選填)
                  </label>
                  <input
                    id="ovenNotes"
                    type="text"
                    value={oven.notes}
                    onChange={e => updateOven('notes', e.target.value)}
                    placeholder="如：12分掉頭、蓋鋁箔紙..."
                    className="w-full p-2.5 rounded-lg border border-orange-200 bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            </section>

            {/* 4. 液體材料清單 - 預設無預設數字，保持空白 */}
            <section
              id="liquids-section"
              className={`rounded-xl p-5 border transition-colors ${
                calc.waterWarning ? 'bg-red-50/70 border-red-300' : 'bg-blue-50/80 border-blue-200'
              }`}
            >
              <div className="flex justify-between items-end mb-4 border-b pb-3 border-blue-200/80">
                <div>
                  <h2
                    className={`text-xl font-bold flex items-center gap-2 ${
                      calc.waterWarning ? 'text-red-900' : 'text-blue-900'
                    }`}
                  >
                    <span>💧 液體材料清單</span>
                    {calc.waterWarning && (
                      <span className="text-xs bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        含水量已超標
                      </span>
                    )}
                  </h2>
                  <p className={`text-xs mt-1 ${calc.waterWarning ? 'text-red-700' : 'text-blue-700'}`}>
                    含水量會自動從主麵團的「純加水量」中扣除；若總含水超過目標水合率將觸發警示
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLiquid}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>新增液體</span>
                </button>
              </div>

              {/* 液體清單水量超標警示 */}
              {calc.waterWarning && (
                <div className="mb-4 bg-red-100 border-2 border-red-400 text-red-950 p-3.5 rounded-xl flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <div className="font-black text-red-800 text-sm sm:text-base">
                      ⚠️ 材料總水量已超過「目標總水份」！
                    </div>
                    <div className="mt-1 font-medium leading-relaxed">
                      清單液體折水（{Number(calc.liquidProvidedWaterPercent.toFixed(1))}%）加上酵種含水（{Number(calc.prefWaterPercent.toFixed(1))}%），合計已提供{' '}
                      <span className="font-black underline text-red-900">
                        {Number(calc.totalProvidedWaterPercent.toFixed(1))}%
                      </span>{' '}
                      水份，超過目標水合率（{calc.targetHydrationNum}%）達{' '}
                      <span className="font-black text-red-900">
                        +{Number(calc.waterExcessPercent.toFixed(1))}%
                      </span>
                      {calc.hasDoughWeight && calc.excessWaterGrams > 0 && (
                        <span>
                          {' '}
                          (超額約{' '}
                          <span className="font-black text-red-900">
                            {Number(calc.excessWaterGrams.toFixed(1))} 克
                          </span>
                          )
                        </span>
                      )}
                      。請減少液體材料比例，或至步驟 2 調高「目標總水份」！
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 mt-3">
                {calc.computedLiquids.map(liq => (
                  <div
                    key={liq.id}
                    className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors"
                  >
                    <div className="w-full">
                      <input
                        type="text"
                        value={liq.name}
                        onChange={e => handleUpdateLiquid(liq.id, 'name', e.target.value)}
                        className="w-full p-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base font-medium bg-blue-50/30"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                          <span className="px-3 py-2 text-gray-600 bg-gray-50 border-r border-gray-200 text-xs font-bold whitespace-nowrap">
                            比例
                          </span>
                          <input
                            type="number"
                            value={liq.percentage}
                            placeholder="0"
                            min={0}
                            step={0.5}
                            onChange={e => handleUpdateLiquid(liq.id, 'percentage', e.target.value)}
                            className="w-16 text-center p-2 outline-none font-bold text-gray-800 text-base tabular-nums placeholder:text-gray-300"
                          />
                          <span className="px-2 text-gray-400 bg-gray-50 border-l border-gray-200 text-xs">
                            %
                          </span>
                        </div>

                        <div className="flex items-center border border-blue-300 rounded-lg overflow-hidden bg-blue-50/50">
                          <span className="px-3 py-2 text-blue-700 bg-blue-100/60 border-r border-blue-200 text-xs font-bold whitespace-nowrap">
                            含水
                          </span>
                          <input
                            type="number"
                            value={liq.waterContent}
                            placeholder="100"
                            min={0}
                            max={100}
                            step={1}
                            onChange={e => handleUpdateLiquid(liq.id, 'waterContent', e.target.value)}
                            className="w-16 text-center p-2 outline-none font-bold text-blue-800 text-base bg-transparent tabular-nums placeholder:text-blue-300"
                          />
                          <span className="px-2 text-blue-500 border-l border-blue-200 text-xs">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0 ml-auto">
                        <div className="text-right tabular-nums">
                          <div className="font-black text-gray-800 text-lg leading-tight">
                            {liq.weight > 0 ? Number(liq.weight.toFixed(1)) : '—'}{' '}
                            <span className="text-sm text-gray-500 font-normal">g</span>
                          </div>
                          <div className="text-xs text-blue-600 font-medium mt-0.5">
                            {liq.waterWeight > 0
                              ? `折水 ${Number(liq.waterWeight.toFixed(1))}g (${Number((liq.waterPercent ?? 0).toFixed(1))}%)`
                              : parseNum(liq.percentage) > 0
                                ? `折水 ${Number((liq.waterPercent ?? 0).toFixed(1))}%`
                                : '折水 —'}
                          </div>
                        </div>
                        {liq.deletable ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteLiquid(liq.id)}
                            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                            title="移除液體"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="w-9 h-9 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 液體區塊底部即時水量總計與超標提示 */}
              {calc.totalProvidedWaterPercent > 0 && (
                <div
                  className={`mt-4 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm ${
                    calc.waterWarning
                      ? 'bg-red-100 border-2 border-red-400 text-red-900 font-bold'
                      : 'bg-white/90 border-blue-200 text-blue-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {calc.waterWarning ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span>
                      目前材料折算總水份：
                      <strong className="font-black underline mx-1">
                        {Number(calc.totalProvidedWaterPercent.toFixed(1))}%
                      </strong>
                      （液體 {Number(calc.liquidProvidedWaterPercent.toFixed(1))}% + 酵種{' '}
                      {Number(calc.prefWaterPercent.toFixed(1))}%）
                    </span>
                  </div>
                  <div className="tabular-nums font-black">
                    {calc.waterWarning ? (
                      <span className="text-red-700">
                        ⚠️ 已超過目標水份（{calc.targetHydrationNum}%）達 +{Number(calc.waterExcessPercent.toFixed(1))}%！
                      </span>
                    ) : (
                      <span className="text-blue-800">
                        目標總水份：{calc.targetHydrationNum}%（尚需純水 {Number(calc.remainingWaterPercent.toFixed(1))}%）
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 5. 粉狀與乾性材料清單 - 預設無預設數字，保持空白 */}
            <section
              id="dry-section"
              className="bg-white rounded-xl p-5 border border-gray-200"
            >
              <div className="flex justify-between items-end mb-4 border-b border-gray-200 pb-3">
                <h2 className="text-xl font-bold text-gray-800">粉狀與其他乾性材料</h2>
                <button
                  type="button"
                  onClick={handleAddDry}
                  className="text-sm bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>新增材料</span>
                </button>
              </div>

              <div className="space-y-3 mt-3">
                {calc.computedDry.map(ing => (
                  <div
                    key={ing.id}
                    className="flex flex-col gap-3 bg-gray-50/70 p-4 rounded-xl border border-gray-200 hover:border-amber-300 transition-colors"
                  >
                    <div className="w-full">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={e => handleUpdateDry(ing.id, 'name', e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-base font-medium bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                        <span className="px-3 py-2 text-gray-600 bg-gray-100 border-r border-gray-200 text-xs font-bold whitespace-nowrap">
                          比例
                        </span>
                        <input
                          type="number"
                          value={ing.percentage}
                          placeholder="0"
                          min={0}
                          step={0.1}
                          onChange={e => handleUpdateDry(ing.id, 'percentage', e.target.value)}
                          className="w-20 text-center p-2 outline-none font-bold text-gray-800 text-base tabular-nums placeholder:text-gray-300"
                        />
                        <span className="px-2.5 text-gray-400 bg-gray-100 border-l border-gray-200 text-xs">
                          %
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0 ml-auto">
                        <div className="text-right pr-1 tabular-nums">
                          <span className="font-black text-gray-800 text-xl">
                            {ing.weight > 0 ? Number(ing.weight.toFixed(1)) : '—'}
                          </span>
                          <span className="text-gray-500 text-sm ml-1 font-normal">g</span>
                        </div>
                        {ing.deletable ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteDry(ing.id)}
                            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                            title="移除材料"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="w-9 h-9 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 右側總結區 (5 欄, Sticky) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl p-6 border border-amber-200/90 shadow-sm flex flex-col">
              <div className="flex items-center justify-between border-b-2 border-amber-200 pb-3 mb-4">
                <h2 className="text-xl font-black text-gray-800">
                  📋 主麵團實際投料清單
                </h2>
                {recipeName.trim() && (
                  <span className="text-xs font-bold text-amber-800 truncate max-w-[160px]">
                    {recipeName.trim()}
                  </span>
                )}
              </div>

              {/* 總麵粉與水合率摘要 */}
              <div className="space-y-2.5 mb-4 bg-amber-50/70 p-4 rounded-xl border border-amber-200/80">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">還原總麵粉量 (100%)</span>
                  <span className="font-black text-amber-900 text-lg tabular-nums">
                    {calc.totalFlourWeight > 0 ? `${Number(calc.totalFlourWeight.toFixed(1))} g` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 border-t border-amber-200/60 pt-2">
                  <span>目標總水合率：{targetHydration !== '' ? `${targetHydration}%` : '未填寫'}</span>
                  <span className="tabular-nums">
                    總水量：{calc.totalWaterWeight > 0 ? `${Number(calc.totalWaterWeight.toFixed(1))} g` : '—'}
                  </span>
                </div>
              </div>

              {/* 🔥 烤箱上下火與時間摘要卡 */}
              <div className="mb-4 bg-orange-50/90 p-4 rounded-xl border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-900 flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-600" />
                    <span>烤箱溫度設定 ({oven.mode === 'dual' ? '獨立上下火' : '單一溫度'})</span>
                  </span>
                  <span className="text-xs font-medium text-orange-800">
                    {oven.rackPosition} · {oven.assistMode}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-orange-100 text-center tabular-nums">
                  <div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {oven.mode === 'dual' ? '上火 (Top)' : '全火溫度'}
                    </div>
                    <div className="text-lg font-black text-red-700">
                      {oven.topTemp !== '' ? `${oven.topTemp}°C` : '—'}
                    </div>
                  </div>
                  <div className="border-x border-orange-100">
                    <div className="text-[11px] text-gray-500 font-medium">下火 (Bottom)</div>
                    <div className="text-lg font-black text-amber-800">
                      {oven.mode === 'dual'
                        ? (oven.bottomTemp !== '' ? `${oven.bottomTemp}°C` : '—')
                        : (oven.topTemp !== '' ? `${oven.topTemp}°C` : '—')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {oven.enableStage2 ? '前段時間' : '烘烤時間'}
                    </div>
                    <div className="text-lg font-black text-gray-800">
                      {oven.bakeTime !== '' ? `${oven.bakeTime} 分` : '—'}
                    </div>
                  </div>
                </div>

                {oven.enableStage2 && (
                  <div className="mt-2 pt-2 border-t border-orange-200/70 flex items-center justify-between text-xs text-orange-950 tabular-nums">
                    <span className="font-bold">二段調溫 / 掉頭後：</span>
                    <span className="font-black">
                      上火 {oven.stage2TopTemp !== '' ? `${oven.stage2TopTemp}°C` : '—'} / 下火{' '}
                      {oven.mode === 'dual'
                        ? (oven.stage2BottomTemp !== '' ? `${oven.stage2BottomTemp}°C` : '—')
                        : (oven.stage2TopTemp !== '' ? `${oven.stage2TopTemp}°C` : '—')} ·{' '}
                      {oven.stage2BakeTime !== '' ? `${oven.stage2BakeTime} 分鐘` : '—'}
                    </span>
                  </div>
                )}

                {oven.notes.trim() && (
                  <div className="mt-2 text-xs text-orange-800 bg-orange-100/60 px-2.5 py-1.5 rounded-md">
                    備註：{oven.notes.trim()}
                  </div>
                )}
              </div>

              {/* 警告訊息 */}
              {calc.waterWarning && (
                <div className="mb-4 bg-red-50 border-2 border-red-400 p-3.5 rounded-xl flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-950 space-y-1">
                    <div className="font-black text-sm text-red-800">
                      ⚠️ 材料總水量已超過「目標總水份」！
                    </div>
                    <div className="leading-relaxed font-medium">
                      材料清單與酵種已提供{' '}
                      <span className="font-black underline text-red-900">
                        {Number(calc.totalProvidedWaterPercent.toFixed(1))}%
                      </span>{' '}
                      水份，超過目標水合率（{calc.targetHydrationNum}%）達{' '}
                      <span className="font-black text-red-900">
                        +{Number(calc.waterExcessPercent.toFixed(1))}%
                      </span>
                      {calc.hasDoughWeight && calc.excessWaterGrams > 0 && (
                        <span>
                          {' '}
                          (超額約{' '}
                          <span className="font-black text-red-900">
                            {Number(calc.excessWaterGrams.toFixed(1))} 克
                          </span>
                          )
                        </span>
                      )}
                      。
                    </div>
                    <div className="text-[11px] text-red-800 font-bold bg-white/70 p-2 rounded-lg border border-red-200">
                      主麵團純加水量已被扣除至 0g，麵團整體水份過多。請提高水合率或減少液體比例！
                    </div>
                  </div>
                </div>
              )}

              {calc.flourWarning && (
                <div className="mb-4 text-red-700 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>
                    混合麵粉與湯種/自製酵母提撥的麵粉比例總和已超過 100%（超額 +
                    {Number(calc.flourExcessPercent.toFixed(1))}%），請調降比例！
                  </span>
                </div>
              )}

              {/* 實際投料列表 */}
              <div className="bg-gray-50/70 rounded-xl border border-gray-200 p-4 flex-1">
                {calc.mainRecipeItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {calc.hasDoughWeight
                      ? '請輸入各材料的烘焙百分比'
                      : '請在左側輸入「目標麵團總重量」與「水合率」'}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200/70 text-base">
                    {calc.mainRecipeItems.map((item, idx) => (
                      <li
                        key={`${item.name}-${idx}`}
                        className="flex justify-between items-center gap-3 py-2.5 px-1"
                      >
                        <span
                          className={`text-gray-700 leading-snug ${
                            item.isMain || item.isPref ? 'font-bold' : 'font-medium'
                          }`}
                        >
                          {item.name}
                        </span>
                        <span
                          className={`font-black text-lg whitespace-nowrap shrink-0 tabular-nums ${item.colorClass}`}
                        >
                          {Number(item.weight.toFixed(1))}{' '}
                          <span className="text-sm font-normal text-gray-400">g</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 加總重量檢核 */}
              <div className="mt-4 flex justify-between items-center text-sm px-2 tabular-nums">
                <span className="text-gray-700 font-bold">加總重量檢核</span>
                <span className="font-black text-emerald-800 text-lg">
                  {calc.totalWeight > 0 ? `${Number(calc.totalWeight.toFixed(1))} g` : '—'}
                </span>
              </div>

              {/* 份量分割計算 */}
              <div className="mt-5 pt-4 border-t border-gray-200 border-dashed">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="divideCount"
                      className="text-sm font-bold text-gray-700 whitespace-nowrap"
                    >
                      麵團分割成：
                    </label>
                    <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 w-24">
                      <input
                        id="divideCount"
                        type="number"
                        value={divideCount}
                        placeholder="1"
                        min={1}
                        step={1}
                        onChange={e => setDivideCount(e.target.value)}
                        className="w-full p-2 text-center text-base font-bold outline-none tabular-nums placeholder:text-gray-300 placeholder:font-normal"
                      />
                      <span className="px-2 text-xs text-gray-500 bg-gray-50 border-l border-gray-200">
                        份
                      </span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap tabular-nums">
                    <span className="text-sm text-gray-500">每份約</span>
                    <span className="text-xl font-black text-amber-700 ml-1.5">
                      {calc.perPortion > 0 ? `${Number(calc.perPortion.toFixed(1))} g` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 匯出精美配方卡按鈕 */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  disabled={isExportingImage || !calc.hasDoughWeight}
                  onClick={handleExportCardImage}
                  className="bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-md w-full flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5 shrink-0" />
                  <span>
                    {isExportingImage
                      ? '生成配方卡圖片中...'
                      : '匯出精美配方卡 (含上下火烤溫圖片)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 隱藏的配方卡渲染容器 (供 html2canvas 擷取高解析度圖片) */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <div
          ref={captureCardRef}
          style={{
            width: '620px',
            padding: '36px',
            backgroundColor: '#fdfbf7',
            fontFamily: "'Noto Sans TC', sans-serif",
            position: 'relative',
            color: '#1f2937'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '16px',
              bottom: '16px',
              left: '16px',
              right: '16px',
              border: '3px solid #b45309',
              borderRadius: '16px',
              pointerEvents: 'none'
            }}
          />

          <div style={{ position: 'relative', zIndex: 10, padding: '22px' }}>
            {/* 標題 */}
            <div style={{ textAlign: 'center', marginBottom: '26px' }}>
              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#92400e',
                  marginBottom: '6px',
                  lineHeight: 1.3
                }}
              >
                🍞 {recipeName.trim() || '專屬烘焙配方'}
              </div>
              <div style={{ fontSize: '17px', color: '#6b7280', fontWeight: 700 }}>
                烘焙百分比與上下火烤溫配方卡
              </div>
            </div>

            {/* 三大指標 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#fffbeb',
                padding: '18px 20px',
                borderRadius: '14px',
                marginBottom: '18px',
                border: '1.5px solid #fde68a'
              }}
            >
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#92400e',
                    marginBottom: '6px'
                  }}
                >
                  總麵粉量 (100%)
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#78350f' }}>
                  {calc.totalFlourWeight > 0 ? `${Number(calc.totalFlourWeight.toFixed(1))}g` : '—'}
                </div>
              </div>
              <div style={{ width: '1.5px', backgroundColor: '#fcd34d' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#92400e',
                    marginBottom: '6px'
                  }}
                >
                  目標水合率
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#1e3a8a' }}>
                  {targetHydration !== '' ? `${targetHydration}%` : '—'}
                </div>
              </div>
              <div style={{ width: '1.5px', backgroundColor: '#fcd34d' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#92400e',
                    marginBottom: '6px'
                  }}
                >
                  麵團總重量
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#065f46' }}>
                  {calc.totalWeight > 0 ? `${Number(calc.totalWeight.toFixed(1))}g` : '—'}
                </div>
              </div>
            </div>

            {/* 烤箱上下火設定區塊 */}
            <div
              style={{
                backgroundColor: '#fff7ed',
                border: '1.5px solid #fed7aa',
                borderRadius: '14px',
                padding: '18px 20px',
                marginBottom: '26px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#9a3412' }}>
                  🔥 烤箱溫度設定 ({oven.mode === 'dual' ? '獨立上下火' : '單一溫度'})
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#c2410c' }}>
                  {oven.rackPosition} · {oven.assistMode}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  border: '1.5px solid #ffedd5'
                }}
              >
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}
                  >
                    上火 (Top)
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#b91c1c' }}>
                    {oven.topTemp !== '' ? `${oven.topTemp}°C` : '—'}
                  </div>
                </div>
                <div style={{ width: '1.5px', backgroundColor: '#fed7aa' }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}
                  >
                    下火 (Bottom)
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#92400e' }}>
                    {oven.mode === 'dual'
                      ? oven.bottomTemp !== ''
                        ? `${oven.bottomTemp}°C`
                        : '—'
                      : oven.topTemp !== ''
                        ? `${oven.topTemp}°C`
                        : '—'}
                  </div>
                </div>
                <div style={{ width: '1.5px', backgroundColor: '#fed7aa' }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}
                  >
                    {oven.enableStage2 ? '前段時間' : '烘烤時間'}
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#1f2937' }}>
                    {oven.bakeTime !== '' ? `${oven.bakeTime} 分鐘` : '—'}
                  </div>
                </div>
              </div>

              {oven.enableStage2 && (
                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#9a3412',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>二段調溫 / 掉頭：</span>
                  <span>
                    上火 {oven.stage2TopTemp !== '' ? `${oven.stage2TopTemp}°C` : '—'} / 下火{' '}
                    {oven.mode === 'dual'
                      ? oven.stage2BottomTemp !== ''
                        ? `${oven.stage2BottomTemp}°C`
                        : '—'
                      : oven.stage2TopTemp !== ''
                        ? `${oven.stage2TopTemp}°C`
                        : '—'}{' '}
                    · {oven.stage2BakeTime !== '' ? `${oven.stage2BakeTime} 分鐘` : '—'}
                  </span>
                </div>
              )}

              {oven.notes.trim() && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#7c2d12'
                  }}
                >
                  烘烤備註：{oven.notes.trim()}
                </div>
              )}
            </div>

            {/* 實際投料清單 */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '12px',
                  borderBottom: '2.5px solid #e5e7eb',
                  paddingBottom: '10px'
                }}
              >
                📋 主麵團實際投料 (含百分比標示)
              </div>
              <div>
                {calc.mainRecipeItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px 0',
                      borderBottom: '1.5px dashed #e5e7eb'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '20px',
                        color: '#374151',
                        fontWeight: item.isMain || item.isPref ? 800 : 600,
                        lineHeight: 1.4
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: '24px',
                        fontWeight: 900,
                        color: item.hexColor,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {Number(item.weight.toFixed(1))}{' '}
                      <span style={{ fontSize: '17px', fontWeight: 500, color: '#9ca3af' }}>
                        g
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {calc.portions > 1 && (
                <div
                  style={{
                    marginTop: '18px',
                    padding: '14px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '10px',
                    fontSize: '18px',
                    color: '#92400e',
                    fontWeight: 800,
                    textAlign: 'center'
                  }}
                >
                  麵團分割：{calc.portions} 份 / 每份約 {Number(calc.perPortion.toFixed(1))} g
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: '24px',
                textAlign: 'center',
                fontSize: '13px',
                color: '#9ca3af',
                fontWeight: 500
              }}
            >
              匯出日期: {new Date().toLocaleDateString('zh-TW')} · 烘焙百分比計算器
            </div>
          </div>
        </div>
      </div>

      {/* 我的配方簿 Modal */}
      {isBookModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setIsBookModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-800" />
                <span>我的配方簿 (含上下火烤溫紀錄)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-3">
              {savedRecipes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 font-medium">目前還沒有儲存任何配方</p>
                  <p className="text-sm text-gray-400 mt-1">
                    在主畫面設定好材料比例與上下火溫度後，點擊「儲存至配方簿」即可隨時載入。
                  </p>
                </div>
              ) : (
                savedRecipes.map(item => {
                  const dateStr = new Date(item.createdAt).toLocaleDateString('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const ovenSummary = item.oven
                    ? item.oven.mode === 'single'
                      ? `全火 ${item.oven.topTemp || '—'}°C · ${item.oven.bakeTime || '—'}分`
                      : `上火 ${item.oven.topTemp || '—'}°C / 下火 ${item.oven.bottomTemp || '—'}°C · ${item.oven.bakeTime || '—'}分`
                    : '未設定烤溫';

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-base truncate">
                          {item.recipeName}
                        </h4>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                          <span>總重 {item.targetDoughWeight || '—'}g</span>
                          <span>·</span>
                          <span>水合 {item.targetHydration || '—'}%</span>
                          <span>·</span>
                          <span className="text-orange-800 font-semibold">{ovenSummary}</span>
                          <span>·</span>
                          <span className="text-gray-400">{dateStr}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            applyRecipeObject(item);
                            setIsBookModalOpen(false);
                            showToast(`已載入配方：「${item.recipeName}」`);
                          }}
                          className="flex-1 sm:flex-none bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold py-2 px-4 rounded-lg transition-colors border border-amber-200 text-xs cursor-pointer"
                        >
                          載入配方
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSavedRecipes(prev => prev.filter(r => r.id !== item.id));
                            showToast(`已刪除配方「${item.recipeName}」`);
                          }}
                          className="bg-white hover:bg-red-50 text-red-500 hover:text-red-600 p-2 rounded-lg transition-colors border border-gray-200 hover:border-red-200 cursor-pointer"
                          title="刪除配方"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
