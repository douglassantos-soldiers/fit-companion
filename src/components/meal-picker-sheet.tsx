import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { NumberInput } from "@mantine/core";
import { Barcode, Camera, Mic, Square, Star } from "lucide-react";
import { toast } from "sonner";
import { MEAL_PRESETS, type MealPreset } from "@/data/meal-presets";
import { QUALITY_LABEL, recentMealPresets, scalePreset } from "@/lib/engine/nutrition";
import { analyzeMealAi } from "@/lib/meal-ai.functions";
import type { MealAiSuggestion } from "@/lib/meal-ai-contract";
import { lookupBarcodeFn } from "@/lib/nutrition/barcode.functions";
import {
  lookupLocalBarcode,
  mealFromBarcode,
  parseEan,
  type BarcodeHit,
} from "@/lib/nutrition/barcode";
import { searchFoods } from "@/lib/nutrition/food-search";
import { defaultServing, servingsForFood } from "@/lib/nutrition/food-catalog";
import { customPickFromSaved, recentFoodsFromMeals } from "@/lib/nutrition/library";
import { buildMealItem, mealFromItems } from "@/lib/nutrition/meal-builder";
import { scaleMacros } from "@/lib/nutrition/nutrients";
import type { FoodSearchHit, FoodServing } from "@/lib/nutrition/types";
import { useStore } from "@/lib/store";
import { MEAL_SLOT_LABEL, type MealItemEntry, type MealQuality, type MealSlot, type SavedMeal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { MealPresetThumb } from "@/components/meal-preset-thumb";
import { cn } from "@/lib/utils";
import { BARCODE_EMPTY_CAMERA, BARCODE_EMPTY_INVALID, BARCODE_EMPTY_MISS } from "@/lib/ui/platform-copy";

type PickerTab = "buscar" | "alimentos" | "recentes" | "favoritos" | "salvos" | "codigo" | "foto" | "voz" | "texto";

export type CustomMealPick = {
  label: string;
  proteinG: number;
  kcal: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  quality: MealQuality;
  sourceKind?: "informed" | "estimated";
  confidence?: number;
  aiMode?: "photo" | "voice" | "text";
  correctedFromAi?: boolean;
  items?: MealItemEntry[];
  foodSource?: "taco" | "user" | "imported" | "ai_estimate" | "internal";
};

async function fileToBase64(file: Blob): Promise<{ base64: string; mimeType: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), mimeType: file.type || "application/octet-stream" };
}

async function compressImage(file: File, maxSide = 1280): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82);
  });
}

