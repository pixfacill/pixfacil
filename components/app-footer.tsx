"use client";

import { usePathname } from "next/navigation";

const SUPPORT_URL = "https://wa.me/5548992185588";
const SUPPORT_MESSAGE = [
  "Olá! Preciso de suporte para o sistema Mercado Alternativo Pix.",
  "Estabelecimento:",
  "Caixa ou tela:",
  "O que aconteceu:",
].join("\n");
const SUPPORT_LINK = `${SUPPORT_URL}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;

export default function AppFooter() {
  const pathname = usePathname();

  if (pathname === "/adm") {
    return (
      <footer className="border-t border-white/[.06] px-4 py-5 text-center">
        <p className="text-sm font-semibold text-white/70">© 2026 Mercado Alternativo. Todos os direitos reservados.</p>
        <p className="mt-1 text-xs text-white/40">Desenvolvido por <span className="font-medium text-white/55">Tex-TrampoExpress</span></p>
        <a
          href={SUPPORT_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-lime/75 transition hover:text-lime"
        >
          Suporte via WhatsApp
        </a>
        <a
          href="/termos"
          className="mt-2 block text-[11px] text-white/40 transition hover:text-white/70"
        >
          Licenciamento e termos de uso
        </a>
      </footer>
    );
  }

  if (pathname === "/display") {
    return (
      <footer className="px-4 py-1 text-center text-[11px] leading-4 text-white/50 sm:text-xs">
        Desenvolvido por Tex-TrampoExpress
      </footer>
    );
  }

  return (
    <footer className="px-4 py-2 text-center text-[10px] leading-4 text-white/40">
      Desenvolvido por Tex-TrampoExpress
    </footer>
  );
}
