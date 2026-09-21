import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEAL_PRESETS } from "@/data/meal-presets";
import { checkAdminSession, loginAdmin, logoutAdmin } from "@/lib/access.functions";
import {
  deleteAdminContent,
  hideAdminActivity,
  hideAdminComment,
  listAdminChallenges,
  listAdminContent,
  listAdminExercises,
  listAdminReports,
  listShopifyOps,
  loadAdminTrainingRules,
  loadCmsRemote,
  loadProductAnalytics,
  lookupUserByEmail,
  importShopifyCustomersBatch,
  resolveAdminReport,
  resyncEntitlement,
  saveAdminChallenge,
  saveAdminContent,
  saveAdminExercise,
  saveAdminTrainingRules,
  saveCmsRemote,
  setEntitlementManual,
  setUserStatus,
  listAdminExperts,
  saveAdminExpert,
  listAdminTrails,
  saveAdminTrail,
  listAdminCollections,
  saveAdminCollection,
} from "@/lib/admin.functions";
import { listAdminSoldiersMedia, updateSoldiersMediaStatus } from "@/lib/soldiers-media.functions";
import { SOLDIERS_MEDIA_MANIFEST } from "@/data/soldiers-media-manifest";
import type { SoldiersMediaAsset } from "@/lib/soldiers-media-types";
import type { AdminUserLookup, ShopifyOpsSnapshot } from "@/lib/admin.server";
import {
  accumulateShopifyCustomerImport,
  emptyShopifyCustomerImportTotals,
  type ShopifyCustomerImportTotals,
} from "@/lib/shopify-customers";
import type { ProductAnalytics } from "@/lib/analytics.server";
import { emptyCmsState, loadCms, setCmsCache, type CmsState } from "@/lib/cms";
import type { ResolvedLibraryExercise } from "@/lib/training/resolve-catalog";
import type { AdminChallengeRow } from "@/lib/catalog.server";
import type { PublicContentItem } from "@/lib/content-match";
import type { ContentCollection, ContentProgram, Expert } from "@/lib/content/types";
import type { TrainingRules } from "@/lib/training/training-rules";
import type { ContentReportRow } from "@/lib/moderation.server";
import {
  ALL_ADMIN_TABS,
  ADMIN_CATALOG_TABS,
  ADMIN_OPS_TABS,
  type AdminTabId,
} from "@/features/admin/nav";
import { DashboardTab } from "@/features/admin/dashboard-tab";
import { UsersTab } from "@/features/admin/users-tab";
import { ExercisesTab } from "@/features/admin/exercises-tab";
import { ProgramsTab } from "@/features/admin/programs-tab";
import { ChallengesTab } from "@/features/admin/challenges-tab";
import { ContentTab } from "@/features/admin/content-tab";
import { ExpertsTab } from "@/features/admin/experts-tab";
import { TrailsTab } from "@/features/admin/trails-tab";
import { CollectionsTab } from "@/features/admin/collections-tab";
import { MediaTab } from "@/features/admin/media-tab";
import { ModerationTab } from "@/features/admin/moderation-tab";
import { SystemTab } from "@/features/admin/system-tab";
import { cn } from "@/lib/utils";