export function MealPickerSheet({
  slot,
  onClose,
  onPick,
  onPickCustom,
}: {
  slot: MealSlot;
  onClose: () => void;
  onPick: (preset: MealPreset, servings: number) => void;
  /** AI / custom / food meal (no presetId) */
  onPickCustom?: (meal: CustomMealPick) => void;
}) {
  const { state, toggleFavoriteMeal, saveMealTemplate } = useStore();
  const analyze = useServerFn(analyzeMealAi);
  const lookupBarcode = useServerFn(lookupBarcodeFn);
  const [tab, setTab] = useState<PickerTab>("recentes");
  const [query, setQuery] = useState("");
  const [foodQuery, setFoodQuery] = useState("");
  const [selected, setSelected] = useState<MealPreset | null>(null);
  const [foodHit, setFoodHit] = useState<FoodSearchHit | null>(null);
  const [foodServing, setFoodServing] = useState<FoodServing | null>(null);
  const [foodQty, setFoodQty] = useState(1);
  const [servings, setServings] = useState(1);
  const [aiDraft, setAiDraft] = useState<MealAiSuggestion | null>(null);
  const [aiMode, setAiMode] = useState<"photo" | "voice" | "text" | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [textDesc, setTextDesc] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeScanRef = useRef<HTMLInputElement>(null);
  const [ean, setEan] = useState("");
  const [barcodeHit, setBarcodeHit] = useState<BarcodeHit | null>(null);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    setCanScan(typeof window !== "undefined" && typeof window.BarcodeDetector === "function");
  }, []);

  const favorites = state.favoriteMealPresetIds ?? [];
  const recent = useMemo(() => recentMealPresets(state.meals ?? [], 8), [state.meals]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = MEAL_PRESETS.filter((p) => p.slot === slot || p.slot === "qualquer" || !slot);
    if (!q) return pool;
    return pool.filter((p) => p.label.toLowerCase().includes(q));
  }, [query, slot]);

  const foodResults = useMemo(() => searchFoods(foodQuery, { limit: 12 }), [foodQuery]);

  const favoritePresets = useMemo(
    () => MEAL_PRESETS.filter((p) => favorites.includes(p.id)),
    [favorites],
  );
  const savedMeals = state.savedMeals ?? [];
  const recentFoods = useMemo(() => recentFoodsFromMeals(state.meals ?? [], 8), [state.meals]);

  const runBarcodeLookup = async (raw: string) => {
    const parsed = parseEan(raw);
    if (!parsed) {
      setBarcodeHit(null);
      setBarcodeError("Código inválido — use EAN-8 ou EAN-13");
      return;
    }
    const local = lookupLocalBarcode(parsed);
    if (local) {
      setBarcodeHit(local);
      setBarcodeError(null);
      return;
    }
    setBarcodeBusy(true);
    setBarcodeError(null);
    try {
      const res = await lookupBarcode({ data: { ean: parsed } });
      if (res.found) {
        setBarcodeHit(res.hit);
        return;
      }
      setBarcodeHit(null);
      if (res.error === "rate_limited") setBarcodeError("Limite de consultas atingido — tente mais tarde");
      else if (res.error === "unauthorized") setBarcodeError("Faça login / desbloqueie o acesso para consultar o código");
      else setBarcodeError("Não encontrado — busque pelo nome");
    } catch {
      setBarcodeHit(null);
      setBarcodeError("Não encontrado — busque pelo nome");
    } finally {
      setBarcodeBusy(false);
    }
  };

  const scanBarcodeFile = async (file: File) => {
    const Detector = window.BarcodeDetector;
    if (!Detector) return;
    try {
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      const raw = codes.find((c) => c.rawValue)?.rawValue;
      if (!raw) {
        setBarcodeError("Não deu para ler o código — digite o EAN");
        return;
      }
      setEan(raw);
      await runBarcodeLookup(raw);
    } catch {
      setBarcodeError("Não deu para ler o código — digite o EAN");
    }
  };

  const fallbackToPreset = (reason?: string) => {
    toast.message(reason ?? "IA indisponível — escolha um preset");
    setTab("buscar");
  };

  const list =
    tab === "buscar" ? searchResults : tab === "recentes" ? recent : favoritePresets;

  const preview = selected ? scalePreset(selected, servings) : null;

  const foodPreview = useMemo(() => {
    if (!foodHit || !foodServing) return null;
    return scaleMacros(foodHit.food.per100g, (foodServing.gramsEquivalent * foodQty) / 100);
  }, [foodHit, foodServing, foodQty]);

  const confirm = () => {
    if (!selected) return;
    onPick(selected, servings);
  };

  const confirmFood = () => {
    if (!foodHit || !foodServing || !onPickCustom) return;
    const item = buildMealItem({
      foodId: foodHit.food.id,
      quantity: foodQty,
      unit: foodServing.label,
      grams: foodServing.gramsEquivalent * foodQty,
      sourceKind: "informed",
      foodSource: foodHit.food.source,
      kind: "observed",
      confidence: foodHit.food.confidence,
    });
    if (!item) return;
    const meal = mealFromItems([item]);
    onPickCustom({
      label: meal.label,
      proteinG: meal.proteinG,
      kcal: meal.kcal,
      carbG: meal.carbG,
      fatG: meal.fatG,
      fiberG: meal.fiberG,
      quality: meal.quality,
      sourceKind: "informed",
      confidence: 1,
      items: meal.items as MealItemEntry[],
      foodSource: "internal",
    });
  };

  const confirmBarcode = () => {
    if (!barcodeHit || !onPickCustom) return;
    const meal = mealFromBarcode(barcodeHit);
    const pick: CustomMealPick = {
      label: meal.label,
      proteinG: meal.proteinG,
      kcal: meal.kcal,
      carbG: meal.carbG,
      fatG: meal.fatG,
      fiberG: meal.fiberG,
      quality: meal.quality,
      sourceKind: meal.sourceKind,
      confidence: meal.confidence,
      items: meal.items as MealItemEntry[],
      foodSource: meal.foodSource,
    };
    onPickCustom(pick);
  };

  const confirmSaved = (saved: SavedMeal) => {
    if (!onPickCustom) return;
    onPickCustom(customPickFromSaved(saved));
  };

  const pickRecentFood = (foodId: string) => {
    const food = recentFoods.find((f) => f.id === foodId);
    const serving = food ? (defaultServing(food.id) ?? servingsForFood(food.id)[0]) : undefined;
    if (!food || !serving) return;
    setFoodHit({
      food,
      serving,
      summary: scaleMacros(food.per100g, serving.gramsEquivalent / 100),
      score: 1,
    });
    setFoodServing(serving);
    setFoodQty(1);
  };

  const saveCurrentFood = () => {
    if (!foodHit || !foodServing) return;
    const item = buildMealItem({
      foodId: foodHit.food.id,
      quantity: foodQty,
      unit: foodServing.label,
      grams: foodServing.gramsEquivalent * foodQty,
      sourceKind: "informed",
      foodSource: foodHit.food.source,
      kind: "observed",
      confidence: foodHit.food.confidence,
    });
    if (!item) return;
    const meal = mealFromItems([item]);
    saveMealTemplate({
      label: meal.label,
      items: meal.items as MealItemEntry[],
      proteinG: meal.proteinG,
      kcal: meal.kcal,
      carbG: meal.carbG,
      fatG: meal.fatG,
      fiberG: meal.fiberG,
      quality: meal.quality,
    });
    toast.success("Refeição salva na biblioteca");
  };

  const confirmAi = () => {
    if (!aiDraft || !onPickCustom) return;
    const items: MealItemEntry[] | undefined = aiDraft.candidates
      ?.filter((c) => c.foodId)
      .map((c) => {
        const opts: Parameters<typeof buildMealItem>[0] = {
          foodId: c.foodId!,
          quantity: c.quantity ?? 1,
          unit: c.unit ?? "g",
          confidence: c.confidence,
          sourceKind: "estimated",
          foodSource: "ai_estimate",
          kind: "estimated",
        };
        if (c.grams != null) opts.grams = c.grams;
        const built = buildMealItem(opts);
        return built as MealItemEntry | null;
      })
      .filter((x): x is MealItemEntry => Boolean(x));

    const pick: CustomMealPick = {
      label: aiDraft.label,
      proteinG: aiDraft.proteinG,
      kcal: aiDraft.kcal,
      quality: aiDraft.quality,
      sourceKind: "estimated",
      confidence: aiDraft.confidence,
      aiMode: aiMode ?? "text",
      correctedFromAi: false,
      foodSource: "ai_estimate",
    };
    if (aiDraft.carbG != null) pick.carbG = aiDraft.carbG;
    if (aiDraft.fatG != null) pick.fatG = aiDraft.fatG;
    if (aiDraft.fiberG != null) pick.fiberG = aiDraft.fiberG;
    if (items?.length) pick.items = items;
    onPickCustom(pick);
  };

  const runPhoto = async (file: File) => {
    setAiBusy(true);
    setAiDraft(null);
    try {
      const compressed = await compressImage(file);
      const { base64, mimeType } = await fileToBase64(compressed);
      const res = await analyze({
        data: { mode: "photo", slot, mediaBase64: base64, mimeType },
      });
      if (res.error) {
        if (res.error === "not_configured") {
          fallbackToPreset("IA não configurada — use um preset");
          return;
        }
        toast.error(
          res.error === "unauthorized"
            ? "Faça login / desbloqueie o acesso para usar foto"
            : res.error === "rate_limited"
              ? "Limite de análises atingido — tente mais tarde"
              : "Não consegui analisar a foto",
        );
        return;
      }
      if (res.suggestion) {
        setAiMode("photo");
        setAiDraft(res.suggestion);
      }
    } catch {
      toast.error("Falha ao analisar a foto");
    } finally {
      setAiBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void runVoice(blob);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microfone indisponível");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const runVoice = async (blob: Blob) => {
    setAiBusy(true);
    setAiDraft(null);
    setTranscript(null);
    try {
      const { base64, mimeType } = await fileToBase64(blob);
      const res = await analyze({
        data: { mode: "voice", slot, mediaBase64: base64, mimeType },
      });
      if (res.error) {
        if (res.error === "not_configured") {
          fallbackToPreset("IA não configurada — use um preset");
          return;
        }
        toast.error(
          res.error === "unauthorized"
            ? "Faça login / desbloqueie o acesso para usar voz"
            : res.error === "rate_limited"
              ? "Limite de análises atingido — tente mais tarde"
              : "Não consegui entender o áudio",
        );
        return;
      }
      if (res.transcript) setTranscript(res.transcript);
      if (res.suggestion) {
        setAiMode("voice");
        setAiDraft(res.suggestion);
      }
    } catch {
      toast.error("Falha ao analisar o áudio");
    } finally {
      setAiBusy(false);
    }
  };

  const runText = async () => {
    const text = textDesc.trim();
    if (!text) {
      toast.error("Descreva a refeição");
      return;
    }
    setAiBusy(true);
    setAiDraft(null);
    try {
      const res = await analyze({
        data: { mode: "text", slot, text },
      });
      if (res.error) {
        if (res.error === "not_configured") {
          fallbackToPreset("IA não configurada — use um preset");
          return;
        }
        toast.error(
          res.error === "unauthorized"
            ? "Faça login / desbloqueie o acesso para usar texto"
            : res.error === "rate_limited"
              ? "Limite de análises atingido — tente mais tarde"
              : "Não consegui estimar a refeição",
        );
        return;
      }
      if (res.suggestion) {
        setAiMode("text");
        setAiDraft(res.suggestion);
      }
    } catch {
      toast.error("Falha ao analisar o texto");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <SoldiersOverlay
      open
      onClose={onClose}
      title={MEAL_SLOT_LABEL[slot]}
      description={
        aiDraft
          ? "Confirme ou ajuste os macros (estimativa)"
          : foodHit
            ? "Quantidade e porção"
            : selected
              ? "Ajuste a porção"
              : "Presets, alimentos, texto, foto ou voz"
      }
      panelClassName="max-h-[80vh]"
    >
      {aiDraft ? (
        <div className="space-y-4">
          {transcript ? (
            <p className="text-xs text-muted-foreground">Ouvi: “{transcript}”</p>
          ) : null}
          {aiDraft.needsConfirmation !== false ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Confirme antes de salvar — confiança {Math.round(aiDraft.confidence * 100)}%
            </p>
          ) : null}
          <Input
            value={aiDraft.label}
            onChange={(e) => setAiDraft({ ...aiDraft, label: e.target.value })}
            placeholder="Nome da refeição"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Proteína (g)"
              value={aiDraft.proteinG}
              onChange={(v) =>
                setAiDraft({ ...aiDraft, proteinG: typeof v === "number" ? v : aiDraft.proteinG })
              }
              min={0}
              max={200}
            />
            <NumberInput
              label="Kcal"
              value={aiDraft.kcal}
              onChange={(v) =>
                setAiDraft({ ...aiDraft, kcal: typeof v === "number" ? v : aiDraft.kcal })
              }
              min={0}
              max={3000}
            />
            <NumberInput
              label="Carbo (g)"
              value={aiDraft.carbG ?? 0}
              onChange={(v) => {
                const n = typeof v === "number" ? v : 0;
                setAiDraft({ ...aiDraft, carbG: n });
              }}
              min={0}
              max={500}
            />
            <NumberInput
              label="Gordura (g)"
              value={aiDraft.fatG ?? 0}
              onChange={(v) => {
                const n = typeof v === "number" ? v : 0;
                setAiDraft({ ...aiDraft, fatG: n });
              }}
              min={0}
              max={200}
            />
          </div>
          {aiDraft.candidates?.length ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {aiDraft.candidates.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  {c.name}
                  {c.quantity != null ? ` · ${c.quantity} ${c.unit ?? ""}` : ""}
                  {c.grams != null ? ` (${c.grams} g)` : ""} · {Math.round(c.confidence * 100)}%
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Estimativa · {QUALITY_LABEL[aiDraft.quality]} · confiança{" "}
            {Math.round(aiDraft.confidence * 100)}%
            {aiDraft.notes ? ` · ${aiDraft.notes}` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setAiDraft(null);
                setTranscript(null);
              }}
            >
              Voltar
            </Button>
            <Button type="button" className="flex-1" disabled={!onPickCustom} onClick={confirmAi}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : foodHit && foodServing ? (
        <div className="space-y-4">
          <div>
            <p className="text-display text-lg">{foodHit.food.name}</p>
            <p className="text-xs text-muted-foreground">
              {foodHit.food.category} · {foodHit.food.source}
              {foodHit.food.brand ? ` · ${foodHit.food.brand}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {servingsForFood(foodHit.food.id).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFoodServing(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  foodServing.id === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <NumberInput
            label="Quantidade"
            value={foodQty}
            onChange={(v) => setFoodQty(typeof v === "number" ? v : 1)}
            min={0.25}
            max={20}
            step={0.25}
            decimalScale={2}
          />
          {foodPreview ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{Math.round(foodPreview.proteinG)} g</span> P ·{" "}
              <span className="font-semibold text-foreground">{Math.round(foodPreview.carbG)} g</span> C ·{" "}
              <span className="font-semibold text-foreground">{Math.round(foodPreview.fatG)} g</span> G ·{" "}
              <span className="font-semibold text-foreground">{Math.round(foodPreview.energyKcal)}</span> kcal
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setFoodHit(null);
                setFoodServing(null);
              }}
            >
              Voltar
            </Button>
            <Button type="button" className="flex-1" disabled={!onPickCustom} onClick={confirmFood}>
              Adicionar
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={saveCurrentFood}>
            Salvar esta refeição
          </Button>
        </div>
      ) : barcodeHit ? (
        <div className="space-y-4">
          <div>
            <p className="text-display text-lg">{barcodeHit.name}</p>
            <p className="text-xs text-muted-foreground">
              {barcodeHit.ean}
              {barcodeHit.brand ? ` · ${barcodeHit.brand}` : ""}
              {barcodeHit.source === "imported" ? " · Open Food Facts" : " · catálogo"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Porção {Math.round(barcodeHit.grams)} g ·{" "}
            <span className="font-semibold text-foreground">{Math.round(barcodeHit.per100g.proteinG)} g</span> P / 100 g ·{" "}
            <span className="font-semibold text-foreground">{Math.round(barcodeHit.per100g.energyKcal)}</span> kcal / 100 g
            {barcodeHit.kind === "estimated" ? " · macros incompletos (estimado)" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setBarcodeHit(null);
                setBarcodeError(null);
              }}
            >
              Voltar
            </Button>
            <Button type="button" className="flex-1" disabled={!onPickCustom} onClick={confirmBarcode}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : selected ? (
        <div className="space-y-4">
          <div>
            <p className="text-display text-lg">{selected.label}</p>
            <p className="text-xs text-muted-foreground">
              Base: {selected.proteinG} g · {selected.kcal} kcal · {QUALITY_LABEL[selected.quality]}
            </p>
          </div>
          <NumberInput
            label="Porções"
            value={servings}
            onChange={(v) => setServings(typeof v === "number" ? v : 1)}
            min={0.5}
            max={3}
            step={0.5}
            decimalScale={1}
            clampBehavior="strict"
          />
          {preview ? (
            <p className="text-sm text-muted-foreground">
              Preview: <span className="font-semibold text-foreground">{preview.proteinG} g</span> proteína ·{" "}
              <span className="font-semibold text-foreground">{preview.kcal} kcal</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            <Button type="button" className="flex-1" onClick={confirm}>
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as PickerTab)}>
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="recentes" className="flex-1 min-w-[4.5rem]">
                Recentes
              </TabsTrigger>
              <TabsTrigger value="buscar" className="flex-1 min-w-[4.5rem]">
                Presets
              </TabsTrigger>
              <TabsTrigger value="alimentos" className="flex-1 min-w-[4.5rem]">
                Alimentos
              </TabsTrigger>
              <TabsTrigger value="favoritos" className="flex-1 min-w-[4.5rem]">
                Favoritos
              </TabsTrigger>
              <TabsTrigger value="salvos" className="flex-1 min-w-[4.5rem]">
                Salvos
              </TabsTrigger>
              <TabsTrigger value="codigo" className="flex-1 min-w-[4.5rem]">
                Código
              </TabsTrigger>
              <TabsTrigger value="foto" className="flex-1 min-w-[4.5rem]">
                Foto
              </TabsTrigger>
              <TabsTrigger value="voz" className="flex-1 min-w-[4.5rem]">
                Voz
              </TabsTrigger>
              <TabsTrigger value="texto" className="flex-1 min-w-[4.5rem]">
                Texto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buscar" className="mt-3 space-y-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar preset…"
                autoFocus
              />
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
              />
            </TabsContent>

            <TabsContent value="alimentos" className="mt-3 space-y-3">
              <Input
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Buscar alimento (arroz, frango…)"
                autoFocus
              />
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {!foodQuery.trim() && recentFoods.length ? (
                  <li className="px-1 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recentes
                  </li>
                ) : null}
                {!foodQuery.trim()
                  ? recentFoods.map((food) => (
                      <li key={`recent-${food.id}`}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                          onClick={() => pickRecentFood(food.id)}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{food.name}</span>
                            <span className="text-xs text-muted-foreground">Recente no diário</span>
                          </span>
                        </button>
                      </li>
                    ))
                  : null}
                {foodResults.map((hit) => (
                  <li key={hit.food.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => {
                        setFoodHit(hit);
                        setFoodServing(hit.serving);
                        setFoodQty(1);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{hit.food.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {hit.serving.label} · {Math.round(hit.summary.proteinG)}g P ·{" "}
                          {Math.round(hit.summary.energyKcal)} kcal
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="foto" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Tire uma foto do prato — a IA estima macros. Você confirma antes de salvar.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void runPhoto(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                className="h-12 w-full gap-2"
                disabled={aiBusy}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="size-4" />
                {aiBusy ? "Analisando…" : "Fotografar / galeria"}
              </Button>
            </TabsContent>

            <TabsContent value="voz" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Ex.: “150g de arroz, 180g de frango e uma banana”.
              </p>
              <Button
                type="button"
                className="h-12 w-full gap-2"
                variant={recording ? "destructive" : "default"}
                disabled={aiBusy && !recording}
                onClick={() => (recording ? stopRecording() : void startRecording())}
              >
                {recording ? (
                  <>
                    <Square className="size-4" /> Parar
                  </>
                ) : (
                  <>
                    <Mic className="size-4" />
                    {aiBusy ? "Analisando…" : "Gravar"}
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="texto" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Descreva o que comeu — confirmação obrigatória se houver incerteza.
              </p>
              <Input
                value={textDesc}
                onChange={(e) => setTextDesc(e.target.value)}
                placeholder="Ex.: 150g de arroz, 180g de frango e uma banana"
              />
              <Button type="button" className="h-12 w-full" disabled={aiBusy} onClick={() => void runText()}>
                {aiBusy ? "Analisando…" : "Estimar refeição"}
              </Button>
            </TabsContent>

            <TabsContent value="recentes" className="mt-3">
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
                empty="Nenhum alimento recente"
              />
            </TabsContent>

            <TabsContent value="favoritos" className="mt-3">
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
                empty="Nenhum favorito ainda"
              />
            </TabsContent>

            <TabsContent value="salvos" className="mt-3">
              {savedMeals.length ? (
                <ul className="space-y-2">
                  {savedMeals.map((saved) => (
                    <li key={saved.id}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => confirmSaved(saved)}
                        className="h-auto w-full justify-start rounded-xl px-3 py-3 text-left font-normal"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{saved.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {saved.proteinG} g P · {saved.kcal} kcal
                            {saved.items.length ? ` · ${saved.items.length} item(ns)` : ""}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma refeição salva</p>
              )}
            </TabsContent>

            <TabsContent value="codigo" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Digite o EAN da embalagem. Confirme nome, marca e macros antes de registrar.
              </p>
              <Input
                id="meal-ean"
                value={ean}
                onChange={(e) => {
                  setEan(e.target.value);
                  setBarcodeError(null);
                }}
                inputMode="numeric"
                placeholder="EAN-8 ou EAN-13"
                aria-invalid={Boolean(barcodeError)}
                {...(barcodeError ? { "aria-describedby": "barcode-error" } : {})}
              />
              <input
                ref={barcodeScanRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void scanBarcodeFile(f);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={barcodeBusy}
                  onClick={() => void runBarcodeLookup(ean)}
                >
                  {barcodeBusy ? "Consultando…" : "Buscar código"}
                </Button>
                {canScan ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => barcodeScanRef.current?.click()}
                  >
                    <Barcode className="size-4" /> Escanear
                  </Button>
                ) : null}
              </div>
              {!canScan ? (
                <p className="text-xs text-muted-foreground">{BARCODE_EMPTY_CAMERA}</p>
              ) : null}
              {barcodeError ? (
                <div id="barcode-error" className="space-y-2" role="status" aria-live="polite">
                  <p className="text-sm text-destructive">
                    {barcodeError.includes("inválido") ? BARCODE_EMPTY_INVALID : barcodeError}
                  </p>
                  <p className="text-xs text-muted-foreground">{BARCODE_EMPTY_MISS}</p>
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setTab("buscar")}>
                    Buscar no catálogo
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </SoldiersOverlay>
  );
}

function PresetList({
  presets,
  favorites,
  onToggleFavorite,
  onSelect,
  empty = "Nenhum resultado",
}: {
  presets: MealPreset[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelect: (p: MealPreset) => void;
  empty?: string;
}) {
  if (!presets.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {presets.map((p) => {
        const fav = favorites.includes(p.id);
        return (
          <li key={p.id} className="flex items-stretch gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelect(p)}
              className="h-auto flex-1 justify-start gap-3 rounded-xl px-3 py-3 text-left font-normal"
            >
              <MealPresetThumb preset={p} className="size-11" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {p.proteinG} g proteína · {p.kcal} kcal · {QUALITY_LABEL[p.quality]}
                </span>
              </span>
            </Button>
            <button
              type="button"
              aria-label={fav ? "Remover favorito" : "Favoritar"}
              className={cn(
                "flex w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary",
                fav && "text-primary",
              )}
              onClick={() => onToggleFavorite(p.id)}
            >
              <Star className={cn("size-4", fav && "fill-primary")} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
