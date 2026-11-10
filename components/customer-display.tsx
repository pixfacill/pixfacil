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
    const query = new URLSearchParams(window.location.search);
    const boxId = query.get("caixa")?.trim() ?? "";
    const token = query.get("acesso")?.trim() ?? "";
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
        setSession(row.session_id ? {
          session_id: row.session_id,
          caixa_nome: row.caixa_nome,
          valor: Number(row.valor),
          payload_pix: row.payload_pix,
        } : null);
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
    if (!session) {
      setQrImage("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(session.payload_pix, {
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
  }, [session]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b100d] px-4 py-8 text-white">
      <section className="w-full max-w-3xl rounded-3xl border border-white/[.08] bg-[#141b16] p-6 text-center shadow-2xl sm:p-10">
        <p className="text-xs font-bold tracking-[.25em] text-lime">MERCADO ALTERNATIVO</p>
        {!errorMessage && (
          <p className="mx-auto mt-4 inline-flex rounded-full border border-lime/20 bg-lime/[.06] px-4 py-2 text-sm font-semibold text-lime">
            {cashboxName || session?.caixa_nome || "Tela do cliente"}
          </p>
        )}
        {errorMessage ? (
          <div role="alert" className="mt-8 rounded-2xl border border-red-300/15 bg-red-300/[.04] p-5 text-sm text-red-100/85">
            {errorMessage}
          </div>
        ) : session ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold">Pague com Pix</h1>
            <p className="mt-3 text-4xl font-bold text-lime">{formatCurrency(session.valor)}</p>
            <div className="mx-auto mt-6 w-full max-w-[min(72vw,520px)] rounded-2xl bg-white p-3">
              {qrImage
                ? <img src={qrImage} alt={`QR Code Pix de ${formatCurrency(session.valor)}`} className="aspect-square w-full" />
                : <div className="grid aspect-square place-items-center text-sm text-black/50">Preparando QR Code...</div>}
            </div>
            <p className="mt-5 text-sm text-white/55">Aponte a câmera do aplicativo do seu banco para o QR Code.</p>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-semibold">{loading ? "Conectando..." : "Aguardando cobrança"}</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">
              Quando o operador gerar uma cobrança, o QR Code e o valor aparecerão aqui automaticamente.
            </p>
            <span className="mx-auto mt-7 block h-3 w-3 animate-pulse rounded-full bg-lime" />
          </>
        )}
      </section>
    </main>
  );
}
