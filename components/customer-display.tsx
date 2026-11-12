"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/pix";
import { getSupabase } from "@/lib/supabase";

type DisplaySession = {
  session_id: string;
  caixa_nome: string;
  valor: number;
  payload_pix: string;
};

type DisplayParams = {
  boxId: string;
  token: string;
};

export default function CustomerDisplay() {
  const [params, setParams] = useState<DisplayParams | null>(null);
  const [cashboxName, setCashboxName] = useState("");
  const [session, setSession] = useState<DisplaySession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const fragment = new URLSearchParams(url.hash.slice(1));
    const boxId = query.get("caixa")?.trim() ?? "";
    const token = query.get("acesso")?.trim() || fragment.get("acesso")?.trim() || "";
    if (query.has("acesso") || fragment.has("acesso")) {
      query.delete("acesso");
      if (fragment.has("acesso")) url.hash = "";
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    if (boxId && token) setParams({ boxId, token });
    else {
      setErrorMessage("Este link da tela do cliente está incompleto.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!params) return;
    const supabase = getSupabase();
    if (!supabase) {
      setErrorMessage("A tela do cliente precisa estar conectada ao Supabase.");
      setLoading(false);
      return;
    }

    let stopped = false;
    let requesting = false;
    const refresh = async () => {
      if (requesting) return;
      requesting = true;
      try {
        const { data, error } = await supabase.rpc("get_cashbox_display_session", {
          p_box_id: params.boxId,
          p_display_token: params.token,
        });
        if (error) throw new Error(error.message);
        const row = Array.isArray(data) ? data[0] : null;
        if (!row?.link_valid) {
          throw new Error("Este link é inválido ou o caixa não está mais ativo.");
        }
        if (stopped) return;
        setErrorMessage("");
        setCashboxName(row.caixa_nome);
        const nextSession = row.session_id ? {
          session_id: row.session_id,
          caixa_nome: row.caixa_nome,
          valor: Number(row.valor),
          payload_pix: row.payload_pix,
        } : null;
        setSession((current) => {
          if (!nextSession) return current === null ? current : null;
          if (
            current
            && current.session_id === nextSession.session_id
            && current.caixa_nome === nextSession.caixa_nome
            && current.valor === nextSession.valor
            && current.payload_pix === nextSession.payload_pix
          ) {
            return current;
          }
          return nextSession;
        });
      } catch (error) {
        console.error("Falha ao atualizar a tela do cliente.", error);
        if (!stopped) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar a cobrança.");
          setSession(null);
        }
      } finally {
        requesting = false;
        if (!stopped) setLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [params]);

  useEffect(() => {
    const payloadPix = session?.payload_pix;
    if (!payloadPix) {
      setQrImage("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(payloadPix, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((image) => {
        if (!cancelled) setQrImage(image);
      })
      .catch((error: unknown) => {
        console.error("Não foi possível gerar o QR Code da tela do cliente.", error);
        if (!cancelled) setErrorMessage("Não foi possível exibir o QR Code desta cobrança.");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.payload_pix]);

  return (
    <main className="grid min-h-0 flex-1 grid-rows-1 place-items-center overflow-hidden bg-[#0b100d] p-3 text-white">
      <section className="grid h-full w-full max-w-5xl grid-rows-[auto_auto_auto_auto_minmax(0,1fr)_auto] gap-2 rounded-3xl border border-white/[.08] bg-[#141b16] p-4 text-center shadow-2xl sm:p-6">
        <div className="mx-auto flex items-center justify-center gap-2">
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-full bg-white p-0.5" />
          <p className="text-xs font-bold tracking-[.25em] text-lime">MERCADO ALTERNATIVO</p>
        </div>
        {!errorMessage && (
          <p className="mx-auto inline-flex rounded-full border border-lime/20 bg-lime/[.06] px-4 py-1.5 text-sm font-semibold text-lime">
            {cashboxName || session?.caixa_nome || "Tela do cliente"}
          </p>
        )}
        {errorMessage ? (
          <div role="alert" className="col-span-full self-center rounded-2xl border border-red-300/15 bg-red-300/[.04] p-5 text-sm text-red-100/85">
            {errorMessage}
          </div>
        ) : session ? (
          <>
            <h1 className="text-xl font-semibold sm:text-2xl">Pague com Pix</h1>
            <p className="text-3xl font-bold text-lime sm:text-4xl">{formatCurrency(session.valor)}</p>
            <div className="grid min-h-0 min-w-0 place-items-center [container-type:size]">
              <div className="grid aspect-square w-[min(100cqw,100cqh,720px)] place-items-center rounded-2xl bg-white p-2">
                {qrImage
                  ? <img src={qrImage} alt={`QR Code Pix de ${formatCurrency(session.valor)}`} className="block h-full w-full object-contain" />
                  : <div className="grid h-full w-full place-items-center text-sm text-black/50">Preparando QR Code...</div>}
              </div>
            </div>
            <p className="text-xs text-white/55 sm:text-sm">Aponte a câmera do aplicativo do seu banco para o QR Code.</p>
          </>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center">
            <h1 className="text-2xl font-semibold">{loading ? "Conectando..." : "Aguardando cobrança"}</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">
              Quando o operador gerar uma cobrança, o QR Code e o valor aparecerão aqui automaticamente.
            </p>
            <span className="mx-auto mt-7 block h-3 w-3 animate-pulse rounded-full bg-lime" />
          </div>
        )}
      </section>
    </main>
  );
}
