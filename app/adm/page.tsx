import type { Metadata } from "next";
import CaixaApp from "@/components/caixa-app";

export const metadata: Metadata = {
  applicationName: "Mercado Alternativo ADM",
  title: "Mercado Alternativo ADM",
  manifest: "/manifest-adm.json",
};

export default function AdminPage() {
  return <CaixaApp adminPanel />;
}
