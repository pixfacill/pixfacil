import type { Metadata } from "next";
import CaixaApp from "@/components/caixa-app";

type CaixaPageProps = {
  searchParams: Promise<{ caixa?: string | string[]; nome?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: CaixaPageProps): Promise<Metadata> {
  const { caixa, nome } = await searchParams;
  const boxId = Array.isArray(caixa) ? caixa[0] : caixa;
  const boxName = Array.isArray(nome) ? nome[0] : nome;
  const appName = boxName?.trim().slice(0, 40) || "Caixa";
  const manifestUrl = boxId
    ? `/api/pwa/manifest?caixa=${encodeURIComponent(boxId)}&nome=${encodeURIComponent(appName)}`
    : "/manifest-caixa.json";

  return {
    applicationName: `Mercado Alternativo - ${appName}`,
    title: `${appName} | Mercado Alternativo`,
    manifest: manifestUrl,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: appName,
    },
  };
}

export default function CaixaPage() {
  return <CaixaApp />;
}