export function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<AdminTabId>("dashboard");
  const [cms, setCms] = useState<CmsState>(() => emptyCms());
  const [saving, setSaving] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookup, setLookup] = useState<AdminUserLookup | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [ops, setOps] = useState<ShopifyOpsSnapshot | null>(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [importRunning, setImportRunning] = useState(false);
  const [importTotals, setImportTotals] = useState<ShopifyCustomerImportTotals | null>(null);
  const importAbortRef = useRef(false);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [exercises, setExercises] = useState<ResolvedLibraryExercise[]>([]);
  const [challenges, setChallenges] = useState<AdminChallengeRow[]>([]);
  const [content, setContent] = useState<PublicContentItem[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [trails, setTrails] = useState<ContentProgram[]>([]);
  const [collections, setCollections] = useState<ContentCollection[]>([]);
  const [rules, setRules] = useState<TrainingRules | null>(null);
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [mediaPackages, setMediaPackages] = useState<SoldiersMediaAsset[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  const doLogin = useServerFn(loginAdmin);
  const doCheck = useServerFn(checkAdminSession);
  const doLogout = useServerFn(logoutAdmin);
  const doLoadCms = useServerFn(loadCmsRemote);
  const doSaveCms = useServerFn(saveCmsRemote);
  const doLookup = useServerFn(lookupUserByEmail);
  const doResync = useServerFn(resyncEntitlement);
  const doSetEntitlement = useServerFn(setEntitlementManual);
  const doSetStatus = useServerFn(setUserStatus);
  const doListOps = useServerFn(listShopifyOps);
  const doImportCustomers = useServerFn(importShopifyCustomersBatch);
  const doAnalytics = useServerFn(loadProductAnalytics);
  const doListExercises = useServerFn(listAdminExercises);
  const doSaveExercise = useServerFn(saveAdminExercise);
  const doListChallenges = useServerFn(listAdminChallenges);
  const doSaveChallenge = useServerFn(saveAdminChallenge);
  const doLoadRules = useServerFn(loadAdminTrainingRules);
  const doSaveRules = useServerFn(saveAdminTrainingRules);
  const doListContent = useServerFn(listAdminContent);
  const doSaveContent = useServerFn(saveAdminContent);
  const doDeleteContent = useServerFn(deleteAdminContent);
  const doListReports = useServerFn(listAdminReports);
  const doResolveReport = useServerFn(resolveAdminReport);
  const doHideActivity = useServerFn(hideAdminActivity);
  const doHideComment = useServerFn(hideAdminComment);
  const doListExperts = useServerFn(listAdminExperts);
  const doSaveExpert = useServerFn(saveAdminExpert);
  const doListTrails = useServerFn(listAdminTrails);
  const doSaveTrail = useServerFn(saveAdminTrail);
  const doListCollections = useServerFn(listAdminCollections);
  const doSaveCollection = useServerFn(saveAdminCollection);
  const doListMedia = useServerFn(listAdminSoldiersMedia);
  const doUpdateMedia = useServerFn(updateSoldiersMediaStatus);

  const loadMediaPackages = () => {
    setMediaBusy(true);
    void doListMedia()
      .then((rows) => {
        const map = new Map<string, SoldiersMediaAsset>();
        for (const pack of SOLDIERS_MEDIA_MANIFEST) {
          map.set(
            `${pack.kind}:${pack.entityId}:${pack.version}:${pack.variant}:${pack.region}`,
            pack,
          );
        }
        for (const pack of rows) {
          map.set(
            `${pack.kind}:${pack.entityId}:${pack.version}:${pack.variant}:${pack.region}`,
            pack,
          );
        }
        setMediaPackages([...map.values()]);
      })
      .catch(() => toast.error("Falha ao listar mídia"))
      .finally(() => setMediaBusy(false));
  };

  useEffect(() => {
    void doCheck()
      .then(async (r) => {
        setAuthed(r.ok);
        if (r.ok) {
          try {
            const remote = await doLoadCms();
            setCms(remote);
            setCmsCache(remote);
          } catch {
            setCms(loadCms());
          }
        }
      })
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, [doCheck, doLoadCms]);

  const loadAnalytics = () => {
    setAnalyticsBusy(true);
    void doAnalytics()
      .then((r) => setAnalytics(r))
      .catch(() => toast.error("Falha ao carregar métricas"))
      .finally(() => setAnalyticsBusy(false));
  };

  useEffect(() => {
    if (authed && tab === "dashboard" && !analytics) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per tab
  }, [authed, tab]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm">
        Carregando…
      </div>
    );
  }

  const tryAuth = () => {
    void doLogin({ data: { email, password } })
      .then(async (r) => {
      if (r.ok) {
        setAuthed(true);
        toast.success("Admin liberado");
        try {
          const remote = await doLoadCms();
          setCms(remote);
          setCmsCache(remote);
        } catch {
          setCms(loadCms());
        }
      } else if (r.reason === "not_configured") {
          toast.error("Admin não configurado no servidor");
      } else if (r.reason === "rate_limited") {
        toast.error("Muitas tentativas — aguarde");
      } else {
          toast.error("E-mail ou senha inválidos");
      }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Falha no login admin";
        toast.error(msg);
    });
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <h1 className="text-display text-3xl">Admin Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com o e-mail e a senha de admin (nunca VITE_).
        </p>
        <Label htmlFor="admin-email" className="mt-4 text-xs">
          E-mail
        </Label>
        <Input
          id="admin-email"
          type="email"
          className="mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@exemplo.com"
          autoComplete="username"
        />
        <Label htmlFor="admin-password" className="mt-3 text-xs">
          Senha
        </Label>
        <Input
          id="admin-password"
          type="password"
          className="mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoComplete="current-password"
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

  const persistCms = () => {
    setSaving(true);
    void doSaveCms({ data: { cms } })
      .then((r) => {
        if (r.ok) {
          setCms(r.cms);
          setCmsCache(r.cms);
          toast.success(`CMS salvo no servidor (${r.count} itens)`);
        } else {
          toast.error(r.reason === "db_unavailable" ? "DB indisponível" : "Falha ao salvar CMS");
        }
      })
      .catch(() => toast.error("Falha ao salvar CMS"))
      .finally(() => setSaving(false));
  };

  const runLookup = () => {
    const next = lookupEmail.trim().toLowerCase();
    if (!next.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    setLookupBusy(true);
    void doLookup({ data: { email: next } })
      .then((r) => setLookup(r))
      .catch(() => toast.error("Falha no lookup"))
      .finally(() => setLookupBusy(false));
  };

  const runResync = () => {
    if (!lookup?.email) return;
    setLookupBusy(true);
    void doResync({ data: { email: lookup.email } })
      .then((r) => {
        if (r.ok) {
          setLookup(r.lookup);
          toast.success("Entitlement resincronizado");
        } else {
          toast.error(
            r.reason === "no_entitlement" ? "Sem entitlement / pedidos" : "Falha no resync",
          );
        }
      })
      .catch(() => toast.error("Falha no resync"))
      .finally(() => setLookupBusy(false));
  };

  const runGrant = (tier: "base" | "performance") => {
    if (!lookup?.email) return;
    if (!window.confirm(`Liberar acesso ${tier} para ${lookup.email}?`)) return;
    setLookupBusy(true);
    void doSetEntitlement({ data: { email: lookup.email, action: "grant", tier } })
      .then((r) => {
        if (r.ok) {
          setLookup(r.lookup);
          toast.success(`Acesso ${tier} liberado`);
        } else toast.error("Falha ao liberar");
      })
      .catch(() => toast.error("Falha ao liberar"))
      .finally(() => setLookupBusy(false));
  };

  const runRevoke = () => {
    if (!lookup?.email) return;
    if (!window.confirm(`Revogar acesso de ${lookup.email}?`)) return;
    setLookupBusy(true);
    void doSetEntitlement({ data: { email: lookup.email, action: "revoke", tier: "base" } })
      .then((r) => {
        if (r.ok) {
          setLookup(r.lookup);
          toast.success("Acesso revogado");
        } else toast.error("Falha ao revogar");
      })
      .catch(() => toast.error("Falha ao revogar"))
      .finally(() => setLookupBusy(false));
  };

  const runStatus = (status: "active" | "suspended" | "banned") => {
    if (!lookup?.email) return;
    const until =
      status === "suspended" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    setLookupBusy(true);
    void doSetStatus({
      data: {
        email: lookup.email,
        status,
        statusUntil: until,
        reason: status === "active" ? null : status,
      },
    })
      .then((r) => {
        if (r.ok) {
          setLookup(r.lookup);
          toast.success(status === "active" ? "Conta reativada" : `Conta ${status}`);
        } else toast.error(r.reason === "not_found" ? "Usuário não encontrado" : "Falha no status");
      })
      .catch(() => toast.error("Falha no status"))
      .finally(() => setLookupBusy(false));
  };

  const loadOps = () => {
    setOpsBusy(true);
    void doListOps()
      .then((r) => setOps(r))
      .catch(() => toast.error("Falha ao carregar ops"))
      .finally(() => setOpsBusy(false));
  };

  const runCustomerImport = (reset: boolean) => {
    importAbortRef.current = false;
    setImportRunning(true);
    setImportTotals(emptyShopifyCustomerImportTotals());
    void (async () => {
      let acc = emptyShopifyCustomerImportTotals();
      let first = true;
      try {
        while (!importAbortRef.current) {
          const batch = await doImportCustomers({ data: { reset: first && reset } });
          first = false;
          acc = accumulateShopifyCustomerImport(acc, batch);
          setImportTotals(acc);
          if (!batch.hasMore) {
            toast.success("Importação de clientes concluída");
            break;
          }
        }
        if (importAbortRef.current) {
          toast.message("Importação pausada. Continue para retomar o cursor.");
        }
        loadOps();
      } catch {
        toast.error("Falha na importação Shopify");
      } finally {
        setImportRunning(false);
      }
    })();
  };

  const loadExercises = () => {
    setCatalogBusy(true);
    void doListExercises()
      .then((r) => setExercises(r))
      .catch(() => toast.error("Falha ao listar exercícios"))
      .finally(() => setCatalogBusy(false));
  };

  const loadChallenges = () => {
    setCatalogBusy(true);
    void doListChallenges()
      .then((r) => setChallenges(r))
      .catch(() => toast.error("Falha ao listar desafios"))
      .finally(() => setCatalogBusy(false));
  };

  const loadContent = () => {
    setCatalogBusy(true);
    void doListContent()
      .then((r) => setContent(r))
      .catch(() => toast.error("Falha ao listar conteúdo"))
      .finally(() => setCatalogBusy(false));
  };

  const loadExperts = () => {
    setCatalogBusy(true);
    void doListExperts()
      .then((r) => setExperts(r))
      .catch(() => toast.error("Falha ao listar experts"))
      .finally(() => setCatalogBusy(false));
  };

  const loadTrails = () => {
    setCatalogBusy(true);
    void doListTrails()
      .then((r) => setTrails(r))
      .catch(() => toast.error("Falha ao listar trilhas"))
      .finally(() => setCatalogBusy(false));
  };

  const loadCollections = () => {
    setCatalogBusy(true);
    void doListCollections()
      .then((r) => setCollections(r))
      .catch(() => toast.error("Falha ao listar coleções"))
      .finally(() => setCatalogBusy(false));
  };

  const loadRules = () => {
    setCatalogBusy(true);
    void doLoadRules()
      .then((r) => setRules(r))
      .catch(() => toast.error("Falha ao carregar regras"))
      .finally(() => setCatalogBusy(false));
  };

  const loadReports = () => {
    setCatalogBusy(true);
    void doListReports()
      .then((r) => setReports(r))
      .catch(() => toast.error("Falha ao carregar denúncias"))
      .finally(() => setCatalogBusy(false));
  };

  const selectTab = (next: AdminTabId) => {
    setTab(next);
    if (next === "dashboard" && !analytics) loadAnalytics();
    if (next === "sistema" && !ops) loadOps();
    if (next === "exercicios" && !exercises.length) loadExercises();
    if (next === "desafios" && !challenges.length) loadChallenges();
    if (next === "conteudo" && !content.length) loadContent();
    if (next === "experts" && !experts.length) loadExperts();
    if (next === "trilhas" && !trails.length) loadTrails();
    if (next === "colecoes" && !collections.length) loadCollections();
    if (next === "programas" && !rules) loadRules();
    if (next === "moderacao" && !reports.length) loadReports();
    if (next === "midia") loadMediaPackages();
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl bg-background px-4 py-6 pb-20">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/perfil"
          className="rounded-full border border-white/10 p-2 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-display text-2xl">Admin Console</h1>
          <p className="text-xs text-muted-foreground">
            Backoffice de produto · sem dados de saúde
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            void doLogout().then(() => {
              setAuthed(false);
              setPassword("");
              toast.success("Sessão admin encerrada");
            });
          }}
        >
          <LogOut className="size-3.5" /> Sair
        </Button>
      </div>

      <div className="mt-6 md:hidden">
        <select
          className="h-11 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
          value={tab}
          onChange={(e) => selectTab(e.target.value as AdminTabId)}
        >
          {ALL_ADMIN_TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex gap-6">
        <nav className="hidden w-44 shrink-0 md:block">
          <p className="px-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Operação
          </p>
          <ul className="mt-1 space-y-1">
            {ADMIN_OPS_TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left text-sm",
                    tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground",
                  )}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 px-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Catálogo
          </p>
          <ul className="mt-1 space-y-1">
            {ADMIN_CATALOG_TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left text-sm",
                    tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground",
                  )}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === "dashboard" ? (
            <DashboardTab analytics={analytics} busy={analyticsBusy} onRefresh={loadAnalytics} />
          ) : null}
          {tab === "usuarios" ? (
            <UsersTab
              lookupEmail={lookupEmail}
              setLookupEmail={setLookupEmail}
              lookup={lookup}
              busy={lookupBusy}
              onLookup={runLookup}
              onResync={runResync}
              onGrant={runGrant}
              onRevoke={runRevoke}
              onStatus={runStatus}
            />
          ) : null}
          {tab === "exercicios" ? (
            <ExercisesTab
              rows={exercises}
              busy={catalogBusy}
              onReload={loadExercises}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveExercise({
                  data: {
                    id: row.id,
                    name: row.name,
                    group: row.group,
                    equipment: row.equipment,
                    swapGroup: row.swapGroup,
                    joints: row.joints,
                    unit: row.unit,
                    baseLoad: row.baseLoad,
                    priority: row.priority,
                    primaryMuscles: row.primaryMuscles,
                    secondaryMuscles: row.secondaryMuscles,
                    movementPattern: row.movementPattern,
                    difficulty: row.difficulty,
                    plannerEligible: row.plannerEligible,
                    active: row.active,
                    instructions: row.instructions,
                    videoUrl: row.videoUrl ?? null,
                    mediaUrl: row.mediaUrl ?? null,
                    cues: row.cues ?? null,
                    alternativeIds: row.alternativeIds,
                    canonicalName: row.canonicalName,
                    displayNameEn: row.displayNameEn ?? null,
                    version: row.version,
                    aliases: row.aliases ?? [],
                    searchTerms: row.searchTerms ?? [],
                    equipmentInventory: row.equipmentInventory ?? [],
                    exerciseFamily: row.exerciseFamily ?? null,
                    movementFamily: row.movementFamily ?? null,
                    progressionFamily: row.progressionFamily ?? null,
                    regressionFamily: row.regressionFamily ?? null,
                    contraindicationTags: row.contraindicationTags ?? [],
                    mediaId: row.mediaId,
                    mediaStatus: row.mediaStatus,
                  },
                })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Exercício salvo");
                      loadExercises();
                    } else toast.error("Falha ao salvar exercício");
                  })
                  .catch(() => toast.error("Falha ao salvar exercício"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "programas" ? (
            <ProgramsTab
              rules={rules}
              setRules={setRules}
              busy={catalogBusy}
              onSave={() => {
                if (!rules) return;
                setCatalogBusy(true);
                void doSaveRules({ data: rules })
                  .then((r) => {
                    if (r.ok) toast.success("Regras salvas");
                    else toast.error("Falha ao salvar regras");
                  })
                  .catch(() => toast.error("Falha ao salvar regras"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "experts" ? (
            <ExpertsTab
              rows={experts}
              busy={catalogBusy}
              onReload={loadExperts}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveExpert({ data: row })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Expert salvo");
                      loadExperts();
                    } else toast.error("Falha ao salvar expert");
                  })
                  .catch(() => toast.error("Falha ao salvar expert"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "trilhas" ? (
            <TrailsTab
              rows={trails}
              busy={catalogBusy}
              onReload={loadTrails}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveTrail({ data: row })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Trilha salva");
                      loadTrails();
                    } else toast.error("Falha ao salvar trilha");
                  })
                  .catch(() => toast.error("Falha ao salvar trilha"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "colecoes" ? (
            <CollectionsTab
              rows={collections}
              busy={catalogBusy}
              onReload={loadCollections}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveCollection({ data: row })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Coleção salva");
                      loadCollections();
                    } else toast.error("Falha ao salvar coleção");
                  })
                  .catch(() => toast.error("Falha ao salvar coleção"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "desafios" ? (
            <ChallengesTab
              rows={challenges}
              busy={catalogBusy}
              onReload={loadChallenges}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveChallenge({
                  data: {
                    id: row.id,
                    title: row.title ?? "",
                    description: row.description ?? "",
                    category: row.category ?? "consistency",
                    metric: row.metric ?? "sessoes",
                    target: row.target ?? 1,
                    unit: row.unit ?? "treinos",
                    durationDays: row.durationDays ?? 7,
                    rankingMode: row.rankingMode ?? "absolute",
                    reward: row.reward ?? null,
                    active: row.active !== false,
                    startsAt: row.startsAt ?? null,
                    endsAt: row.endsAt ?? null,
                    requiresPerformance: Boolean(row.requiresPerformance),
                    targetPct: row.targetPct ?? null,
                    personalTargetMin: row.personalTargetMin ?? null,
                    personalTargetMax: row.personalTargetMax ?? null,
                    personalTargetFactor: row.personalTargetFactor ?? null,
                    personalTargetOffset: row.personalTargetOffset ?? null,
                  },
                })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Desafio salvo");
                      loadChallenges();
                    } else toast.error("Falha ao salvar desafio");
                  })
                  .catch(() => toast.error("Falha ao salvar desafio"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "conteudo" ? (
            <ContentTab
              rows={content}
              busy={catalogBusy}
              onReload={loadContent}
              onSave={(row) => {
                setCatalogBusy(true);
                void doSaveContent({
                  data: {
                    ...(row.id ? { id: row.id } : {}),
                    kind: row.kind,
                    title: row.title,
                    body: row.body,
                    mediaUrl: row.mediaUrl ?? null,
                    goals: row.goals,
                    levels: row.levels,
                    published: row.published,
                    sortOrder: row.sortOrder,
                    visible: row.visible !== false,
                    ...(row.expertId ? { expertId: row.expertId } : {}),
                    ...(row.collectionId ? { collectionId: row.collectionId } : {}),
                    ...(row.mediaId ? { mediaId: row.mediaId } : {}),
                    ...(row.publishAt ? { publishAt: row.publishAt } : {}),
                    ...(row.unpublishAt ? { unpublishAt: row.unpublishAt } : {}),
                  },
                })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Conteúdo salvo");
                      loadContent();
                    } else toast.error("Falha ao salvar conteúdo");
                  })
                  .catch(() => toast.error("Falha ao salvar conteúdo"))
                  .finally(() => setCatalogBusy(false));
              }}
              onDelete={(id) => {
                if (!window.confirm("Excluir este conteúdo?")) return;
                setCatalogBusy(true);
                void doDeleteContent({ data: { id } })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Excluído");
                      loadContent();
                    } else toast.error("Falha ao excluir");
                  })
                  .catch(() => toast.error("Falha ao excluir"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
          ) : null}
          {tab === "midia" ? (
            <MediaTab
              cms={cms}
              setCms={(updater) => setCms(updater)}
              meals={MEAL_PRESETS}
              packages={mediaPackages}
              saving={saving}
              statusBusy={mediaBusy}
              onSave={persistCms}
              onStatusChange={(pack, status) => {
                setMediaBusy(true);
                void doUpdateMedia({
                  data: {
                    kind: pack.kind,
                    entityId: pack.entityId,
                    version: pack.version,
                    variant: pack.variant,
                    region: pack.region,
                    status,
                  },
                })
                  .then((r) => {
                    if (r.ok) {
                      toast.success(`Status: ${status}`);
                      loadMediaPackages();
                    } else if (r.reason === "illegal_transition") {
                      toast.error("Transição de status inválida");
                    } else if (r.reason === "validation_failed") {
                      toast.error("Package incompleto para published");
                    } else if (r.reason === "not_found") {
                      toast.error("Persista o package no servidor antes de mudar status");
                    } else {
                      toast.error("Falha ao atualizar mídia");
                    }
                  })
                  .catch(() => toast.error("Falha ao atualizar mídia"))
                  .finally(() => setMediaBusy(false));
              }}
            />
          ) : null}
          {tab === "moderacao" ? (
            <ModerationTab
              reports={reports}
              busy={catalogBusy}
              onReload={loadReports}
              onResolve={(reportId, status, hideEvent) => {
                setCatalogBusy(true);
                void doResolveReport({ data: { reportId, status, hideEvent } })
                  .then((r) => {
                    if (r.ok) {
                      toast.success("Relatório atualizado");
                      loadReports();
                    } else toast.error("Falha na moderação");
                  })
                  .catch(() => toast.error("Falha na moderação"))
                  .finally(() => setCatalogBusy(false));
              }}
              onHide={(eventId) => {
                setCatalogBusy(true);
                void doHideActivity({ data: { eventId } })
                  .then((r) => {
                    if (r.ok) toast.success("Evento oculto");
                    else toast.error("Falha ao ocultar");
                  })
                  .catch(() => toast.error("Falha ao ocultar"))
                  .finally(() => setCatalogBusy(false));
              }}
              onHideComment={(commentId) => {
                setCatalogBusy(true);
                void doHideComment({ data: { commentId } })
                  .then((r) => {
                    if (r.ok) toast.success("Comentário oculto");
                    else toast.error("Falha ao ocultar");
                  })
                  .catch(() => toast.error("Falha ao ocultar"))
                  .finally(() => setCatalogBusy(false));
              }}
            />
              ) : null}
          {tab === "sistema" ? (
            <SystemTab
              ops={ops}
              busy={opsBusy}
              onReload={loadOps}
              importRunning={importRunning}
              importTotals={importTotals}
              onImport={runCustomerImport}
              onImportStop={() => {
                importAbortRef.current = true;
              }}
            />
                        ) : null}
              </div>
            </div>
    </div>
  );
}

function emptyCms(): CmsState {
  return emptyCmsState();
}
