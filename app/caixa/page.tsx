"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPixPayload, formatCurrency, parseAmount } from "@/lib/pix";
import { getSupabase } from "@/lib/supabase";
import {
  ACTIVE_SESSION_STORAGE,
  DEFAULT_KEY,
  HISTORY_STORAGE,
  KEYS_STORAGE,
  RETENTION_STORAGE,
  type PixKey,
  type PixKeyType,
  type PixSession,
} from "@/lib/types";

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
    id: crypto.randomUUID(),
    apelido: "",
    tipo_chave: "telefone",
    chave: "",
    titular: "",
    cidade: "SAO PAULO",
    ativa: false,
    created_at: new Date().toISOString(),
  };
}

export default function CaixaPage() {
  const [keys, setKeys] = useState<PixKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [history, setHistory] = useState<PixSession[]>([]);
  const [activeSession, setActiveSession] = useState<PixSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState<PixKey>(freshKey);
  const [retentionDays, setRetentionDays] = useState(60);
  const [backendOnline, setBackendOnline] = useState(false);

  const supabase = useMemo(() => getSupabase(), []);
  const parsedAmount = parseAmount(amountText);
  const selectedKey = keys.find((key) => key.id === selectedKeyId) ?? null;

  const readStoredState = useCallback(() => {
    try {
      const savedKeys = localStorage.getItem(KEYS_STORAGE);
      const nextKeys: PixKey[] = savedKeys ? JSON.parse(savedKeys) : [DEFAULT_KEY];
      const savedHistory = localStorage.getItem(HISTORY_STORAGE);
      const nextHistory: PixSession[] = savedHistory ? JSON.parse(savedHistory) : [];
      const storedRetention = Number(localStorage.getItem(RETENTION_STORAGE) || 60);
      const expiresAt = Date.now() - Math.max(1, storedRetention) * 24 * 60 * 60 * 1000;
      const retained = nextHistory.filter((item) => new Date(item.created_at).getTime() >= expiresAt);
      setKeys(nextKeys.length ? nextKeys : [DEFAULT_KEY]);
      setSelectedKeyId((current) => current || nextKeys[0]?.id || DEFAULT_KEY.id);
      setHistory(retained);
      setRetentionDays(storedRetention);
      if (retained.length !== nextHistory.length) {
        localStorage.setItem(HISTORY_STORAGE, JSON.stringify(retained));
      }
      const savedActive = localStorage.getItem(ACTIVE_SESSION_STORAGE);
      setActiveSession(savedActive ? JSON.parse(savedActive) : null);
    } catch {
      setMessage("Não foi possível ler os dados locais deste navegador.");
      setKeys([DEFAULT_KEY]);
    }
  }, []);

  useEffect(() => {
    readStoredState();
    const sync = () => readStoredState();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [readStoredState]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "pendente") {
      setQrImage("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(activeSession.payload_pix, { width: 420, margin: 2, errorCorrectionLevel: "M" })
      .then((image) => {
        if (!cancelled) setQrImage(image);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Não foi possível gerar o QR Code.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadRemoteKeys() {
      const { data, error } = await supabase!.from("chaves_pix").select("*").order("created_at");
      if (cancelled) return;
      if (error) {
        setMessage(`Supabase: ${error.message}`);
      } else {
        setBackendOnline(true);
        if (data?.length) {
          const remoteKeys = data as PixKey[];
          setKeys(remoteKeys);
          setSelectedKeyId((current) =>
            remoteKeys.some((key) => key.id === current)
              ? current
              : remoteKeys.find((key) => key.ativa)?.id ?? remoteKeys[0].id,
          );
          localStorage.setItem(KEYS_STORAGE, JSON.stringify(remoteKeys));
          const { data: sessions, error: sessionsError } = await supabase!
            .from("sessoes_caixa")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
          if (cancelled) return;
          if (sessionsError) {
            setMessage(`Não foi possível carregar o histórico remoto: ${sessionsError.message}`);
          } else if (sessions) {
            const historyRows = sessions.map((item) => ({
              ...item,
              apelido: remoteKeys.find((key) => key.id === item.chave_id)?.apelido ?? "Chave Pix",
            })) as PixSession[];
            setHistory(historyRows);
            localStorage.setItem(HISTORY_STORAGE, JSON.stringify(historyRows));
            const pending = historyRows.find((item) => item.status === "pendente");
            if (pending) {
              setActiveSession(pending);
              localStorage.setItem(ACTIVE_SESSION_STORAGE, JSON.stringify(pending));
            }
          }
        } else {
          setKeys([]);
          setSelectedKeyId("");
          localStorage.setItem(KEYS_STORAGE, JSON.stringify([]));
        }
      }
      setLoading(false);
    }
    void loadRemoteKeys();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const persistHistory = (next: PixSession[]) => {
    setHistory(next);
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(next));
  };

  const createCharge = async () => {
    if (!selectedKey || !parsedAmount) {
      setMessage("Escolha uma chave Pix e informe um valor válido.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const sessionId = crypto.randomUUID();
      const payload = buildPixPayload(selectedKey, parsedAmount, sessionId.replace(/-/g, "").slice(0, 25));
      let session: PixSession = {
        id: sessionId,
        chave_id: selectedKey.id,
        valor: parsedAmount,
        payload_pix: payload,
        status: "pendente",
        created_at: new Date().toISOString(),
        apelido: selectedKey.apelido,
      };

      if (supabase) {
        const { data, error } = await supabase
          .from("sessoes_caixa")
          .insert({
            id: session.id,
            chave_id: session.chave_id,
            valor: session.valor,
            payload_pix: session.payload_pix,
            status: session.status,
          })
          .select()
          .single();
        if (error) throw new Error(`Não foi possível criar a cobrança no Supabase: ${error.message}`);
        session = { ...data, apelido: selectedKey.apelido } as PixSession;
      }

      setActiveSession(session);
      localStorage.setItem(ACTIVE_SESSION_STORAGE, JSON.stringify(session));
      persistHistory([session, ...history.filter((item) => item.id !== session.id)]);
      setMessage(supabase ? "Cobrança sincronizada com o display." : "Cobrança criada neste dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar a cobrança.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!activeSession) return;
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from("sessoes_caixa")
          .update({ status: "pago" })
          .eq("id", activeSession.id);
        if (error) throw new Error(`Não foi possível confirmar no Supabase: ${error.message}`);
      }
      const paid = { ...activeSession, status: "pago" as const };
      setActiveSession(paid);
      localStorage.setItem(ACTIVE_SESSION_STORAGE, JSON.stringify(paid));
      persistHistory(history.map((item) => (item.id === paid.id ? paid : item)));
      setConfirmOpen(false);
      setQrImage("");
      setMessage(`Recebimento de ${formatCurrency(paid.valor)} confirmado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao confirmar o recebimento.");
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keyDraft.apelido.trim() || !keyDraft.chave.trim() || !keyDraft.titular.trim()) {
      setMessage("Preencha apelido, chave Pix e titular.");
      return;
    }
    const existing = keys.some((key) => key.id === keyDraft.id);
    if (!existing && keys.length >= 10) {
      setMessage("O limite é de 10 chaves Pix.");
      return;
    }
    setBusy(true);
    try {
      const next = existing
        ? keys.map((key) => (key.id === keyDraft.id ? keyDraft : key))
        : [...keys, keyDraft];
      if (supabase) {
        const { error } = await supabase.from("chaves_pix").upsert({
          id: keyDraft.id,
          apelido: keyDraft.apelido.trim(),
          tipo_chave: keyDraft.tipo_chave,
          chave: keyDraft.chave.trim(),
          titular: keyDraft.titular.trim(),
          cidade: keyDraft.cidade.trim() || "BRASILIA",
          ativa: keyDraft.ativa,
        });
        if (error) throw new Error(`Não foi possível salvar a chave: ${error.message}`);
      }
      setKeys(next);
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
      setSelectedKeyId(keyDraft.id);
      setKeyDraft(freshKey());
      setMessage("Chave Pix salva.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar a chave Pix.");
    } finally {
      setBusy(false);
    }
  };

  const setKeyActive = async (key: PixKey) => {
    setSelectedKeyId(key.id);
    const next = keys.map((item) => ({ ...item, ativa: item.id === key.id }));
    try {
      if (supabase) {
        const { error } = await supabase.from("chaves_pix").upsert(next);
        if (error) throw new Error(`Não foi possível atualizar a chave ativa: ${error.message}`);
      }
      setKeys(next);
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao atualizar a chave ativa.");
    }
  };

  const saveRetention = (days: number) => {
    setRetentionDays(days);
    localStorage.setItem(RETENTION_STORAGE, String(days));
    const expiresAt = Date.now() - days * 24 * 60 * 60 * 1000;
    persistHistory(history.filter((item) => new Date(item.created_at).getTime() >= expiresAt));
  };

  const clearCharge = () => {
    setActiveSession(null);
    setQrImage("");
    localStorage.removeItem(ACTIVE_SESSION_STORAGE);
  };

  const openDisplay = () => window.open("/display", "pix-display", "noopener,noreferrer");

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-8 sm:py-9">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[470px]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-9 flex items-center justify-between">
          <a href="/caixa" className="flex items-center gap-3" aria-label="PixFácil início">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-xl font-black text-ink shadow-glow">M</div>
            <div>
              <p className="text-sm font-bold tracking-wide">Mercado Alternativo</p>
              <p className="text-xs text-white/40">PAINEL DO CAIXA</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs sm:flex ${backendOnline ? "border-lime/20 text-lime" : "border-white/10 text-white/45"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-lime" : "bg-white/35"}`} />
              {backendOnline ? "Supabase conectado" : "Modo local"}
            </span>
            <button onClick={openDisplay} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/75 transition hover:border-lime/40 hover:text-white">
              Abrir display ↗
            </button>
            <button onClick={() => setAdminOpen(true)} aria-label="Abrir administração" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-lg text-white/70 transition hover:border-lime/40 hover:text-white">
              ☰
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-white/[.08] bg-panel/80 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold tracking-[.2em] text-lime">NOVA COBRANÇA</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quanto foi a venda?</h1>
              <p className="mt-2 text-sm text-white/45">Gere um Pix com o valor exato, sem taxas ou intermediários.</p>
            </div>

            <label className="block text-sm font-medium text-white/75" htmlFor="pix-key">Chave Pix para receber</label>
            <select id="pix-key" value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} className={inputClass}>
              {keys.map((key) => <option key={key.id} value={key.id}>{key.apelido} · {key.tipo_chave}</option>)}
            </select>
            {selectedKey && <p className="mt-2 truncate text-xs text-white/35">{selectedKey.chave} · {selectedKey.titular}</p>}

            <label className="mt-7 block text-sm font-medium text-white/75" htmlFor="amount">Valor da venda</label>
            <div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-[#111714] px-4 focus-within:border-lime/60">
              <span className="text-xl text-white/40">R$</span>
              <input id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amountText} onChange={(event) => setAmountText(event.target.value)} className="w-full bg-transparent px-3 py-4 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/20" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[10, 20, 50].map((value) => <button key={value} onClick={() => setAmountText(`${value},00`)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-lime/40 hover:text-lime">R$ {value},00</button>)}
            </div>
            <button disabled={busy || loading || !parsedAmount || !selectedKey} onClick={createCharge} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 py-4 font-bold text-ink transition hover:bg-[#d2ff7c] disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Processando..." : "Gerar QR Code"} <span className="text-lg">→</span>
            </button>
            {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-white/65">{message}</p>}
            {!supabase && <p className="mt-4 text-center text-xs text-white/35">Teste local ativado. Configure as variáveis do Supabase para sincronizar outra tela.</p>}
          </div>

          <div className="rounded-3xl border border-white/[.08] bg-[#171e1a]/75 p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-[.2em] text-white/40">DISPLAY DO CLIENTE</p>
                <h2 className="text-xl font-semibold">Cobrança atual</h2>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs ${activeSession?.status === "pendente" ? "bg-amber-300/10 text-amber-200" : "bg-white/[.06] text-white/45"}`}>
                {activeSession?.status === "pendente" ? "Aguardando pagamento" : "Aguardando cobrança"}
              </span>
            </div>
            {activeSession?.status === "pendente" ? (
              <div className="mt-7">
                <div className="mx-auto grid max-w-[290px] place-items-center rounded-2xl bg-white p-3">
                  {qrImage ? <img src={qrImage} alt="QR Code Pix da cobrança" className="aspect-square w-full" /> : <div className="grid aspect-square w-full place-items-center text-center text-sm text-black/50">QR ativo em outro dispositivo.<br />Abra o display para visualizar.</div>}
                </div>
                <p className="mt-5 text-center text-3xl font-bold">{formatCurrency(activeSession.valor)}</p>
                <p className="mt-1 text-center text-xs text-white/40">{activeSession.apelido ?? "Chave Pix"}</p>
                <button onClick={() => setConfirmOpen(true)} className="mt-6 w-full rounded-xl border border-lime/30 bg-lime/10 px-4 py-3 font-semibold text-lime transition hover:bg-lime/20">Confirmar recebimento</button>
                <button onClick={clearCharge} className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-white/40 hover:text-white/70">Cancelar cobrança</button>
              </div>
            ) : (
              <div className="mt-7 flex min-h-[310px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[.04] text-2xl text-white/35">⌁</div>
                <p className="font-medium text-white/65">Tudo pronto para vender</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-white/35">O QR Code da próxima cobrança vai aparecer aqui e na tela do cliente.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/[.08] bg-panel/70 p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-[.2em] text-white/40">MOVIMENTAÇÕES</p>
              <h2 className="text-xl font-semibold">Histórico recente</h2>
            </div>
            <span className="rounded-full bg-white/[.05] px-3 py-1.5 text-xs text-white/45">{history.length} registros</span>
          </div>
          {history.length ? (
            <div className="divide-y divide-white/[.06]">
              {history.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.status === "pago" ? "bg-lime/10 text-lime" : "bg-amber-300/10 text-amber-200"}`}>{item.status === "pago" ? "✓" : "◷"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.apelido ?? "Chave Pix"}</p>
                      <p className="mt-1 text-xs text-white/35">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatCurrency(item.valor)}</p>
                    <p className={`mt-1 text-xs ${item.status === "pago" ? "text-lime" : "text-amber-200"}`}>{item.status === "pago" ? "Pago" : "Pendente"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="rounded-xl bg-black/10 px-4 py-8 text-center text-sm text-white/35">As cobranças geradas aparecerão aqui.</p>}
        </section>
        <footer className="py-7 text-center text-xs text-white/25">Mercado Alternativo · O pagamento é confirmado manualmente pelo operador.</footer>
      </div>

      {confirmOpen && activeSession && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a221e] p-6 shadow-2xl">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-lime/10 text-xl text-lime">✓</div>
            <h2 id="confirm-title" className="text-xl font-semibold">Confirmar recebimento?</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">Confirme somente depois de verificar o crédito no aplicativo do banco.</p>
            <p className="my-5 rounded-xl bg-black/20 px-4 py-3 text-center text-2xl font-bold">{formatCurrency(activeSession.valor)}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl border border-white/10 px-3 py-3 text-sm text-white/65">Voltar</button>
              <button disabled={busy} onClick={confirmPayment} className="rounded-xl bg-lime px-3 py-3 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Salvando..." : "Sim, recebido"}</button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}>
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#171e1a] p-5 sm:p-8">
            <div className="mb-8 flex items-center justify-between">
              <div><p className="text-xs font-semibold tracking-[.2em] text-lime">CONFIGURAÇÕES</p><h2 className="mt-2 text-2xl font-semibold">Administração</h2></div>
              <button onClick={() => setAdminOpen(false)} aria-label="Fechar administração" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65">×</button>
            </div>
            <h3 className="text-sm font-semibold">Chaves Pix <span className="ml-1 text-white/35">{keys.length}/10</span></h3>
            <div className="mt-3 space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-black/10 p-3">
                  <button onClick={() => void setKeyActive(key)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2 text-sm font-medium">{key.apelido}{key.id === selectedKeyId && <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] text-lime">EM USO</span>}</span>
                    <span className="mt-1 block truncate text-xs text-white/35">{key.tipo_chave} · {key.chave}</span>
                  </button>
                  <button onClick={() => setKeyDraft({ ...key })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 hover:text-white">Editar</button>
                </div>
              ))}
            </div>
            <form onSubmit={saveKey} className="mt-5 space-y-3 rounded-2xl border border-white/[.08] bg-black/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{keys.some((key) => key.id === keyDraft.id) ? "Editar chave" : "Adicionar chave"}</p>
                {keys.some((key) => key.id === keyDraft.id) && <button type="button" onClick={() => setKeyDraft(freshKey())} className="text-xs text-white/40 hover:text-white">Nova</button>}
              </div>
              <label className="block text-xs text-white/55">Apelido<input className={inputClass} value={keyDraft.apelido} onChange={(e) => setKeyDraft({ ...keyDraft, apelido: e.target.value })} placeholder="Ex.: Chave principal" maxLength={60} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-white/55">Tipo<select className={inputClass} value={keyDraft.tipo_chave} onChange={(e) => setKeyDraft({ ...keyDraft, tipo_chave: e.target.value as PixKeyType })}>{KEY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                <label className="block text-xs text-white/55">Cidade<input className={inputClass} value={keyDraft.cidade} onChange={(e) => setKeyDraft({ ...keyDraft, cidade: e.target.value.toUpperCase() })} maxLength={15} /></label>
              </div>
              <label className="block text-xs text-white/55">Chave Pix<input className={inputClass} value={keyDraft.chave} onChange={(e) => setKeyDraft({ ...keyDraft, chave: e.target.value })} placeholder="Informe a chave Pix" maxLength={150} /></label>
              <label className="block text-xs text-white/55">Nome do titular<input className={inputClass} value={keyDraft.titular} onChange={(e) => setKeyDraft({ ...keyDraft, titular: e.target.value.toUpperCase() })} maxLength={25} /></label>
              <button disabled={busy} className="w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Salvando..." : "Salvar chave"}</button>
            </form>

            <div className="mt-8 border-t border-white/[.08] pt-6">
              <h3 className="text-sm font-semibold">Retenção do histórico</h3>
              <p className="mt-1 text-xs leading-5 text-white/40">Os registros locais mais antigos que este período são removidos deste navegador.</p>
              <select value={retentionDays} onChange={(event) => saveRetention(Number(event.target.value))} className={inputClass}>
                {[30, 60, 90, 180, 365].map((days) => <option key={days} value={days}>{days} dias</option>)}
              </select>
              <p className="mt-3 text-xs leading-5 text-white/30">A limpeza automática no Supabase é configurada no arquivo <code className="text-white/50">supabase/schema.sql</code>.</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
