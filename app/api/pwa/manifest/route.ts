const icon = {
  src: "/icon.svg",
  sizes: "any",
  type: "image/svg+xml",
  purpose: "any maskable",
};

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const boxId = params.get("caixa");
  if (!boxId || !/^[a-zA-Z0-9_-]{1,128}$/.test(boxId)) {
    return Response.json({ error: "Identificador do caixa inválido." }, { status: 400 });
  }

  const requestedName = params.get("nome")?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const boxName = requestedName?.slice(0, 40) || `Caixa ${boxId.slice(0, 8)}`;
  const startUrl = `/caixa?caixa=${encodeURIComponent(boxId)}`;
  return Response.json(
    {
      id: startUrl,
      name: `Mercado Alternativo - ${boxName}`,
      short_name: boxName.slice(0, 12),
      description: "Caixa Pix do Mercado Alternativo.",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      background_color: "#111714",
      theme_color: "#111714",
      icons: [icon],
    },
    {
      headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
    },
  );
}
