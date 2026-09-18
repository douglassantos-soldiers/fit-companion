import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Image, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXERCISES } from "@/data/exercises";
import { MEAL_PRESETS } from "@/data/meal-presets";
import { CHALLENGES } from "@/data/challenges";
import { checkAdminSession, loginAdmin } from "@/lib/access.functions";
import { loadCms, saveCms, type CmsState } from "@/lib/cms";
import { useStore } from "@/lib/store";

export function AdminPage() {
  const { state, hydrated } = useStore();
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [cms, setCms] = useState<CmsState>(() => emptyCms());
  const doLogin = useServerFn(loginAdmin);
  const doCheck = useServerFn(checkAdminSession);
  const featured = useMemo(
    () => EXERCISES.filter((e) => e.priority === 1 || e.mediaUrl).slice(0, 24),
    [],
  );

  useEffect(() => {
    setCms(loadCms());
    void doCheck()
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, [doCheck]);

  if (!hydrated || checking) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm">Carregando…</div>;
  }

  if (!state.accessGranted) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <p className="text-sm text-muted-foreground">Libere o acesso do app antes de abrir o admin.</p>
        <Link to="/acesso" search={{ token: undefined }} className="mt-4">
          <Button className="w-full">Ir para acesso</Button>
        </Link>
      </div>
    );
  }

  const tryAuth = () => {
    void doLogin({ data: { pin } }).then((r) => {
      if (r.ok) {
        setAuthed(true);
        toast.success("Admin liberado");
      } else if (r.reason === "not_configured") {
        toast.error("ADMIN_PIN não configurado no servidor");
      } else if (r.reason === "rate_limited") {
        toast.error("Muitas tentativas — aguarde");
      } else {
        toast.error("PIN inválido");
      }
    });
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <h1 className="text-display text-3xl">Admin CMS</h1>
        <p className="mt-2 text-sm text-muted-foreground">PIN do servidor (ADMIN_PIN — nunca VITE_).</p>
        <Input
          type="password"
          className="mt-4"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          onKeyDown={(e) => {
            if (e.key === "Enter") tryAuth();
          }}
        />
        <Button className="mt-3 w-full" onClick={tryAuth}>
          Entrar
        </Button>
        <Link to="/" className="mt-4 text-center text-xs text-primary">
          Voltar ao app
        </Link>
      </div>
    );
  }

  const persist = () => {
    saveCms(cms);
    toast.success("CMS salvo neste aparelho");
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background px-4 py-6 pb-20">
      <div className="flex items-center gap-3">
        <Link to="/perfil" className="rounded-full border border-white/10 p-2 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-display text-2xl">Admin CMS</h1>
          <p className="text-xs text-muted-foreground">Treinos, vídeos e imagens · local até o remoto</p>
        </div>
      </div>

      <Button className="mt-4 h-11 w-full gap-2 font-bold uppercase tracking-wide" onClick={persist}>
        <Save className="size-4" /> Salvar alterações
      </Button>

      <Tabs defaultValue="exercicios" className="mt-6">
        <TabsList className="w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="exercicios" className="flex-1 rounded-full">
            Treinos
          </TabsTrigger>
          <TabsTrigger value="comidas" className="flex-1 rounded-full">
            Comidas
          </TabsTrigger>
          <TabsTrigger value="desafios" className="flex-1 rounded-full">
            Desafios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exercicios" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Cole URL de imagem ou vídeo (mp4/gif). Usado na sessão quando o override existir.
          </p>
          {featured.map((ex) => (
            <div key={ex.id} className="surface-glass space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Video className="size-4 text-primary" />
                <p className="text-sm font-semibold">{ex.name}</p>
              </div>
              <Label className="text-xs text-muted-foreground">mediaUrl</Label>
              <Input
                value={cms.exerciseMedia[ex.id] ?? ex.mediaUrl ?? ""}
                placeholder="https://…"
                onChange={(e) =>
                  setCms((s) => ({
                    ...s,
                    exerciseMedia: { ...s.exerciseMedia, [ex.id]: e.target.value },
                  }))
                }
              />
              <Label className="text-xs text-muted-foreground">Nota do movimento</Label>
              <Input
                value={cms.workoutNotes[ex.id] ?? ""}
                placeholder="Cue de execução…"
                onChange={(e) =>
                  setCms((s) => ({
                    ...s,
                    workoutNotes: { ...s.workoutNotes, [ex.id]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="comidas" className="mt-4 space-y-3">
          {MEAL_PRESETS.map((m) => (
            <div key={m.id} className="surface-glass space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Image className="size-4 text-primary" />
                <p className="text-sm font-semibold">{m.label}</p>
              </div>
              <Input
                value={cms.mealImages[m.id] ?? m.imageUrl ?? ""}
                placeholder="https://… imagem"
                onChange={(e) =>
                  setCms((s) => ({
                    ...s,
                    mealImages: { ...s.mealImages, [m.id]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="desafios" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Catálogo atual (somente leitura). Edição remota entra na próxima fase do CMS.
          </p>
          {CHALLENGES.map((c) => (
            <div key={c.id} className="surface-glass p-4">
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.target} {c.unit} · {c.durationDays}d
                {c.requiresPerformance ? " · Performance" : ""}
              </p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function emptyCms(): CmsState {
  return { exerciseMedia: {}, mealImages: {}, workoutNotes: {} };
}
