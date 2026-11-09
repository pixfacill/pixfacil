"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/pix";
import { getSupabase } from "@/lib/supabase";
import { ACTIVE_SESSION_STORAGE, type PixSession } from "@/lib/types";

export default function DisplayPage() {
  const [session, setSession] = useState<PixSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [connected, setConnected] = useState(false);
  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    let active = true;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    const showSession = (next: PixSession | null) => {
      if (!active) return;
      if (clearTimer) clearTimeout(clearTimer);
      setSession(next);
      if (!next) {
        setQrImage("");
        return;
      }
      if (next.status === "pago") {
        setQrImage("");
        clearTimer = setTimeout(() => {
          if (active) {
            setSession((current) => current?.id === next.id ? null : current);
            const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE);
            if (stored) {
              const parsed = JSON.parse(stored) as PixSession;
              if (parsed.id === next.id) localStorage.removeItem(ACTIVE_SESSION_STORAGE);
            }
          }
        }, 4000);
        return;
      }
      void QRCode.toDataURL(next.payload_pix, { width: 640, margin: 2, errorCorrectionLevel: "M" })
        .then((image) => {
          if (active) setQrImage(image);
        })
        .catch((error: unknown) => {
          console.error("Falha ao gerar o QR Code no display.", error);
          if (active) setQrImage("");
        });
    };

    const loadLocalSession = () => {
      const saved = localStorage.getItem(ACTIVE_SESSION_STORAGE);
      showSession(saved ? JSON.parse(saved) as PixSession : null);
    };

    loadLocalSession();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === ACTIVE_SESSION_STORAGE) loadLocalSession();
    };
    window.addEventListener("storage", onStorage);

    if (supabase) {
      void supabase
        .from("sessoes_caixa")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error("Falha ao carregar a cobrança do Supabase:", error.message);
          if (data) showSession(data as PixSession);
          setConnected(!error);
        });

      const channel = supabase
        .channel("mercado-alternativo-display")
        .on("postgres_changes", { event: "*", schema: "public", table: "sessoes_caixa" }, (event) => {
          const next = event.new as PixSession;
          if (event.eventType === "DELETE") {
            showSession(null);
          } else if (next.status === "pago") {
            showSession(next);
          } else if (next.status === "pendente") {
            showSession(next);
          }
        })
        .subscribe((status) => setConnected(status === "SUBSCRIBED"));
      return () => {
        active = false;
        if (clearTimer) clearTimeout(clearTimer);
        window.removeEventListener("storage", onStorage);
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      active = false;
      if (clearTimer) clearTimeout(clearTimer);
      window.removeEventListener("storage", onStorage);
    };
  }, [supabase]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
        <header className="mb-10 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-2xl font-black text-ink shadow-glow">M</div>
          <div>
            <p className="font-bold tracking-wide">Mercado Alternativo</p>
            <p className="mt-1 text-xs tracking-[.18em] text-white/40">PAGAMENTO VIA PIX</p>
          </div>
        </header>

        {session?.status === "pendente" ? (
          <section className="w-full max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-[.22em] text-lime">PIX COPIA E COLA</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">Escaneie para pagar</h1>
            <div className="mx-auto mt-8 w-full max-w-[min(70vw,460px)] rounded-3xl bg-white p-3 shadow-2xl">
              {qrImage ? <img src={qrImage} alt="QR Code Pix para pagamento" className="aspect-square w-full" /> : <div className="grid aspect-square place-items-center text-black/50">Carregando QR Code...</div>}
            </div>
            <p className="mt-7 text-sm text-white/45">VALOR DA COMPRA</p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-lime sm:text-6xl">{formatCurrency(session.valor)}</p>
            <p className="mt-4 text-sm text-white/40">Abra o app do seu banco e use a opção Pix.</p>
          </section>
        ) : session?.status === "pago" ? (
          <section className="text-center" role="status">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-lime/30 bg-lime/10 text-5xl text-lime">✓</div>
            <p className="mt-8 text-sm font-semibold tracking-[.2em] text-lime">PAGAMENTO CONFIRMADO</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Obrigado!</h1>
            <p className="mt-4 text-xl text-white/60">{formatCurrency(session.valor)}</p>
          </section>
        ) : (
          <section className="text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-lime/20 bg-lime/[.06] text-5xl text-lime">M</div>
            <p className="mt-8 text-sm font-semibold tracking-[.2em] text-lime">BEM-VINDO</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Aguardando sua compra</h1>
            <p className="mt-4 text-base text-white/40">O QR Code Pix aparecerá aqui quando o caixa iniciar a cobrança.</p>
          </section>
        )}

        <footer className="absolute bottom-5 flex items-center gap-2 text-xs text-white/30">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-lime" : "bg-white/25"}`} />
          {connected ? "Display conectado" : supabase ? "Conectando ao caixa..." : "Modo local · mantenha o caixa e display neste navegador"}
        </footer>
      </div>
    </main>
  );
}
