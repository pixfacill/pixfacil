import type { Metadata } from "next";
import CaixaApp from "@/components/caixa-app";

type CaixaPageProps = {
  searchParams: Promise<{ caixa?: string | string[]; nome?: string | string[]; acesso?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: CaixaPageProps): Promise<Metadata> {
  const { caixa, nome, acesso } = await searchParams;
  const boxId = Array.isArray(caixa) ? caixa[0] : caixa;
  const boxName = Array.isArray(nome) ? nome[0] : nome;
  const accessToken = Array.isArray(acesso) ? acesso[0] : acesso;
  const appName = boxName?.trim().slice(0, 40) || "Caixa";
  const manifestParams = new URLSearchParams({ caixa: boxId ?? "", nome: appName });
  if (accessToken) manifestParams.set("acesso", accessToken);
  const manifestUrl = boxId ? `/api/pwa/manifest?${manifestParams}` : "/manifest-caixa.json";

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
