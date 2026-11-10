"use client";

import QRCode from "qrcode";
import Swal from "sweetalert2";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPixPayload, formatCurrency, parseAmount } from "@/lib/pix";
import { getSupabase } from "@/lib/supabase";
import { createCashboxToken, redeemCashboxLink } from "@/lib/cashbox-auth";
import {
  ACTIVE_BOX_STORAGE,
  ACTIVE_SESSION_STORAGE,
  BOXES_STORAGE,
  HISTORY_STORAGE,
  KEYS_STORAGE,
  RETENTION_STORAGE,
  activeSessionStorageKey,
  type CashRegister,
  type PixKey,
  type PixKeyType,
  type PixSession,
} from "@/lib/types";

type MenuTab = "menu" | "history" | "keys" | "boxes" | "box_detail" | "profile";
type AccessMode = "checking" | "setup" | "login" | "owner" | "cashier" | "local" | "link_required" | "error";
type OwnerAuthView = "sign_in" | "forgot_password" | "reset_password";

const BOX_KEY_ASSIGNMENTS_STORAGE = "pixfacil.cashbox-key-assignments.v1";
const BOX_LINKS_STORAGE = "pixfacil.cashbox-links.v1";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "telefone", label: "Telefone" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "aleatoria", label: "Aleatória" },
];

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#111714] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-lime/60";

function freshKey(): PixKey {
  return {
    id: "",
    apelido: "",
    tipo_chave: "telefone",
    chave: "",
    titular: "",
    cidade: "SAO PAULO",
    ativa: false,
    created_at: new Date().toISOString(),
  };
}

function statusLabel(status: PixSession["status"]): string {
  if (status === "pago") return "Pago";
  return "Pendente";
}

function withHistoryItem(items: PixSession[], session: PixSession): PixSession[] {
  return [session, ...items.filter((item) => item.id !== session.id)];
}

function localDateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CaixaApp({ adminPanel = false }: { adminPanel?: boolean }) {
  const [accessMode, setAccessMode] = useState<AccessMode>("checking");
  const [boxes, setBoxes] = useState<CashRegister[]>([]);
  const [cashboxKeyAssignments, setCashboxKeyAssignments] = useState<Record<string, string[]>>({});
  const [cashboxKeyDraftIds, setCashboxKeyDraftIds] = useState<string[]>([]);
  const [cashboxKeyDraftBoxId, setCashboxKeyDraftBoxId] = useState<string | null>(null);
  const [activeBox, setActiveBox] = useState<CashRegister | null>(null);
  const [boxName, setBoxName] = useState("");
  const [detailBox, setDetailBox] = useState<CashRegister | null>(null);
  const [detailSection, setDetailSection] = useState<"keys" | "link" | "audit" | "settings">("keys");
  const [generatedLinks, setGeneratedLinks] = useState<{ cashbox: string; name: string; boxId: string } | null>(null);
  const [cashboxLinkLoadState, setCashboxLinkLoadState] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  const [customerDisplayLink, setCustomerDisplayLink] = useState<{ url: string; boxId: string } | null>(null);
  const [displayLinkLoadState, setDisplayLinkLoadState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [confirmProfilePassword, setConfirmProfilePassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [ownerAuthView, setOwnerAuthView] = useState<OwnerAuthView>("sign_in");
  const [authFeedback, setAuthFeedback] = useState("");
  const [authFeedbackIsError, setAuthFeedbackIsError] = useState(false);
  const [canSetupOwner, setCanSetupOwner] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [keys, setKeys] = useState<PixKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [history, setHistory] = useState<PixSession[]>([]);
  const [activeSession, setActiveSession] = useState<PixSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(adminPanel);
  const [menuTab, setMenuTab] = useState<MenuTab>("menu");
  const [keyDraft, setKeyDraft] = useState<PixKey>(freshKey);
  const [retentionDays, setRetentionDays] = useState(60);
  const [historyKeyId, setHistoryKeyId] = useState("all");
  const [historyBoxId, setHistoryBoxId] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyRetention, setHistoryRetention] = useState(60);
  const [backendOnline, setBackendOnline] = useState(false);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const today = localDateKey(new Date().toISOString());
    setHistoryFrom(today);
    setHistoryTo(today);
  }, []);

  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setOwnerAuthView("reset_password");
        setAuthFeedback("");
        setMessage("");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);
  const parsedAmount = parseAmount(amountText);
  const activeBoxKeyIds = activeBox
    ? cashboxKeyAssignments[activeBox.id] ?? (supabase ? [] : keys.map((key) => key.id))
    : [];
  const operatorKeys = adminPanel ? keys : keys.filter((key) => activeBoxKeyIds.includes(key.id));
  const selectedKey = operatorKeys.find((key) => key.id === selectedKeyId) ?? null;
  const filteredHistory = history.filter((item) => {
    if (historyKeyId !== "all" && item.chave_id !== historyKeyId) return false;
    if (historyBoxId !== "all" && item.caixa_id !== historyBoxId) return false;
    const date = localDateKey(item.created_at);
    if (historyFrom && date < historyFrom) return false;
    if (historyTo && date > historyTo) return false;
    return true;
  });
  const boxDetailSessions = detailBox
    ? history.filter((item) => {
        if (item.caixa_id !== detailBox.id) return false;
        if (historyKeyId !== "all" && item.chave_id !== historyKeyId) return false;
        const date = localDateKey(item.created_at);
        if (historyFrom && date < historyFrom) return false;
        if (historyTo && date > historyTo) return false;
        return item.status === "pago";
      })
    : [];
  const boxDetailTotal = boxDetailSessions.reduce((total, item) => total + Number(item.valor), 0);
  const paidTotal = filteredHistory
    .filter((item) => item.status === "pago")
    .reduce((total, item) => total + Number(item.valor), 0);
  const paidSessions = filteredHistory.filter((item) => item.status === "pago");
  const paidCount = paidSessions.length;
  const salesByCashbox = Object.values(paidSessions.reduce<Record<string, { id: string; name: string; total: number; count: number }>>((totals, item) => {
    const id = item.caixa_id ?? item.caixa_nome ?? "sem-caixa";
    const total = totals[id] ?? {
      id,
      name: item.caixa_nome ?? boxes.find((box) => box.id === item.caixa_id)?.nome ?? "Caixa",
      total: 0,
      count: 0,
    };
    total.total += Number(item.valor);
    total.count += 1;
    totals[id] = total;
    return totals;
  }, {}));
  const salesByPixKey = Object.values(paidSessions.reduce<Record<string, { id: string; name: string; total: number; count: number }>>((totals, item) => {
    const total = totals[item.chave_id] ?? {
      id: item.chave_id,
      name: item.apelido ?? keys.find((key) => key.id === item.chave_id)?.apelido ?? "Chave Pix",
      total: 0,
      count: 0,
    };
    total.total += Number(item.valor);
    total.count += 1;
    totals[item.chave_id] = total;
    return totals;
  }, {}));

  const initializeAccess = useCallback(async (isCurrent: () => boolean) => {
    if (!supabase) {
      if (adminPanel) {
        setAccessError(
          "O Supabase não está configurado neste build. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente do servidor, gere um novo build e reinicie o app. Depois, entre em /adm.",
        );
        setAccessMode("error");
        setDataLoaded(true);
        return;
      }
      let localBoxes: CashRegister[] = JSON.parse(localStorage.getItem(BOXES_STORAGE) || "[]");
      if (!localBoxes.length) {
        localBoxes = [{ id: "local-main", nome: "Caixa principal", ativo: true, created_at: new Date().toISOString() }];
        localStorage.setItem(BOXES_STORAGE, JSON.stringify(localBoxes));
      }
      const legacyBox = localBoxes.find((box) => box.id === "local-main") ?? localBoxes[0];
      const storedHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]") as PixSession[];
      const migratedHistory = storedHistory.map((item) => item.caixa_id
        ? item
        : { ...item, caixa_id: legacyBox.id, caixa_nome: legacyBox.nome });
      if (migratedHistory.some((item, index) => item !== storedHistory[index])) {
        localStorage.setItem(HISTORY_STORAGE, JSON.stringify(migratedHistory));
      }
      const legacyActive = localStorage.getItem(ACTIVE_SESSION_STORAGE);
      if (legacyActive) {
        const parsedActive = JSON.parse(legacyActive) as PixSession;
        if (!parsedActive.caixa_id) {
          localStorage.setItem(activeSessionStorageKey(legacyBox.id), JSON.stringify({
            ...parsedActive,
            caixa_id: legacyBox.id,
            caixa_nome: legacyBox.nome,
          }));
        }
      }
      const selectedId = new URLSearchParams(window.location.search).get("caixa")
        || localStorage.getItem(ACTIVE_BOX_STORAGE);
      const selected = localBoxes.find((box) => box.id === selectedId && box.ativo) ?? localBoxes.find((box) => box.ativo) ?? null;
      setBoxes(localBoxes);
      setActiveBox(selected);
      setAccessMode("local");
      setDataLoaded(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const linkBoxId = params.get("caixa");
    const accessToken = params.get("acesso");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (!isCurrent()) return;
    if (sessionError) throw new Error(`Não foi possível verificar a sessão: ${sessionError.message}`);

    if (linkBoxId && accessToken) {
      await redeemCashboxLink(supabase, linkBoxId, accessToken);
      if (!isCurrent()) return;
      const { data: linkedBox, error } = await supabase
        .from("caixas")
        .select("*")
        .eq("id", linkBoxId)
        .eq("ativo", true)
        .single();
      if (!isCurrent()) return;
      if (error || !linkedBox) throw new Error(`Não foi possível abrir o caixa: ${error?.message ?? "caixa indisponível"}`);
      localStorage.setItem(ACTIVE_BOX_STORAGE, linkedBox.id);
      window.history.replaceState({}, "", `${window.location.pathname}?caixa=${encodeURIComponent(linkedBox.id)}`);
      const { data: isAdmin } = await supabase.rpc("is_app_admin");
      if (!isCurrent()) return;
      if (isAdmin) {
        const { data: allBoxes, error: boxesError } = await supabase.from("caixas").select("*").order("created_at");
        if (!isCurrent()) return;
        if (boxesError) throw new Error(`Não foi possível carregar os caixas: ${boxesError.message}`);
        setBoxes((allBoxes ?? []) as CashRegister[]);
        setAccessMode("owner");
      } else {
        setBoxes([linkedBox as CashRegister]);
        setAccessMode("cashier");
      }
      setActiveBox(linkedBox as CashRegister);
      return;
    }

    if (sessionData.session) {
      setOwnerEmail(sessionData.session.user.email ?? "");
      const { data: isAdmin, error: adminError } = await supabase.rpc("is_app_admin");
      if (!isCurrent()) return;
      if (adminError) throw new Error(`Não foi possível verificar o acesso: ${adminError.message}`);
      if (isAdmin) {
        const { data: allBoxes, error } = await supabase.from("caixas").select("*").order("created_at");
        if (!isCurrent()) return;
        if (error) throw new Error(`Não foi possível carregar os caixas: ${error.message}`);
        const activeBoxes = (allBoxes ?? []) as CashRegister[];
        const selectedId = params.get("caixa") || localStorage.getItem(ACTIVE_BOX_STORAGE);
        const selected = activeBoxes.find((box) => box.id === selectedId && box.ativo)
          ?? activeBoxes.find((box) => box.ativo)
          ?? null;
        setBoxes(activeBoxes);
        setActiveBox(selected);
        if (selected) localStorage.setItem(ACTIVE_BOX_STORAGE, selected.id);
        setAccessMode("owner");
        return;
      }

      const selectedId = params.get("caixa") || localStorage.getItem(ACTIVE_BOX_STORAGE);
      if (selectedId) {
        const { data: linkedBox, error } = await supabase.from("caixas").select("*").eq("id", selectedId).eq("ativo", true).maybeSingle();
        if (!isCurrent()) return;
        if (!error && linkedBox) {
          setBoxes([linkedBox as CashRegister]);
          setActiveBox(linkedBox as CashRegister);
          setAccessMode("cashier");
          return;
        }
      }
      setAccessMode("link_required");
      return;
    }

    const { data: setupAvailable, error } = await supabase.rpc("owner_setup_available");
    if (!isCurrent()) return;
    if (error) throw new Error(`Não foi possível verificar a configuração inicial: ${error.message}`);
    setCanSetupOwner(Boolean(setupAvailable));
    setAccessMode("login");
  }, [adminPanel, supabase]);

  const readStoredState = useCallback(() => {
    try {
      const savedKeys = localStorage.getItem(KEYS_STORAGE);
      const storedKeys: PixKey[] = savedKeys ? JSON.parse(savedKeys) : [];
      const nextKeys = storedKeys.filter((key) => key.id !== "local-default");
      const savedAssignments = localStorage.getItem(BOX_KEY_ASSIGNMENTS_STORAGE);
      if (savedAssignments) setCashboxKeyAssignments(JSON.parse(savedAssignments) as Record<string, string[]>);
      const savedHistory = localStorage.getItem(HISTORY_STORAGE);
      const storedHistory: PixSession[] = savedHistory ? JSON.parse(savedHistory) : [];
      const nextHistory = storedHistory
        .filter((item: PixSession) => item.status !== "cancelado");
      const storedRetention = Number(localStorage.getItem(RETENTION_STORAGE) || 60);
      const expiresAt = Date.now() - Math.max(1, storedRetention) * 24 * 60 * 60 * 1000;
      const retained = nextHistory.filter((item) => new Date(item.created_at).getTime() >= expiresAt);
      setKeys(nextKeys);
      setSelectedKeyId((current) =>
        nextKeys.some((key) => key.id === current)
          ? current
          : nextKeys.find((key) => key.ativa)?.id ?? nextKeys[0]?.id ?? "",
      );
      setHistory(retained);
      setRetentionDays(storedRetention);
      if (nextKeys.length !== storedKeys.length) {
        localStorage.setItem(KEYS_STORAGE, JSON.stringify(nextKeys));
      }
      if (retained.length !== storedHistory.length) {
        localStorage.setItem(HISTORY_STORAGE, JSON.stringify(retained));
      }
    } catch (error) {
      console.error("Não foi possível ler os dados locais.", error);
      setMessage("Não foi possível ler os dados locais deste navegador.");
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void withTimeout(
      initializeAccess(() => !cancelled),
      20000,
      "A conexão com o Supabase demorou demais para responder. Verifique a internet e tente novamente.",
    )
      .catch((error: unknown) => {
        console.error("Falha ao identificar o caixa.", error);
        if (!cancelled) {
          setAccessError(error instanceof Error ? error.message : "Não foi possível abrir o sistema.");
          setAccessMode("error");
          setDataLoaded(true);
          setLoading(false);
          cancelled = true;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initializeAccess, supabase]);

  useEffect(() => {
    if (!dataLoaded || accessMode === "checking") return;
    if (adminPanel && (accessMode === "cashier" || accessMode === "link_required")) {
      window.location.replace("/caixa");
      return;
    }
    if (!adminPanel && accessMode === "owner") {
      window.location.replace("/adm");
      return;
    }
    if (adminPanel && (accessMode === "owner" || accessMode === "local")) {
      setMenuOpen(true);
      setMenuTab("menu");
    }
  }, [accessMode, adminPanel, dataLoaded]);

  useEffect(() => {
    if (!notice) return;
    void Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: notice,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      background: "#171e1a",
      color: "#f8fafc",
    });
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!message) return;
    void Swal.fire({
      toast: true,
      position: "top-end",
      icon: "error",
      title: message,
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      background: "#171e1a",
      color: "#f8fafc",
    });
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (activeSession?.status !== "pago") return;
    const paidSessionId = activeSession.id;
    const timer = window.setTimeout(() => {
      try {
        const storageKey = activeBox ? activeSessionStorageKey(activeBox.id) : ACTIVE_SESSION_STORAGE;
        const stored = localStorage.getItem(storageKey);
        if (stored && (JSON.parse(stored) as PixSession).id === paidSessionId) {
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error("Não foi possível limpar o pagamento ativo local.", error);
      }
      setActiveSession((current) => current?.id === paidSessionId ? null : current);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [activeSession, activeBox]);

  useEffect(() => {
    readStoredState();
  }, [readStoredState]);

  useEffect(() => {
    if (!activeBox) return;
    localStorage.setItem(ACTIVE_BOX_STORAGE, activeBox.id);
    const savedActive = localStorage.getItem(activeSessionStorageKey(activeBox.id))
      ?? localStorage.getItem(ACTIVE_SESSION_STORAGE);
    try {
      const restored = savedActive ? JSON.parse(savedActive) as PixSession : null;
      const pending = restored?.caixa_id === activeBox.id && restored.status === "pendente" ? restored : null;
      setActiveSession(pending);
      setQrOpen(Boolean(pending));
      if (restored && restored.status !== "pendente") {
        localStorage.removeItem(activeSessionStorageKey(activeBox.id));
        localStorage.removeItem(ACTIVE_SESSION_STORAGE);
      }
    } catch (error) {
      console.error("Não foi possível restaurar o QR ativo.", error);
      setActiveSession(null);
    }
  }, [activeBox]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "pendente") {
      setQrImage("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(activeSession.payload_pix, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((image) => {
        if (!cancelled) setQrImage(image);
      })
      .catch((error: unknown) => {
        console.error("Não foi possível gerar o QR Code.", error);
        if (!cancelled) setMessage("Não foi possível gerar o QR Code. Tente novamente.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  useEffect(() => {
    if (!supabase || (accessMode !== "owner" && accessMode !== "cashier") || (!activeBox && accessMode !== "owner")) {
      if (accessMode === "local" && activeBox) {
        const localHistory: PixSession[] = JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]");
        const boxHistory = localHistory.filter((item) => item.caixa_id === activeBox.id);
        setHistory(localHistory);
        const pending = boxHistory.find((item) => item.status === "pendente") ?? null;
        setActiveSession(pending);
        setQrOpen(Boolean(pending));
      } else if ((accessMode === "owner" || accessMode === "cashier") && !activeBox) {
        setHistory([]);
        setActiveSession(null);
        setQrOpen(false);
        setDataLoaded(true);
      }
      return;
    }
    let cancelled = false;
    const client = supabase;
    const currentBox = activeBox;
    setLoading(true);

    async function loadRemoteData() {
      const { data: remoteKeys, error: keysError } = await client.from("chaves_pix").select("*").order("created_at");
      if (cancelled) return;
      if (keysError) {
        setMessage(`Supabase: ${keysError.message}`);
        setKeys([]);
        setHistory([]);
        setDataLoaded(true);
        setLoading(false);
        return;
      }

      const loadedKeys = (remoteKeys ?? []) as PixKey[];
      setKeys(loadedKeys);
      let assignmentQuery = client.from("caixa_chaves").select("caixa_id,chave_id");
      if (accessMode === "cashier" && currentBox) assignmentQuery = assignmentQuery.eq("caixa_id", currentBox.id);
      const { data: assignmentRows, error: assignmentError } = await assignmentQuery;
      if (cancelled) return;
      if (assignmentError) {
        setMessage(`Não foi possível carregar as chaves vinculadas aos caixas: ${assignmentError.message}`);
        setHistory([]);
        setDataLoaded(true);
        setLoading(false);
        return;
      }
      const assignments = (assignmentRows ?? []).reduce<Record<string, string[]>>((result, row) => {
        const caixaId = String(row.caixa_id);
        result[caixaId] ??= [];
        result[caixaId].push(String(row.chave_id));
        return result;
      }, {});
      setCashboxKeyAssignments(assignments);
      if (currentBox && detailBox?.id === currentBox.id && cashboxKeyDraftBoxId !== currentBox.id) {
        setCashboxKeyDraftIds(assignments[currentBox.id] ?? []);
        setCashboxKeyDraftBoxId(currentBox.id);
      }
      setBackendOnline(true);
      const activeBoxKeyIds = currentBox ? assignments[currentBox.id] ?? [] : [];
      setSelectedKeyId((current) =>
        loadedKeys.some((key) => key.id === current)
          && (adminPanel || activeBoxKeyIds.includes(current))
          ? current
          : loadedKeys.find((key) => key.ativa && (adminPanel || activeBoxKeyIds.includes(key.id)))?.id
            ?? loadedKeys.find((key) => adminPanel || activeBoxKeyIds.includes(key.id))?.id
            ?? "",
      );
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(loadedKeys));

      if (accessMode === "owner") {
        const { data: settings, error: settingsError } = await client
          .from("configuracoes_sistema")
          .select("dias_retencao")
          .eq("id", 1)
          .maybeSingle();
        if (cancelled) return;
        if (settingsError) setMessage(`Não foi possível carregar o prazo de retenção: ${settingsError.message}`);
        else if (settings) setHistoryRetention(settings.dias_retencao);
      }

      const pageSize = 1000;
      const sessions: Record<string, unknown>[] = [];
      let sessionsError: Error | null = null;
      for (let offset = 0; ; offset += pageSize) {
        let sessionQuery = client
          .from("sessoes_caixa")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (accessMode === "cashier" && currentBox) sessionQuery = sessionQuery.eq("caixa_id", currentBox.id);
        else if (historyBoxId !== "all") sessionQuery = sessionQuery.eq("caixa_id", historyBoxId);
        if (historyKeyId !== "all") sessionQuery = sessionQuery.eq("chave_id", historyKeyId);
        if (historyFrom) {
          sessionQuery = sessionQuery.gte("created_at", new Date(`${historyFrom}T00:00:00`).toISOString());
        }
        if (historyTo) {
          const endDate = new Date(`${historyTo}T00:00:00`);
          endDate.setDate(endDate.getDate() + 1);
          sessionQuery = sessionQuery.lt("created_at", endDate.toISOString());
        }
        const { data: page, error } = await sessionQuery;
        if (cancelled) return;
        if (error) {
          sessionsError = new Error(error.message);
          break;
        }
        sessions.push(...(page ?? []));
        if (!page || page.length < pageSize) break;
      }

      if (sessionsError) {
        setMessage(`Não foi possível carregar o histórico remoto: ${sessionsError.message}`);
        setHistory([]);
      } else {
        const remoteHistory = sessions
          .filter((item) => item.status !== "cancelado")
          .map((item) => ({
          ...item,
          apelido: loadedKeys.find((key) => key.id === item.chave_id)?.apelido ?? "Chave Pix",
          })) as PixSession[];
        setHistory(remoteHistory);
        localStorage.setItem(HISTORY_STORAGE, JSON.stringify(remoteHistory));
      }

      if (!currentBox) {
        setActiveSession(null);
        setQrOpen(false);
        setDataLoaded(true);
        setLoading(false);
        return;
      }

      const { data: pendingData, error: pendingError } = await client
        .from("sessoes_caixa")
        .select("*")
        .eq("caixa_id", currentBox.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (pendingError) setMessage(`Não foi possível verificar a cobrança ativa: ${pendingError.message}`);
      else {
        const pending = pendingData
          ? { ...pendingData, apelido: loadedKeys.find((key) => key.id === pendingData.chave_id)?.apelido ?? "Chave Pix" } as PixSession
          : null;
        setActiveSession(pending);
        setQrOpen(Boolean(pending));
        if (pending) localStorage.setItem(activeSessionStorageKey(currentBox.id), JSON.stringify(pending));
        else localStorage.removeItem(activeSessionStorageKey(currentBox.id));
      }
      setDataLoaded(true);
      setLoading(false);
    }

    void withTimeout(
      loadRemoteData(),
      25000,
      "O Supabase demorou demais para carregar os dados do caixa. Verifique a conexão e tente novamente.",
    ).catch((error: unknown) => {
      console.error("Falha ao carregar dados do Supabase.", error);
      if (!cancelled) {
        cancelled = true;
        setKeys([]);
        setHistory([]);
        setActiveSession(null);
        setQrOpen(false);
        setDataLoaded(true);
        setLoading(false);
        setAccessError(error instanceof Error ? error.message : "Não foi possível conectar ao Supabase.");
        setAccessMode("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, accessMode, activeBox, detailBox?.id, historyBoxId, historyFrom, historyKeyId, historyTo]);

  const persistHistory = (next: PixSession[]) => {
    const sorted = next.filter((item) => item.status !== "cancelado").sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
    setHistory(sorted);
    try {
      const existing: PixSession[] = JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]");
      const preserved = activeBox
        ? existing.filter((item) => item.caixa_id !== activeBox.id)
        : [];
      const merged = new Map([...preserved, ...sorted]
        .filter((item) => item.status !== "cancelado")
        .map((item) => [item.id, item]));
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(
        Array.from(merged.values()).sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        ),
      ));
    } catch (error) {
      console.error("Não foi possível salvar o histórico local.", error);
      setMessage("A alteração foi salva, mas o navegador não conseguiu atualizar o histórico local.");
    }
  };

  const saveActiveSession = (session: PixSession | null) => {
    setActiveSession(session);
    try {
      const storageKey = activeBox ? activeSessionStorageKey(activeBox.id) : ACTIVE_SESSION_STORAGE;
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Não foi possível salvar a cobrança local.", error);
      setMessage("A cobrança foi atualizada, mas não foi possível sincronizar outra aba neste navegador.");
    }
  };

  const createCharge = async () => {
    if (!selectedKey || !parsedAmount || !activeBox || busy) {
      setMessage(operatorKeys.length === 0
        ? "Este caixa ainda não tem chaves Pix liberadas. Peça ao administrador para vincular uma chave."
        : "Escolha uma chave Pix e informe um valor válido.");
      return;
    }
    const previousSession = activeSession?.status === "pendente" ? activeSession : null;
    setBusy(true);
    setMessage("");
    let session: PixSession | null = null;
    let previousRemoved = false;
    try {
      const sessionId = crypto.randomUUID();
      const payload = buildPixPayload(selectedKey, parsedAmount, sessionId.replace(/-/g, "").slice(0, 25));
      const qr = await QRCode.toDataURL(payload, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      session = {
        id: sessionId,
        chave_id: selectedKey.id,
        caixa_id: activeBox.id,
        caixa_nome: activeBox.nome,
        valor: parsedAmount,
        payload_pix: payload,
        status: "pendente",
        created_at: new Date().toISOString(),
        apelido: selectedKey.apelido,
      };

      let nextHistory = history.filter((item) => item.status !== "cancelado");
      if (supabase) {
        const { data, error } = await supabase
          .from("sessoes_caixa")
          .insert({
            id: session.id,
            chave_id: session.chave_id,
            caixa_id: session.caixa_id,
            caixa_nome: session.caixa_nome,
            valor: session.valor,
            payload_pix: session.payload_pix,
            status: session.status,
          })
          .select()
          .single();
        if (error) throw new Error(`Não foi possível salvar a cobrança no Supabase: ${error.message}`);
        session = { ...data, apelido: selectedKey.apelido } as PixSession;

        if (previousSession) {
          const { data: deletedPrevious, error: deletePreviousError } = await supabase
            .from("sessoes_caixa")
            .delete()
            .eq("id", previousSession.id)
            .eq("status", "pendente")
            .select("id")
            .maybeSingle();
          if (deletePreviousError) {
            const { error: rollbackError } = await supabase
              .from("sessoes_caixa")
              .delete()
              .eq("id", session.id)
              .eq("status", "pendente");
            if (rollbackError) {
              saveActiveSession(session);
              setQrImage(qr);
              setQrOpen(true);
              persistHistory(withHistoryItem(nextHistory, session));
              throw new Error(`A cobrança nova foi criada, mas a anterior não pôde ser removida (${deletePreviousError.message}); a limpeza da nova também falhou (${rollbackError.message}). A nova cobrança permanece aberta.`);
            }
            throw new Error(`Não foi possível remover a cobrança anterior: ${deletePreviousError.message}`);
          }
          if (deletedPrevious) {
            previousRemoved = true;
          } else {
            const { data: currentPrevious, error: previousReadError } = await supabase
              .from("sessoes_caixa")
              .select("*")
              .eq("id", previousSession.id)
              .maybeSingle();
            if (previousReadError) throw new Error(`A cobrança anterior não foi removida nem pôde ser verificada: ${previousReadError.message}`);
            if (currentPrevious?.status === "pendente") {
              const { error: rollbackError } = await supabase
                .from("sessoes_caixa")
                .delete()
                .eq("id", session.id)
                .eq("status", "pendente");
              if (rollbackError) {
                saveActiveSession(session);
                setQrImage(qr);
                setQrOpen(true);
                persistHistory(withHistoryItem(nextHistory, session));
                throw new Error(`A cobrança anterior continua ativa e a nova não pôde ser removida (${rollbackError.message}). A nova cobrança permanece aberta.`);
              }
              throw new Error("A cobrança anterior continua ativa. Atualize a tela antes de tentar outra vez.");
            }
            if (currentPrevious?.status === "pago") {
              nextHistory = withHistoryItem(nextHistory, {
                ...currentPrevious,
                apelido: previousSession.apelido,
              } as PixSession);
            }
            previousRemoved = currentPrevious?.status !== "pago";
          }
        }
      } else if (previousSession) {
        previousRemoved = true;
      }

      if (previousRemoved && previousSession) {
        nextHistory = nextHistory.filter((item) => item.id !== previousSession.id);
      }
      saveActiveSession(session);
      setQrImage(qr);
      setQrOpen(true);
      persistHistory(withHistoryItem(nextHistory, session));
      setMessage("");
    } catch (error) {
      console.error("Falha ao criar cobrança Pix.", error);
      if (!session || !previousRemoved) {
        saveActiveSession(previousSession);
        setQrOpen(Boolean(previousSession));
        if (previousSession) {
          setQrImage(qrImage);
        }
      }
      setMessage(error instanceof Error ? error.message : "Erro ao gerar a cobrança.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!activeSession || activeSession.status !== "pendente" || busy) return;
    setBusy(true);
    try {
      let paid: PixSession = { ...activeSession, status: "pago" };
      if (supabase) {
        const { data, error } = await supabase
          .from("sessoes_caixa")
          .update({ status: "pago" })
          .eq("id", activeSession.id)
          .eq("status", "pendente")
          .select("*")
          .maybeSingle();
        if (error) throw new Error(`Não foi possível confirmar no Supabase: ${error.message}`);
        if (!data) throw new Error("O Supabase não confirmou a cobrança. Atualize o histórico antes de tentar novamente.");
        paid = { ...data, apelido: activeSession.apelido } as PixSession;
      }

      saveActiveSession(paid);
      persistHistory(withHistoryItem(history, paid));
      setAmountText("");
      setQrOpen(false);
      setNotice(supabase
        ? `Recebimento de ${formatCurrency(paid.valor)} confirmado e salvo no Supabase.`
        : `Recebimento de ${formatCurrency(paid.valor)} confirmado neste dispositivo.`);
    } catch (error) {
      console.error("Falha ao confirmar o pagamento.", error);
      setMessage(error instanceof Error ? error.message : "Erro ao confirmar o recebimento.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPaymentWithDialog = async () => {
    if (!activeSession || activeSession.status !== "pendente" || busy) return;
    const result = await Swal.fire({
      title: "Confirmar recebimento?",
      html: `Confirme que verificou o crédito de <strong>${formatCurrency(activeSession.valor)}</strong> no aplicativo bancário.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, recebido",
      cancelButtonText: "Voltar",
      confirmButtonColor: "#84cc16",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (result.isConfirmed) await confirmPayment();
  };

  const cancelCharge = async () => {
    if (!activeSession || activeSession.status !== "pendente" || busy) return;
    const pending = activeSession;
    setBusy(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("sessoes_caixa")
          .delete()
          .eq("id", pending.id)
          .eq("status", "pendente")
          .select("id")
          .maybeSingle();
        if (error) throw new Error(`Não foi possível remover a cobrança do Supabase: ${error.message}`);
        if (!data) {
          const { data: current, error: readError } = await supabase
            .from("sessoes_caixa")
            .select("status")
            .eq("id", pending.id)
            .maybeSingle();
          if (readError) {
            throw new Error(`Não foi possível verificar a cobrança no Supabase: ${readError.message}`);
          }
          if (current?.status === "pago") {
            throw new Error("Esta cobrança já foi confirmada como paga e não pode ser cancelada.");
          }
          if (current?.status === "pendente") {
            throw new Error("O banco ainda mantém a cobrança pendente. A permissão de cancelamento pode não estar aplicada no Supabase.");
          }
          throw new Error("Esta cobrança não foi encontrada no banco. Atualize a tela para sincronizar o caixa.");
        }
      }

      saveActiveSession(null);
      persistHistory(history.filter((item) => item.id !== pending.id && item.status !== "cancelado"));
      setQrImage("");
      setQrOpen(false);
      setAmountText("");
      setNotice("Cobrança cancelada e removida do histórico.");
    } catch (error) {
      console.error("Falha ao cancelar a cobrança.", error);
      saveActiveSession(pending);
      setQrOpen(true);
      setMessage(error instanceof Error ? error.message : "Erro ao cancelar a cobrança.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancelCharge = async () => {
    if (!activeSession || activeSession.status !== "pendente" || busy) return;
    const result = await Swal.fire({
      title: "Cancelar esta cobrança?",
      text: "O QR Code será fechado e a cobrança removida, sem registro no histórico.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, cancelar",
      cancelButtonText: "Continuar cobrança",
      confirmButtonColor: "#d97706",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (result.isConfirmed) await cancelCharge();
  };
  const saveKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keyDraft.apelido.trim() || !keyDraft.chave.trim() || !keyDraft.titular.trim()) {
      setMessage("Preencha apelido, chave Pix e titular.");
      return;
    }
    const isEditing = keys.some((key) => key.id === keyDraft.id);
    if (!isEditing && keys.length >= 10) {
      setMessage("O limite é de 10 chaves Pix.");
      return;
    }
    const keyToSave = { ...keyDraft, id: keyDraft.id || crypto.randomUUID() };
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("chaves_pix").upsert({
          id: keyToSave.id,
          apelido: keyToSave.apelido.trim(),
          tipo_chave: keyToSave.tipo_chave,
          chave: keyToSave.chave.trim(),
          titular: keyToSave.titular.trim(),
          cidade: keyToSave.cidade.trim() || "BRASILIA",
          ativa: keyToSave.ativa,
        });
        if (error) throw new Error(`Não foi possível salvar a chave: ${error.message}`);
      }
      const next = isEditing
        ? keys.map((key) => (key.id === keyToSave.id ? keyToSave : key))
        : [...keys, keyToSave];
      setKeys(next);
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
      setSelectedKeyId(keyToSave.id);
      setKeyDraft(freshKey());
      setMessage("Chave Pix salva.");
    } catch (error) {
      console.error("Falha ao salvar chave Pix.", error);
      setMessage(error instanceof Error ? error.message : "Erro ao salvar a chave Pix.");
    } finally {
      setBusy(false);
    }
  };

  const deletePixKey = async (key: PixKey) => {
    if (busy || (accessMode !== "owner" && accessMode !== "local")) return;
    const confirmation = await Swal.fire({
      title: `Apagar a chave "${key.apelido}"?`,
      text: "A chave será removida dos caixas. Se houver cobranças vinculadas, ela será mantida para preservar o histórico.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Apagar chave",
      cancelButtonText: "Manter chave",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    setBusy(true);
    setMessage("");
    try {
      if (accessMode === "local") {
        const localHistory: PixSession[] = JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]");
        if (localHistory.some((session) => session.chave_id === key.id)) {
          throw new Error("Esta chave tem cobranças no histórico e não pode ser apagada. O histórico foi preservado.");
        }
      }

      if (supabase) {
        const { data, error } = await supabase
          .from("chaves_pix")
          .delete()
          .eq("id", key.id)
          .select("id")
          .maybeSingle();
        if (error?.code === "23503") {
          throw new Error("Esta chave tem cobranças no histórico e não pode ser apagada. O histórico foi preservado.");
        }
        if (error) throw new Error(`Não foi possível apagar a chave: ${error.message}`);
        if (!data) throw new Error("A chave não foi encontrada ou você não tem permissão para apagá-la.");
      }

      const nextKeys = keys.filter((item) => item.id !== key.id);
      setKeys(nextKeys);
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(nextKeys));
      setCashboxKeyAssignments((current) => {
        const nextAssignments = Object.fromEntries(
          Object.entries(current).map(([boxId, keyIds]) => [boxId, keyIds.filter((id) => id !== key.id)]),
        );
        if (!supabase) localStorage.setItem(BOX_KEY_ASSIGNMENTS_STORAGE, JSON.stringify(nextAssignments));
        return nextAssignments;
      });
      if (selectedKeyId === key.id) {
        setSelectedKeyId(nextKeys.find((item) => item.ativa)?.id ?? nextKeys[0]?.id ?? "");
      }
      if (keyDraft.id === key.id) setKeyDraft(freshKey());
      setNotice(`Chave "${key.apelido}" apagada.`);
    } catch (error) {
      console.error("Falha ao apagar chave Pix.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível apagar a chave Pix.");
    } finally {
      setBusy(false);
    }
  };

  const setKeyActive = async (key: PixKey) => {
    if (accessMode !== "owner" && accessMode !== "local") return;
    const next = keys.map((item) => ({ ...item, ativa: item.id === key.id }));
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("chaves_pix").upsert(next);
        if (error) throw new Error(`Não foi possível atualizar a chave ativa: ${error.message}`);
      }
      setKeys(next);
      setSelectedKeyId(key.id);
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
      setMessage(`Chave "${key.apelido}" selecionada.`);
    } catch (error) {
      console.error("Falha ao atualizar a chave ativa.", error);
      setMessage(error instanceof Error ? error.message : "Erro ao atualizar a chave ativa.");
    } finally {
      setBusy(false);
    }
  };

  const saveRetention = async (days: number) => {
    setBusy(true);
    try {
      if (supabase && accessMode === "owner") {
        const { error } = await supabase.rpc("set_history_retention", { p_days: days });
        if (error) throw new Error(`Não foi possível salvar o prazo no Supabase: ${error.message}`);
        setHistoryRetention(days);
      } else {
        const expiresAt = Date.now() - days * 24 * 60 * 60 * 1000;
        const allLocalHistory: PixSession[] = JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]");
        const retained = allLocalHistory.filter((item) => new Date(item.created_at).getTime() >= expiresAt);
        persistHistory(retained);
        setRetentionDays(days);
        localStorage.setItem(RETENTION_STORAGE, String(days));
      }
      setNotice(`Retenção automática definida para ${days} dias.`);
    } catch (error) {
      console.error("Falha ao atualizar a retenção do histórico.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a retenção.");
    } finally {
      setBusy(false);
    }
  };

  const cashboxLink = (box: CashRegister, token: string) => {
    const url = new URL("/caixa", window.location.origin);
    url.searchParams.set("caixa", box.id);
    url.searchParams.set("acesso", token);
    return url.toString();
  };

  const customerLink = (box: CashRegister, token: string) => {
    const url = new URL("/display", window.location.origin);
    url.searchParams.set("caixa", box.id);
    url.searchParams.set("acesso", token);
    return url.toString();
  };

  const generateCustomerDisplayLink = async (box: CashRegister) => {
    if (!supabase || accessMode !== "owner" || busy) return;
    setBusy(true);
    try {
      const token = createCashboxToken();
      const { error } = await supabase.rpc("save_cashbox_display_link", {
        p_box_id: box.id,
        p_display_token: token,
      });
      if (error) throw new Error(`Não foi possível gerar o link do cliente: ${error.message}`);
      setCustomerDisplayLink({ url: customerLink(box, token), boxId: box.id });
      setDisplayLinkLoadState("ready");
      setNotice(`Link da tela do cliente gerado para ${box.nome}.`);
    } catch (error) {
      console.error("Falha ao gerar o link da tela do cliente.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o link do cliente.");
    } finally {
      setBusy(false);
    }
  };

  const createCashbox = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = boxName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const token = createCashboxToken();
      let box: CashRegister;
      if (supabase && accessMode === "owner") {
        const { data, error } = await supabase.rpc("create_cashbox", { p_nome: name, p_access_token: token });
        if (error) throw new Error(`Não foi possível criar o caixa: ${error.message}`);
        box = data as CashRegister;
      } else {
        box = { id: crypto.randomUUID(), nome: name, ativo: true, created_at: new Date().toISOString() };
      }
      const next = [...boxes, box];
      setBoxes(next);
      if (!supabase) localStorage.setItem(BOXES_STORAGE, JSON.stringify(next));
      const defaultKeyIds: string[] = [];
      setCashboxKeyDraftIds(defaultKeyIds);
      setCashboxKeyDraftBoxId(supabase ? null : box.id);
      setCashboxKeyAssignments((current) => {
        const updated = { ...current, [box.id]: defaultKeyIds };
        if (!supabase) localStorage.setItem(BOX_KEY_ASSIGNMENTS_STORAGE, JSON.stringify(updated));
        return updated;
      });
      setActiveBox(box);
      localStorage.setItem(ACTIVE_BOX_STORAGE, box.id);
      setBoxName("");
      setDetailBox(box);
      setDetailSection("keys");
      setMenuTab("box_detail");
      const newLink = {
        name: box.nome,
        cashbox: cashboxLink(box, token),
        boxId: box.id,
      };
      setGeneratedLinks(newLink);
      setCashboxLinkLoadState("ready");
      setCustomerDisplayLink(null);
      setDisplayLinkLoadState("missing");
      if (!supabase) {
        const savedLinks = JSON.parse(localStorage.getItem(BOX_LINKS_STORAGE) || "{}") as Record<string, string>;
        localStorage.setItem(BOX_LINKS_STORAGE, JSON.stringify({ ...savedLinks, [box.id]: token }));
      }
      setNotice(`Caixa "${box.nome}" criado.`);
    } catch (error) {
      console.error("Falha ao criar caixa.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o caixa.");
    } finally {
      setBusy(false);
    }
  };

  const rotateCashboxLink = async (box: CashRegister) => {
    if (!supabase || accessMode !== "owner" || busy) return;
    const confirmation = await Swal.fire({
      title: "Gerar outro link?",
      html: "O link atual será revogado imediatamente. O novo ficará salvo nos detalhes deste caixa; copie-o e envie ao operador.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Gerar novo link",
      cancelButtonText: "Manter link atual",
      confirmButtonColor: "#84cc16",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    setBusy(true);
    try {
      const token = createCashboxToken();
      const { error } = await supabase.rpc("rotate_cashbox_link", { p_box_id: box.id, p_access_token: token });
      if (error) throw new Error(`Não foi possível renovar o link: ${error.message}`);
      setGeneratedLinks({
        name: box.nome,
        cashbox: cashboxLink(box, token),
        boxId: box.id,
      });
      setCashboxLinkLoadState("ready");
      setNotice(`Link de "${box.nome}" renovado. O link anterior foi revogado.`);
    } catch (error) {
      console.error("Falha ao renovar link do caixa.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível renovar o link.");
    } finally {
      setBusy(false);
    }
  };

  const archiveCashbox = async (box: CashRegister) => {
    if (busy) return;
    const confirmation = await Swal.fire({
      title: `Arquivar ${box.nome}?`,
      text: "O link será revogado e cobranças pendentes serão apagadas. Pagamentos confirmados continuam disponíveis para auditoria.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, arquivar",
      cancelButtonText: "Manter caixa",
      confirmButtonColor: "#84cc16",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    setBusy(true);
    try {
      if (supabase && accessMode === "owner") {
        const { error } = await supabase.rpc("archive_cashbox", { p_box_id: box.id });
        if (error) throw new Error(`Não foi possível arquivar o caixa: ${error.message}`);
      }
      const archived = { ...box, ativo: false };
      const next = boxes.map((item) => item.id === box.id ? archived : item);
      setBoxes(next);
      setDetailBox((current) => current?.id === box.id ? archived : current);
      if (!supabase) localStorage.setItem(BOXES_STORAGE, JSON.stringify(next));
      const currentHistory: PixSession[] = supabase
        ? history
        : JSON.parse(localStorage.getItem(HISTORY_STORAGE) || "[]");
      const archivedHistory = currentHistory.filter(
        (item) => !(item.caixa_id === box.id && item.status === "pendente") && item.status !== "cancelado",
      );
      setHistory(archivedHistory);
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(archivedHistory));
      localStorage.removeItem(activeSessionStorageKey(box.id));
      if (activeSession?.caixa_id === box.id) {
        setActiveSession(null);
        setQrOpen(false);
      }
      if (activeBox?.id === box.id) {
        const replacement = next.find((item) => item.ativo) ?? null;
        setActiveBox(replacement);
        if (replacement) localStorage.setItem(ACTIVE_BOX_STORAGE, replacement.id);
      }
      setGeneratedLinks(null);
      setCashboxLinkLoadState("missing");
      setCustomerDisplayLink(null);
      setDisplayLinkLoadState("missing");
      if (!supabase) {
        const savedLinks = JSON.parse(localStorage.getItem(BOX_LINKS_STORAGE) || "{}") as Record<string, string>;
        delete savedLinks[box.id];
        localStorage.setItem(BOX_LINKS_STORAGE, JSON.stringify(savedLinks));
      }
      setNotice(`Caixa "${box.nome}" arquivado. Os pagamentos confirmados foram preservados.`);
    } catch (error) {
      console.error("Falha ao arquivar caixa.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível arquivar o caixa.");
    } finally {
      setBusy(false);
    }
  };

  const deleteCashbox = async (box: CashRegister) => {
    if (busy) return;
    const confirmation = await Swal.fire({
      title: `Remover ${box.nome}?`,
      html: "O link será revogado e o caixa sairá da lista de operação. Cobranças pendentes serão apagadas; <strong>pagamentos confirmados serão preservados</strong> para auditoria.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, remover caixa",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#475569",
      background: "#171e1a",
      color: "#f8fafc",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    setBusy(true);
    try {
      if (supabase && accessMode === "owner") {
        const { error } = await supabase.rpc("delete_cashbox", { p_box_id: box.id });
        if (error) throw new Error(`Não foi possível remover o caixa: ${error.message}`);
      }
      const removed = { ...box, ativo: false, excluido: true };
      const next = boxes.map((item) => item.id === box.id ? removed : item);
      setBoxes(next);
      setDetailBox((current) => current?.id === box.id ? removed : current);
      if (!supabase) localStorage.setItem(BOXES_STORAGE, JSON.stringify(next));
      const removedPending = history.filter(
        (item) => !(item.caixa_id === box.id && item.status === "pendente") && item.status !== "cancelado",
      );
      setHistory(removedPending);
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(removedPending));
      localStorage.removeItem(activeSessionStorageKey(box.id));
      if (activeSession?.caixa_id === box.id) {
        setActiveSession(null);
        setQrOpen(false);
      }
      if (activeBox?.id === box.id) {
        const replacement = next.find((item) => item.ativo) ?? null;
        setActiveBox(replacement);
        if (replacement) localStorage.setItem(ACTIVE_BOX_STORAGE, replacement.id);
      }
      setGeneratedLinks(null);
      setCashboxLinkLoadState("missing");
      setCustomerDisplayLink(null);
      setDisplayLinkLoadState("missing");
      if (!supabase) {
        const savedLinks = JSON.parse(localStorage.getItem(BOX_LINKS_STORAGE) || "{}") as Record<string, string>;
        delete savedLinks[box.id];
        localStorage.setItem(BOX_LINKS_STORAGE, JSON.stringify(savedLinks));
      }
      setNotice(`Caixa "${box.nome}" removido; os pagamentos confirmados foram preservados.`);
    } catch (error) {
      console.error("Falha ao remover caixa.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível remover o caixa.");
    } finally {
      setBusy(false);
    }
  };

  const auditCashbox = (box: CashRegister) => {
    setHistoryBoxId(box.id);
    setMenuTab("history");
  };

  const openCashboxDetails = (box: CashRegister) => {
    setDetailBox(box);
    setDetailSection("keys");
    setCashboxKeyDraftIds(cashboxKeyAssignments[box.id] ?? (supabase ? [] : keys.map((key) => key.id)));
    setCashboxKeyDraftBoxId(box.id);
    setGeneratedLinks(null);
    setCashboxLinkLoadState("loading");
    setCustomerDisplayLink(null);
    setDisplayLinkLoadState("loading");
    setMenuTab("box_detail");
    if (!supabase) {
      const savedLinks = JSON.parse(localStorage.getItem(BOX_LINKS_STORAGE) || "{}") as Record<string, string>;
      const token = savedLinks[box.id];
      setGeneratedLinks(token ? { name: box.nome, cashbox: cashboxLink(box, token), boxId: box.id } : null);
      setCashboxLinkLoadState(token ? "ready" : "missing");
      setDisplayLinkLoadState("missing");
      return;
    }
    if (accessMode !== "owner") {
      setCashboxLinkLoadState("missing");
      setDisplayLinkLoadState("missing");
      return;
    }
    void supabase
      .from("caixa_display_links")
      .select("display_token")
      .eq("caixa_id", box.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Falha ao carregar o link da tela do cliente.", error);
          setDisplayLinkLoadState("error");
          setMessage(`Não foi possível carregar o link do cliente: ${error.message}`);
          return;
        }
        if (!data?.display_token) {
          setDisplayLinkLoadState("missing");
          return;
        }
        setCustomerDisplayLink({ url: customerLink(box, data.display_token), boxId: box.id });
        setDisplayLinkLoadState("ready");
      });
    void supabase
      .from("caixa_links")
      .select("access_token")
      .eq("caixa_id", box.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Falha ao carregar o link salvo do caixa.", error);
          setCashboxLinkLoadState("missing");
          setMessage(`Não foi possível carregar o link salvo: ${error.message}`);
          return;
        }
        if (!data?.access_token) {
          setCashboxLinkLoadState("missing");
          return;
        }
        setGeneratedLinks({
          name: box.nome,
          cashbox: cashboxLink(box, data.access_token),
          boxId: box.id,
        });
        setCashboxLinkLoadState("ready");
      });
  };

  const saveCashboxKeys = async () => {
    if (!detailBox || busy || (accessMode !== "owner" && accessMode !== "local")) return;
    setBusy(true);
    try {
      const uniqueKeyIds = Array.from(new Set(cashboxKeyDraftIds));
      if (supabase && accessMode === "owner") {
        const { error } = await supabase.rpc("set_cashbox_pix_keys", {
          p_box_id: detailBox.id,
          p_key_ids: uniqueKeyIds,
        });
        if (error) throw new Error(`Não foi possível salvar as chaves do caixa: ${error.message}`);
      }
      const updated = { ...cashboxKeyAssignments, [detailBox.id]: uniqueKeyIds };
      setCashboxKeyAssignments(updated);
      setCashboxKeyDraftIds(uniqueKeyIds);
      if (!supabase) localStorage.setItem(BOX_KEY_ASSIGNMENTS_STORAGE, JSON.stringify(updated));
      if (activeBox?.id === detailBox.id && !uniqueKeyIds.includes(selectedKeyId)) {
        const firstKey = keys.find((key) => uniqueKeyIds.includes(key.id));
        setSelectedKeyId(firstKey?.id ?? "");
      }
      setNotice(uniqueKeyIds.length
        ? `${uniqueKeyIds.length} chave(s) liberada(s) para ${detailBox.nome}.`
        : `Nenhuma chave Pix está liberada para ${detailBox.nome}.`);
    } catch (error) {
      console.error("Falha ao salvar as chaves permitidas do caixa.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as chaves do caixa.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Link copiado.");
    } catch (error) {
      console.error("Falha ao copiar link.", error);
      setMessage("Não foi possível copiar automaticamente. Selecione e copie o link exibido.");
    }
  };

  const submitOwnerAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    setAuthFeedback("");
    setAuthFeedbackIsError(false);
    try {
      const email = authEmail.trim().toLowerCase();
      if (accessMode === "setup") {
        const response = await fetch("/api/admin/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupKey, email, password: authPassword }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível criar o administrador.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
      if (error) {
        const detail = error.message.toLowerCase().includes("invalid login credentials")
          ? "O Supabase não aceitou esse e-mail e senha. Confira se o e-mail é exatamente o da conta ADM deste projeto. A senha foi enviada sem alterações."
          : `Não foi possível entrar: ${error.message}`;
        throw new Error(detail);
      }
      if (adminPanel) {
        const { data: isAdmin, error: adminError } = await supabase.rpc("is_app_admin");
        if (adminError) throw new Error(`A senha está correta, mas não foi possível verificar o perfil ADM: ${adminError.message}`);
        if (!isAdmin) {
          await supabase.auth.signOut();
          throw new Error("Esse e-mail e senha são válidos, mas essa conta não está registrada como administradora neste projeto Supabase. Confira se o app está conectado ao projeto onde o ADM foi criado.");
        }
      }
      window.location.assign(adminPanel ? "/adm" : "/caixa");
    } catch (error) {
      console.error("Falha na autenticação do proprietário.", error);
      setAuthFeedback(error instanceof Error ? error.message : "Não foi possível autenticar.");
      setAuthFeedbackIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    setAuthFeedback("");
    setAuthFeedbackIsError(false);
    try {
      const redirectTo = new URL("/adm?redefinir-senha=1", window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim().toLowerCase(), { redirectTo });
      if (error) throw new Error(`Não foi possível enviar o e-mail de recuperação: ${error.message}`);
      setAuthFeedback("Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha.");
    } catch (error) {
      console.error("Falha ao solicitar redefinição de senha.", error);
      setAuthFeedback(error instanceof Error ? error.message : "Não foi possível solicitar a redefinição da senha.");
      setAuthFeedbackIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const updateOwnerPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    if (newPassword.length < 12) {
      setAuthFeedback("A nova senha deve ter pelo menos 12 caracteres.");
      setAuthFeedbackIsError(true);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthFeedback("As senhas não conferem.");
      setAuthFeedbackIsError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setAuthFeedback("");
    setAuthFeedbackIsError(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(`Não foi possível atualizar a senha: ${error.message}`);
      window.location.replace("/adm");
    } catch (error) {
      console.error("Falha ao atualizar a senha do proprietário.", error);
      setAuthFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
      setAuthFeedbackIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const updateProfilePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    if (profilePassword.length < 12) {
      setMessage("A nova senha deve ter pelo menos 12 caracteres.");
      return;
    }
    if (profilePassword !== confirmProfilePassword) {
      setMessage("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: profilePassword });
      if (error) throw new Error(`Não foi possível atualizar a senha: ${error.message}`);
      setProfilePassword("");
      setConfirmProfilePassword("");
      setNotice("Senha do administrador atualizada.");
    } catch (error) {
      console.error("Falha ao atualizar a senha pelo perfil do proprietário.", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(`Não foi possível sair: ${error.message}`);
      return;
    }
    window.location.assign(adminPanel ? "/adm" : "/caixa");
  };

  if (ownerAuthView === "reset_password") {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
        <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[470px]" />
        <section className="relative w-full max-w-md rounded-3xl border border-white/[.08] bg-panel/90 p-6 shadow-2xl sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-xl font-black text-ink shadow-glow">M</div>
            <div><p className="text-sm font-bold">Mercado Alternativo</p><p className="text-xs text-white/40">REDEFINIÇÃO DE SENHA</p></div>
          </div>
          <h1 className="text-2xl font-semibold">Criar nova senha</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">Escolha uma senha nova com pelo menos 12 caracteres.</p>
          <form onSubmit={updateOwnerPassword} className="mt-6 space-y-4">
            <label className="block text-sm text-white/65">Nova senha
              <input required type="password" minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm text-white/65">Confirmar nova senha
              <input required type="password" minLength={12} autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className={inputClass} />
            </label>
            <button disabled={busy} className="w-full rounded-xl bg-lime px-4 py-3.5 font-bold text-ink disabled:opacity-50">{busy ? "Salvando..." : "Salvar nova senha"}</button>
          </form>
        </section>
      </main>
    );
  }

  if (
    accessMode === "checking" ||
    ((accessMode === "owner" || accessMode === "cashier" || accessMode === "local") && !dataLoaded)
  ) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="text-sm text-white/55">Abrindo Mercado Alternativo...</p>
      </main>
    );
  }

  if (accessMode === "error") {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
        <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[470px]" />
        <section className="relative w-full max-w-md rounded-3xl border border-white/[.08] bg-panel/90 p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-xl font-black text-ink shadow-glow">M</div>
            <div><p className="text-sm font-bold">Mercado Alternativo</p><p className="text-xs text-white/40">CONEXÃO INDISPONÍVEL</p></div>
          </div>
          <h1 className="text-xl font-semibold">Não foi possível abrir o sistema</h1>
          <p role="alert" className="mt-3 rounded-xl border border-red-300/15 bg-red-300/[.04] p-3 text-sm leading-6 text-red-100/80">
            {accessError || "Verifique sua conexão e tente novamente."}
          </p>
          <p className="mt-4 text-xs leading-5 text-white/40">No celular, o login do Supabase fica salvo por endereço. Se o domínio temporário do túnel mudou, abra o endereço atual com <code className="text-white/65">/adm</code> e entre novamente. Se a mensagem acima indicar falta de configuração, o servidor precisa receber as variáveis públicas do Supabase e ser reconstruído.</p>
          <button onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl bg-lime px-4 py-3.5 font-bold text-ink">
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  if (accessMode === "setup" || accessMode === "login" || accessMode === "link_required") {
    const ownerForm = accessMode === "setup" || accessMode === "login";
    const forgotPassword = accessMode === "login" && ownerAuthView === "forgot_password";
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
        <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[470px]" />
        <section className="relative w-full max-w-md rounded-3xl border border-white/[.08] bg-panel/90 p-6 shadow-2xl sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-xl font-black text-ink shadow-glow">M</div>
            <div><p className="text-sm font-bold">Mercado Alternativo</p><p className="text-xs text-white/40">ACESSO DO PROPRIETÁRIO</p></div>
          </div>
          {ownerForm ? (
            <>
              {forgotPassword ? (
                <>
                  <h1 className="text-2xl font-semibold">Recuperar acesso</h1>
                  <p className="mt-2 text-sm leading-6 text-white/45">Informe o e-mail do proprietário. Enviaremos um link para criar uma nova senha.</p>
                  <form onSubmit={requestPasswordReset} className="mt-6 space-y-4">
                    <label className="block text-sm text-white/65">E-mail do proprietário
                      <input required type="email" autoComplete="username" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className={inputClass} />
                    </label>
                    {authFeedback && <p role={authFeedbackIsError ? "alert" : "status"} className={`rounded-xl border p-3 text-sm leading-5 ${authFeedbackIsError ? "border-red-300/15 bg-red-300/[.04] text-red-100/85" : "border-lime/15 bg-lime/[.04] text-lime/90"}`}>{authFeedback}</p>}
                    <button disabled={busy} className="w-full rounded-xl bg-lime px-4 py-3.5 font-bold text-ink disabled:opacity-50">{busy ? "Enviando..." : "Enviar link de recuperação"}</button>
                  </form>
                  <button type="button" onClick={() => { setOwnerAuthView("sign_in"); setAuthFeedback(""); setAuthFeedbackIsError(false); setMessage(""); }} className="mt-4 text-sm text-lime/80 hover:text-lime">Voltar para o login</button>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold">{accessMode === "setup" ? "Configuração inicial" : "Entrar no painel ADM"}</h1>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {accessMode === "setup"
                      ? "Crie a conta do dono. Este cadastro inicial só pode ser feito uma vez."
                      : "Entre com o e-mail e a senha da conta de administrador já cadastrada."}
                  </p>
                  <form onSubmit={submitOwnerAccess} className="mt-6 space-y-4">
                    {accessMode === "setup" && (
                      <>
                        <label className="block text-sm text-white/65">Código de configuração inicial
                          <input required type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} className={inputClass} />
                        </label>
                        <p className="rounded-xl border border-amber-200/10 bg-amber-200/[.03] p-3 text-xs leading-5 text-amber-100/65">
                          A criação inicial também exige a chave secreta administrativa do Supabase configurada somente no servidor. A chave pública e o código inicial não substituem esse segredo.
                        </p>
                      </>
                    )}
                    <label className="block text-sm text-white/65">E-mail do proprietário
                      <input required type="email" autoComplete="username" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className={inputClass} />
                    </label>
                    <label className="block text-sm text-white/65">Senha (mínimo 12 caracteres)
                      <input required type="password" minLength={accessMode === "setup" ? 12 : undefined} autoComplete={accessMode === "setup" ? "new-password" : "current-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} className={inputClass} />
                    </label>
                    {accessMode === "login" && (
                      <button type="button" onClick={() => { setOwnerAuthView("forgot_password"); setAuthFeedback(""); setAuthFeedbackIsError(false); setMessage(""); }} className="block text-left text-xs text-lime/80 hover:text-lime">
                        Esqueci minha senha
                      </button>
                    )}
                    {authFeedback && <p role={authFeedbackIsError ? "alert" : "status"} className={`rounded-xl border p-3 text-sm leading-5 ${authFeedbackIsError ? "border-red-300/15 bg-red-300/[.04] text-red-100/85" : "border-lime/15 bg-lime/[.04] text-lime/90"}`}>{authFeedback}</p>}
                    {!adminPanel && accessMode === "login" && <a href="/adm" className="block text-xs text-lime/80 hover:text-lime">Abrir painel Mercado Alternativo ADM</a>}
                    <button disabled={busy} className="w-full rounded-xl bg-lime px-4 py-3.5 font-bold text-ink disabled:opacity-50">{busy ? "Aguarde..." : accessMode === "setup" ? "Criar conta do proprietário" : "Entrar no ADM"}</button>
                  </form>
                  {accessMode === "login" && canSetupOwner && (
                    <button
                      type="button"
                      onClick={() => { setAccessMode("setup"); setOwnerAuthView("sign_in"); setAuthFeedback(""); setAuthFeedbackIsError(false); setMessage(""); }}
                      className="mt-4 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/75 transition hover:border-lime/30 hover:text-white"
                    >
                      Primeira configuração: criar conta ADM
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Link do caixa necessário</h1>
              <p className="mt-2 text-sm leading-6 text-white/45">Abra o link secreto criado pelo proprietário para vincular este aparelho ao terminal. Não é necessário digitar usuário ou senha.</p>
              <button onClick={() => void signOut()} className="mt-6 w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/65">Trocar de sessão</button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-8 sm:py-8">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[470px]" />
      <div className={adminPanel ? "hidden" : "relative mx-auto max-w-xl"}>
        <header className="mb-6 flex items-center justify-between">
          <a href="/caixa" className="flex items-center gap-3" aria-label="Mercado Alternativo, caixa">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-xl font-black text-ink shadow-glow">M</div>
            <div>
              <p className="text-sm font-bold tracking-wide">Mercado Alternativo</p>
              <p className="text-xs text-white/40">CAIXA PIX</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            {accessMode === "owner" && (
              <select
                aria-label="Selecionar caixa"
                value={activeBox?.id ?? ""}
                onChange={(event) => {
                  const next = boxes.find((box) => box.id === event.target.value);
                  if (next) setActiveBox(next);
                }}
                className="max-w-40 rounded-xl border border-white/10 bg-[#111714] px-3 py-2.5 text-xs text-white/80 outline-none focus:border-lime/50"
              >
                {boxes.filter((box) => box.ativo).map((box) => <option key={box.id} value={box.id}>{box.nome}</option>)}
              </select>
            )}
            <button
              onClick={() => { setMenuTab("menu"); setMenuOpen(true); }}
              aria-label="Abrir menu"
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-xl text-white/75 transition hover:border-lime/40 hover:text-white"
            >
              ☰
            </button>
          </div>
        </header>

        {activeBox && <p className="mb-3 text-center text-xs text-white/35">{activeBox.nome}</p>}
        <section className="rounded-3xl border border-white/[.08] bg-panel/85 p-5 shadow-2xl backdrop-blur sm:p-8">
          <label className="block text-sm font-medium text-white/75" htmlFor="pix-key">Chave Pix</label>
          <select
            id="pix-key"
            value={selectedKeyId}
            onChange={(event) => setSelectedKeyId(event.target.value)}
            disabled={loading || operatorKeys.length === 0}
            className={inputClass}
          >
            {operatorKeys.length === 0 && <option value="">{loading ? "Carregando chaves..." : keys.length ? "Nenhuma chave liberada para este caixa" : "Cadastre uma chave no painel ADM"}</option>}
            {operatorKeys.map((key) => <option key={key.id} value={key.id}>{key.apelido} · {key.tipo_chave}</option>)}
          </select>

          <label className="mt-6 block text-sm font-medium text-white/75" htmlFor="amount">Valor da venda</label>
          <div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-[#111714] px-4 focus-within:border-lime/60">
            <span className="text-xl text-white/40">R$</span>
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              className="w-full bg-transparent px-3 py-4 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/20"
            />
          </div>

          <button
            disabled={busy || loading || !parsedAmount || !selectedKey || !activeBox}
            onClick={createCharge}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 py-4 font-bold text-ink transition hover:bg-[#d2ff7c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Processando..." : "Gerar QR Code"} <span className="text-lg">→</span>
          </button>

        </section>

        <footer className="py-6 text-center text-xs text-white/25">Mercado Alternativo</footer>
      </div>

      {!adminPanel && qrOpen && activeSession?.status === "pendente" && (
        <section className="fixed inset-0 z-30 flex min-h-[100dvh] flex-col items-center overflow-y-auto bg-ink px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-center" aria-label="Cobrança Pix ativa">
          <button
            onClick={() => void confirmCancelCharge()}
            aria-label="Fechar QR Code"
            className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[.06] text-2xl text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            ×
          </button>
          <div className="mb-3 mt-2 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-lg font-black text-ink">M</div>
            <p className="text-sm font-bold">Mercado Alternativo</p>
          </div>
          <p className="text-xs font-semibold tracking-[.18em] text-lime">AGUARDANDO PAGAMENTO</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(activeSession.valor)}</p>
          <p className="mt-1 text-xs text-white/40">{activeSession.apelido}</p>
          <div className="my-4 grid w-full flex-1 place-items-center">
            <div className="w-full max-w-[min(76vw,52vh,440px)] rounded-2xl bg-white p-2 shadow-glow">
              {qrImage
                ? <img src={qrImage} alt={`QR Code Pix de ${formatCurrency(activeSession.valor)}`} className="aspect-square w-full" />
                : <div className="grid aspect-square place-items-center text-sm text-black/50">Preparando QR Code...</div>}
            </div>
          </div>
          <div className="w-full max-w-md pb-[max(.5rem,env(safe-area-inset-bottom))]">
            <button onClick={() => void confirmPaymentWithDialog()} disabled={busy} className="w-full rounded-xl bg-lime px-4 py-3.5 font-bold text-ink transition hover:bg-[#d2ff7c] disabled:opacity-50">
              Confirmar recebimento
            </button>
            <p className="mt-2 text-xs text-white/35">Confirme somente após verificar o crédito no banco.</p>
          </div>
        </section>
      )}

      {menuOpen && (
        <div
          className={adminPanel
            ? "fixed inset-0 z-40 bg-ink"
            : "fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm"}
          onMouseDown={(event) => {
            if (!adminPanel && event.target === event.currentTarget) setMenuOpen(false);
          }}
        >
          <aside className={adminPanel
            ? "mx-auto h-full w-full max-w-5xl overflow-y-auto bg-ink px-4 py-6 sm:px-8"
            : "h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#171e1a] p-5 sm:p-8"}>
            {adminPanel && (
              <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-lime/20 bg-[radial-gradient(ellipse_at_top_right,rgba(197,243,107,.18),transparent_55%),linear-gradient(135deg,#1b2820,#111714)] p-6 shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:p-9">
                <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-lime/10" />
                <div className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 rounded-full border border-lime/10" />
                <div className="relative flex items-center gap-4 sm:gap-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] border border-lime/30 bg-lime text-3xl font-black text-ink shadow-[0_0_45px_rgba(197,243,107,.22)] sm:h-20 sm:w-20 sm:text-4xl">M</div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[.28em] text-lime/75 sm:text-xs">PAINEL DO PROPRIETÁRIO</p>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">Mercado <span className="text-lime">Alternativo</span></h1>
                    <p className="mt-2 text-xs text-white/50 sm:text-sm">Gestão e auditoria central. As cobranças são feitas somente pelos operadores nos caixas.</p>
                  </div>
                </div>
                <div className="relative mt-6 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-lime/15 bg-black/20 px-3 py-1.5 text-white/70">{boxes.filter((box) => box.ativo).length} caixas ativos</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/55">{keys.length} chaves Pix cadastradas</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/55">{backendOnline ? "Sincronizado com Supabase" : "Dados locais deste navegador"}</span>
                </div>
              </section>
            )}
            <div className="mb-6 flex items-center justify-between">
              <div>
                {!adminPanel && <p className="text-xs font-semibold tracking-[.2em] text-lime">MERCADO ALTERNATIVO</p>}
                <h2 className={`${adminPanel ? "text-xs font-semibold tracking-[.2em] text-white/40" : "mt-2 text-2xl font-semibold"}`}>
                  {adminPanel
                    ? menuTab === "history" ? "AUDITORIA DE VENDAS" : menuTab === "keys" ? "CHAVES PIX" : menuTab === "box_detail" ? "DETALHES DO CAIXA" : menuTab === "boxes" ? "GESTÃO DE CAIXAS" : menuTab === "profile" ? "PERFIL DO ADMINISTRADOR" : "CENTRAL DE ADMINISTRAÇÃO"
                    : menuTab === "history" ? "Histórico" : menuTab === "keys" ? "Chaves Pix" : menuTab === "box_detail" ? "Detalhes do caixa" : menuTab === "boxes" ? "Caixas" : "Menu"}
                </h2>
              </div>
              <button
                onClick={() => adminPanel ? window.location.assign("/adm") : setMenuOpen(false)}
                aria-label={adminPanel ? "Ir ao início do painel ADM" : "Fechar menu"}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65"
              >
                {adminPanel ? "⌂" : "×"}
              </button>
            </div>

            {menuTab === "menu" ? (
              <nav className="space-y-3">
                {!adminPanel && <button onClick={() => setMenuOpen(false)} className="w-full rounded-xl border border-white/[.08] bg-white/[.03] px-4 py-4 text-left text-sm font-medium hover:border-lime/30">Continuar no caixa <span className="float-right text-white/35">›</span></button>}
                {(adminPanel || accessMode === "local") && <button onClick={() => setMenuTab("history")} className={`w-full rounded-2xl border px-5 py-4 text-left transition ${adminPanel ? "border-white/10 bg-white/[.035] hover:border-lime/35 hover:bg-lime/[.045]" : "border-white/[.08] bg-white/[.03] hover:border-lime/30"}`}>
                  <span className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-white">Histórico e auditoria de vendas</span>
                      {adminPanel && <span className="mt-1 block text-xs leading-5 text-white/45">Consulte vendas por caixa, chave Pix e período.</span>}
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-lime">↗</span>
                  </span>
                </button>}
                {(adminPanel || accessMode === "local") && (
                  <>
                    <button onClick={() => setMenuTab("keys")} className={`w-full rounded-2xl border px-5 py-4 text-left transition ${adminPanel ? "border-white/10 bg-white/[.035] hover:border-lime/35 hover:bg-lime/[.045]" : "border-white/[.08] bg-white/[.03] hover:border-lime/30"}`}>
                      <span className="flex items-center justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-white">Chaves Pix</span>
                          {adminPanel && <span className="mt-1 block text-xs leading-5 text-white/45">Cadastre e escolha as chaves usadas pelos caixas.</span>}
                        </span>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-lime">↗</span>
                      </span>
                    </button>
                    <button onClick={() => setMenuTab("boxes")} className={`w-full rounded-2xl border px-5 py-4 text-left transition ${adminPanel ? "border-white/10 bg-white/[.035] hover:border-lime/35 hover:bg-lime/[.045]" : "border-white/[.08] bg-white/[.03] hover:border-lime/30"}`}>
                      <span className="flex items-center justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-white">Caixas e terminais</span>
                          {adminPanel && <span className="mt-1 block text-xs leading-5 text-white/45">Crie caixas, compartilhe links e acesse cada auditoria.</span>}
                        </span>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-lime">↗</span>
                      </span>
                    </button>
                  </>
                )}
                {adminPanel && accessMode === "owner" && (
                  <button onClick={() => setMenuTab("profile")} className="w-full rounded-2xl border border-white/10 bg-white/[.035] px-5 py-4 text-left transition hover:border-lime/35 hover:bg-lime/[.045]">
                    <span className="flex items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-white">Perfil do administrador</span>
                        <span className="mt-1 block text-xs leading-5 text-white/45">Consulte a conta, altere sua senha ou saia do painel.</span>
                      </span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-lime">↗</span>
                    </span>
                  </button>
                )}
                {!adminPanel && accessMode === "owner" && <button onClick={() => window.location.assign("/adm")} className="w-full rounded-xl border border-lime/20 bg-lime/[.04] px-4 py-4 text-left text-sm font-medium text-lime hover:border-lime/50">Abrir Mercado Alternativo ADM ↗</button>}
                <div className="mt-3 rounded-xl border border-white/[.07] px-4 py-3 text-xs text-white/45">{backendOnline ? "Supabase conectado" : "Modo local neste navegador"}</div>
              </nav>
            ) : (
              <button
                onClick={() => {
                  setMenuTab(menuTab === "box_detail" ? "boxes" : "menu");
                  setGeneratedLinks(null);
                  setMessage("");
                }}
                className="mb-5 text-sm text-white/50 hover:text-lime"
              >
                {menuTab === "box_detail" ? "← Voltar aos caixas" : "← Voltar ao menu"}
              </button>
            )}

            {menuTab === "profile" && adminPanel && accessMode === "owner" && (
              <section className="space-y-5">
                <div className="rounded-2xl border border-lime/15 bg-lime/[.04] p-5">
                  <p className="text-[10px] font-bold tracking-[.18em] text-lime/70">CONTA DO PROPRIETÁRIO</p>
                  <p className="mt-2 text-sm font-semibold text-white">Administrador</p>
                  <p className="mt-1 break-all text-sm text-white/55">{ownerEmail || "E-mail não disponível"}</p>
                </div>
                <form onSubmit={updateProfilePassword} className="space-y-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-5">
                  <div>
                    <h3 className="text-sm font-semibold">Alterar senha</h3>
                    <p className="mt-1 text-xs leading-5 text-white/45">Defina uma nova senha com pelo menos 12 caracteres.</p>
                  </div>
                  <label className="block text-sm text-white/65">Nova senha
                    <input required type="password" minLength={12} autoComplete="new-password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-sm text-white/65">Confirmar nova senha
                    <input required type="password" minLength={12} autoComplete="new-password" value={confirmProfilePassword} onChange={(event) => setConfirmProfilePassword(event.target.value)} className={inputClass} />
                  </label>
                  <button disabled={busy} className="w-full rounded-xl border border-lime/20 bg-lime/[.06] px-4 py-3 text-sm font-semibold text-lime disabled:opacity-50">{busy ? "Salvando..." : "Alterar senha"}</button>
                </form>
                <button onClick={() => void signOut()} className="w-full rounded-xl border border-red-300/15 px-4 py-3.5 text-left text-sm font-semibold text-red-100/80 transition hover:border-red-300/30 hover:bg-red-300/[.04]">
                  Sair da conta do administrador
                </button>
              </section>
            )}
            {menuTab === "profile" && adminPanel && accessMode !== "owner" && (
              <section role="alert" className="rounded-2xl border border-amber-200/15 bg-amber-200/[.04] p-5">
                <h3 className="text-sm font-semibold text-amber-100">Conta do administrador indisponível</h3>
                <p className="mt-2 text-sm leading-6 text-amber-100/65">
                  Este painel não reconheceu uma sessão de administrador do Supabase. Confira a conexão e entre novamente em <a href="/adm" className="text-lime underline">/adm</a>.
                </p>
              </section>
            )}

            {menuTab === "history" && (
              <section>
                {(adminPanel || accessMode === "local") && (
                  <>
                    <label className="block text-xs font-medium text-white/55" htmlFor="history-box">Caixa</label>
                    <select id="history-box" value={historyBoxId} onChange={(event) => setHistoryBoxId(event.target.value)} className={inputClass}>
                      <option value="all">Todos os caixas</option>
                      {boxes.map((box) => <option key={box.id} value={box.id}>{box.nome}{box.ativo ? "" : box.excluido ? " (removido)" : " (arquivado)"}</option>)}
                    </select>
                  </>
                )}
                <label className="mt-4 block text-xs font-medium text-white/55" htmlFor="history-key">Chave Pix</label>
                <select id="history-key" value={historyKeyId} onChange={(event) => setHistoryKeyId(event.target.value)} className={inputClass}>
                  <option value="all">Todas as chaves</option>
                  {keys.map((key) => <option key={key.id} value={key.id}>{key.apelido}</option>)}
                </select>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-white/55" htmlFor="history-from">De
                    <input id="history-from" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-xs font-medium text-white/55" htmlFor="history-to">Até
                    <input id="history-to" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} className={inputClass} />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}
                  className="mt-3 text-xs text-lime/80 hover:text-lime"
                >
                  Limpar datas · ver todo o histórico
                </button>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-lime/15 bg-lime/[.04] p-4">
                    <p className="text-xs text-white/45">Total recebido</p>
                    <p className="mt-1 text-xl font-bold text-lime">{formatCurrency(paidTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[.08] bg-white/[.03] p-4">
                    <p className="text-xs text-white/45">Vendas pagas</p>
                    <p className="mt-1 text-xl font-bold">{paidCount}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[.08] p-4">
                    <h3 className="text-sm font-semibold">Vendas por caixa</h3>
                    <div className="mt-2 space-y-2">
                      {salesByCashbox.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-white/55">{sale.name} · {sale.count}</span>
                          <span className="shrink-0 font-semibold">{formatCurrency(sale.total)}</span>
                        </div>
                      ))}
                      {salesByCashbox.length === 0 && <p className="text-xs text-white/35">Sem vendas pagas</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[.08] p-4">
                    <h3 className="text-sm font-semibold">Vendas por chave Pix</h3>
                    <div className="mt-2 space-y-2">
                      {salesByPixKey.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-white/55">{sale.name} · {sale.count}</span>
                          <span className="shrink-0 font-semibold">{formatCurrency(sale.total)}</span>
                        </div>
                      ))}
                      {salesByPixKey.length === 0 && <p className="text-xs text-white/35">Sem vendas pagas</p>}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-white/40">{filteredHistory.length} registro(s) no período · total considera somente pagos</p>
                <div className="mt-2 divide-y divide-white/[.07]">
                  {filteredHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.apelido ?? keys.find((key) => key.id === item.chave_id)?.apelido ?? "Chave Pix"}</p>
                        {(adminPanel || accessMode === "local") && <p className="mt-1 truncate text-xs text-lime/70">{item.caixa_nome ?? boxes.find((box) => box.id === item.caixa_id)?.nome ?? "Caixa"}</p>}
                        <p className="mt-1 text-xs text-white/40">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                        <p className={`mt-1 text-xs ${item.status === "pago" ? "text-lime" : "text-amber-200"}`}>{statusLabel(item.status)}</p>
                      </div>
                      <p className="shrink-0 font-semibold">{formatCurrency(item.valor)}</p>
                    </div>
                  ))}
                  {filteredHistory.length === 0 && <p className="py-10 text-center text-sm text-white/40">Nenhum pagamento para esta seleção.</p>}
                </div>
                {(adminPanel || accessMode === "local") && (
                  <div className="mt-8 border-t border-white/[.08] pt-6">
                    <h3 className="text-sm font-semibold">Exclusão automática do histórico</h3>
                    <p className="mt-1 text-xs leading-5 text-white/40">
                      {accessMode === "owner"
                        ? "Apaga do Supabase as transações mais antigas que o prazo escolhido. A limpeza roda diariamente; mudanças valem para todos os caixas."
                        : "No modo local, apaga deste navegador as transações mais antigas que o prazo escolhido."}
                    </p>
                    <select value={accessMode === "owner" ? historyRetention : retentionDays} onChange={(event) => void saveRetention(Number(event.target.value))} disabled={busy} className={inputClass}>
                      {[30, 60, 90, 180, 365].map((days) => <option key={days} value={days}>{days} dias</option>)}
                    </select>
                    <p className="mt-2 text-xs text-white/35">Prazo ativo: {accessMode === "owner" ? historyRetention : retentionDays} dias.</p>
                  </div>
                )}
              </section>
            )}

            {menuTab === "box_detail" && detailBox && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-lime/20 bg-[radial-gradient(ellipse_at_top_right,rgba(197,243,107,.11),transparent_60%),linear-gradient(135deg,#1b2820,#111714)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-[.2em] text-lime/70">TERMINAL</p>
                      <h3 className="mt-1 text-2xl font-bold">{detailBox.nome}</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${detailBox.ativo ? "border-lime/20 bg-lime/10 text-lime" : "border-white/10 bg-white/[.04] text-white/45"}`}>
                      {detailBox.ativo ? "Ativo" : detailBox.excluido ? "Removido" : "Arquivado"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/45">Escolha o que deseja conferir ou administrar neste caixa.</p>
                </div>

                <nav aria-label="Seções do caixa" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["keys", "Chaves Pix"],
                    ["link", "Links do caixa"],
                    ["audit", "Auditoria"],
                    ["settings", "Ações"],
                  ] as const).map(([section, label]) => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setDetailSection(section)}
                      className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${detailSection === section ? "border-lime/30 bg-lime/[.08] text-lime" : "border-white/[.08] bg-white/[.025] text-white/55 hover:border-white/20 hover:text-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                {detailSection === "keys" && (accessMode === "owner" || accessMode === "local") && !detailBox.excluido && (
                  <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">Chaves Pix permitidas</h4>
                        <p className="mt-1 text-xs leading-5 text-white/45">Todas as chaves cadastradas ficam nesta lista. Marque as que este caixa pode usar; desmarcar remove apenas o acesso deste caixa, não apaga a chave. Você pode selecionar mais de uma.</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">{cashboxKeyDraftIds.length}/{keys.length}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {keys.map((key) => {
                        const checked = cashboxKeyDraftIds.includes(key.id);
                        return (
                          <label key={key.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-lime/20 bg-lime/[.045]" : "border-white/[.07] bg-black/10"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setCashboxKeyDraftIds((current) => event.target.checked
                                ? [...current, key.id]
                                : current.filter((id) => id !== key.id))}
                              className="mt-1 h-4 w-4 accent-lime"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{key.apelido}</span>
                              <span className="mt-1 block break-all text-xs text-white/40">{key.tipo_chave} · {key.chave}</span>
                            </span>
                          </label>
                        );
                      })}
                      {keys.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">Cadastre uma chave Pix antes de vinculá-la a este caixa.</p>}
                    </div>
                    <button
                      onClick={() => void saveCashboxKeys()}
                      disabled={busy || keys.length === 0}
                      className="mt-4 w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink disabled:opacity-40"
                    >
                      {busy ? "Salvando..." : "Salvar chaves deste caixa"}
                    </button>
                  </div>
                )}

                {detailSection === "audit" && <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                  <h4 className="text-sm font-semibold">Auditoria deste caixa</h4>
                  <p className="mt-1 text-xs text-white/45">Ajuste o período e, se quiser, filtre por uma chave Pix.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="block text-xs text-white/55">De
                      <input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} className={inputClass} />
                    </label>
                    <label className="block text-xs text-white/55">Até
                      <input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} className={inputClass} />
                    </label>
                  </div>
                  <label className="mt-3 block text-xs text-white/55">Chave Pix
                    <select value={historyKeyId} onChange={(event) => setHistoryKeyId(event.target.value)} className={inputClass}>
                      <option value="all">Todas as chaves</option>
                      {keys.map((key) => <option key={key.id} value={key.id}>{key.apelido}</option>)}
                    </select>
                  </label>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-lime/15 bg-lime/[.04] p-3">
                      <p className="text-[11px] text-white/45">Total pago no filtro</p>
                      <p className="mt-1 text-lg font-bold text-lime">{formatCurrency(boxDetailTotal)}</p>
                    </div>
                    <div className="rounded-xl border border-white/[.08] bg-black/10 p-3">
                      <p className="text-[11px] text-white/45">Vendas pagas</p>
                      <p className="mt-1 text-lg font-bold">{boxDetailSessions.length}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => auditCashbox(detailBox)}
                    className="mt-4 w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink transition hover:bg-[#d2ff7c]"
                  >
                    Abrir relatório detalhado
                  </button>
                </div>}

                {detailSection === "link" && (
                  <div className="space-y-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                    <div>
                      <h4 className="text-sm font-semibold">Link do operador</h4>
                      <p className="mt-1 text-xs leading-5 text-white/45">Link individual de {detailBox.nome}. Compartilhe somente com o operador responsável.</p>
                    </div>
                    {cashboxLinkLoadState === "loading" && <p className="rounded-xl border border-white/[.07] px-4 py-5 text-center text-sm text-white/45">Carregando link salvo...</p>}
                    {cashboxLinkLoadState === "ready" && generatedLinks?.boxId === detailBox.id && (
                      <div className="space-y-3 rounded-xl border border-lime/20 bg-lime/[.04] p-4">
                        <p className="text-xs font-semibold text-lime">Link salvo para este caixa</p>
                        <input readOnly aria-label="Link do caixa" value={generatedLinks.cashbox} className={inputClass} onFocus={(event) => event.currentTarget.select()} />
                        <button onClick={() => void copyText(generatedLinks.cashbox)} className="w-full rounded-lg bg-lime px-3 py-3 text-xs font-bold text-ink">Copiar link do operador</button>
                      </div>
                    )}
                    {cashboxLinkLoadState === "missing" && (
                      <p className="rounded-xl border border-amber-200/10 bg-amber-200/[.03] px-4 py-3 text-xs leading-5 text-amber-100/70">
                        {detailBox.ativo
                          ? "Este caixa ainda não tem um link salvo. Gere um novo para disponibilizar o acesso."
                          : "Este caixa está arquivado ou removido, e seu link foi revogado."}
                      </p>
                    )}
                    {accessMode === "owner" && detailBox.ativo && (
                      <button
                        onClick={() => void rotateCashboxLink(detailBox)}
                        disabled={busy || cashboxLinkLoadState === "loading"}
                        className="w-full rounded-xl border border-lime/20 bg-lime/[.06] px-4 py-3 text-sm font-semibold text-lime disabled:opacity-40"
                      >
                        {busy ? "Gerando link..." : cashboxLinkLoadState === "ready" ? "Gerar outro link" : "Gerar link do caixa"}
                      </button>
                    )}
                    <div className="border-t border-white/[.08] pt-4">
                      <h4 className="text-sm font-semibold">Link da tela do cliente</h4>
                      <p className="mt-1 text-xs leading-5 text-white/45">Abra este link em uma tela separada no PC do cliente. Ele mostra somente o QR Code da cobrança ativa e não dá acesso para operar o caixa.</p>
                      {displayLinkLoadState === "loading" && <p className="mt-3 rounded-xl border border-white/[.07] px-4 py-4 text-center text-xs text-white/45">Carregando link da tela do cliente...</p>}
                      {displayLinkLoadState === "error" && (
                        <p role="alert" className="mt-3 rounded-xl border border-amber-200/10 bg-amber-200/[.03] px-4 py-3 text-xs leading-5 text-amber-100/70">
                          Não foi possível consultar o link do cliente. Confira se a migration da tela do cliente foi executada no Supabase.
                        </p>
                      )}
                      {displayLinkLoadState === "ready" && customerDisplayLink?.boxId === detailBox.id && (
                        <div className="mt-3 space-y-3 rounded-xl border border-lime/20 bg-lime/[.04] p-4">
                          <input readOnly aria-label="Link da tela do cliente" value={customerDisplayLink.url} className={inputClass} onFocus={(event) => event.currentTarget.select()} />
                          <button onClick={() => void copyText(customerDisplayLink.url)} className="w-full rounded-lg border border-lime/20 bg-lime/[.06] px-3 py-3 text-xs font-bold text-lime">Copiar link do cliente</button>
                        </div>
                      )}
                      {displayLinkLoadState === "missing" && accessMode === "owner" && detailBox.ativo && (
                        <button
                          onClick={() => void generateCustomerDisplayLink(detailBox)}
                          disabled={busy}
                          className="mt-3 w-full rounded-xl border border-lime/20 bg-lime/[.06] px-4 py-3 text-sm font-semibold text-lime disabled:opacity-40"
                        >
                          {busy ? "Gerando link..." : "Gerar link do cliente"}
                        </button>
                      )}
                      {displayLinkLoadState === "missing" && !detailBox.ativo && (
                        <p className="mt-3 text-xs text-white/40">Caixas arquivados ou removidos não podem abrir a tela do cliente.</p>
                      )}
                    </div>
                  </div>
                )}

                {detailSection === "settings" && (
                  <div className="space-y-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                    <h4 className="text-sm font-semibold">Ações do terminal</h4>
                    <p className="text-xs leading-5 text-white/45">Arquivar revoga o link e pausa o terminal. Remover tira o caixa da operação, preservando pagamentos confirmados.</p>
                    {detailBox.ativo && <button onClick={() => void archiveCashbox(detailBox)} disabled={busy} className="w-full rounded-xl border border-amber-200/15 px-4 py-3 text-sm text-amber-100/80 disabled:opacity-40">Arquivar caixa</button>}
                    {!detailBox.excluido && (adminPanel || accessMode === "local") && <button onClick={() => void deleteCashbox(detailBox)} disabled={busy} className="w-full rounded-xl border border-red-300/15 px-4 py-3 text-sm text-red-200/80 disabled:opacity-40">Remover caixa</button>}
                  </div>
                )}
              </section>
            )}

            {menuTab === "keys" && (adminPanel || accessMode === "local") && (
              <section className="grid items-start gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-lime/15 bg-[linear-gradient(145deg,rgba(197,243,107,.055),rgba(17,23,20,.75))] p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-bold tracking-[.18em] text-lime/70">CADASTRO</p>
                    <h3 className="mt-1 text-base font-semibold">{keyDraft.id ? "Editar chave Pix" : "Cadastrar chave Pix"}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/45">Preencha os dados abaixo. A chave ficará disponível para os caixas.</p>
                  </div>
                  <form onSubmit={saveKey} className="space-y-3">
                    {keyDraft.id && (
                      <div className="flex items-center justify-between rounded-xl border border-lime/15 bg-lime/[.04] px-3 py-2">
                        <span className="text-xs text-lime/80">Editando uma chave cadastrada</span>
                        <button type="button" onClick={() => setKeyDraft(freshKey())} className="text-xs text-white/50 hover:text-white">Cancelar edição</button>
                      </div>
                    )}
                    <label className="block text-xs text-white/55">Apelido<input className={inputClass} value={keyDraft.apelido} onChange={(event) => setKeyDraft({ ...keyDraft, apelido: event.target.value })} placeholder="Ex.: Chave principal" maxLength={60} /></label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs text-white/55">Tipo<select className={inputClass} value={keyDraft.tipo_chave} onChange={(event) => setKeyDraft({ ...keyDraft, tipo_chave: event.target.value as PixKeyType })}>{KEY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                      <label className="block text-xs text-white/55">Cidade<input className={inputClass} value={keyDraft.cidade} onChange={(event) => setKeyDraft({ ...keyDraft, cidade: event.target.value.toUpperCase() })} maxLength={15} /></label>
                    </div>
                    <label className="block text-xs text-white/55">Chave Pix<input className={inputClass} value={keyDraft.chave} onChange={(event) => setKeyDraft({ ...keyDraft, chave: event.target.value })} placeholder="Informe a chave Pix" maxLength={150} /></label>
                    <label className="block text-xs text-white/55">Nome do titular<input className={inputClass} value={keyDraft.titular} onChange={(event) => setKeyDraft({ ...keyDraft, titular: event.target.value.toUpperCase() })} maxLength={25} /></label>
                    <button disabled={busy || (!keyDraft.id && keys.length >= 10)} className="w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Salvando..." : keyDraft.id ? "Salvar alterações" : "Cadastrar chave"}</button>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-[.18em] text-white/40">GERENCIAMENTO</p>
                      <h3 className="mt-1 text-base font-semibold">Chaves cadastradas</h3>
                      <p className="mt-1 text-xs leading-5 text-white/45">Toque em uma chave para ativá-la nos caixas.</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">{keys.length}/10</span>
                  </div>
                  <div className="space-y-2">
                    {keys.map((key) => (
                      <div key={key.id} className={`flex items-center gap-2 rounded-xl border p-3 ${key.id === selectedKeyId ? "border-lime/20 bg-lime/[.045]" : "border-white/[.07] bg-black/10"}`}>
                        <button onClick={() => void setKeyActive(key)} disabled={busy} className="min-w-0 flex-1 text-left disabled:opacity-50">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {key.apelido}
                            {key.id === selectedKeyId && <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] text-lime">EM USO</span>}
                          </span>
                          <span className="mt-1 block break-all text-xs text-white/40">{key.tipo_chave} · {key.chave}</span>
                        </button>
                        <button onClick={() => { setKeyDraft({ ...key }); setMessage(""); }} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 hover:text-white">Editar</button>
                        <button type="button" onClick={() => void deletePixKey(key)} disabled={busy} className="shrink-0 rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-200/80 hover:border-red-300/30 hover:text-red-100 disabled:opacity-40">Apagar</button>
                      </div>
                    ))}
                    {keys.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">Nenhuma chave cadastrada. Use o formulário ao lado para adicionar a primeira.</p>}
                  </div>
                  {keys.length >= 10 && <p className="mt-3 text-xs text-amber-100/70">Limite de 10 chaves atingido.</p>}
                </div>
              </section>
            )}

            {menuTab === "boxes" && (adminPanel || accessMode === "local") && (
              <section>
                <form onSubmit={createCashbox} className="rounded-2xl border border-white/[.08] bg-black/10 p-4">
                  <label className="block text-sm font-medium text-white/65" htmlFor="box-name">Nome do novo caixa
                    <input id="box-name" required maxLength={60} value={boxName} onChange={(event) => setBoxName(event.target.value)} placeholder="Ex.: Caixa 2" className={inputClass} />
                  </label>
                  <button disabled={busy} className="mt-4 w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Criando..." : "Criar caixa e gerar link do operador"}</button>
                </form>

                <h3 className="mt-7 text-sm font-semibold">Terminais</h3>
                <div className="mt-3 space-y-2">
                  {boxes.map((box) => (
                    <button
                      key={box.id}
                      type="button"
                      onClick={() => openCashboxDetails(box)}
                      className="w-full rounded-2xl border border-white/[.08] bg-black/10 p-4 text-left transition hover:border-lime/30 hover:bg-lime/[.035]"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="block text-sm font-medium">{box.nome}</span>
                          <span className={`mt-1 block text-xs ${box.ativo ? "text-lime" : "text-white/35"}`}>{box.ativo ? "Ativo" : box.excluido ? "Removido · histórico preservado" : "Arquivado"}</span>
                          <span className="mt-2 block text-xs text-white/35">Abrir detalhes, auditoria e link do operador</span>
                        </span>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-lime">›</span>
                      </span>
                    </button>
                  ))}
                  {boxes.length === 0 && <p className="py-6 text-sm text-white/40">Nenhum caixa cadastrado.</p>}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
