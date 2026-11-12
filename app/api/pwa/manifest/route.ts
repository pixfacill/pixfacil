const icon = {
  src: "/icon-192.png",
  sizes: "192x192",
  type: "image/png",
  purpose: "any",
};

const highResolutionIcon = {
  src: "/icon-512.png",
  sizes: "512x512",
  type: "image/png",
  purpose: "any",
};

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const boxId = params.get("caixa");
  if (!boxId || !/^[a-zA-Z0-9_-]{1,128}$/.test(boxId)) {
    return Response.json({ error: "Identificador do caixa inválido." }, { status: 400 });
  }

  const accessToken = params.get("acesso");
  if (accessToken && !/^[a-zA-Z0-9_-]{32,128}$/.test(accessToken)) {
    return Response.json({ error: "Link do caixa inválido." }, { status: 400 });
  }

  const requestedName = params.get("nome")?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const boxName = requestedName?.slice(0, 40) || `Caixa ${boxId.slice(0, 8)}`;
  const appId = `/caixa?caixa=${encodeURIComponent(boxId)}`;
  const startParams = new URLSearchParams({ caixa: boxId, nome: boxName });
  if (accessToken) startParams.set("acesso", accessToken);
  const startUrl = `/caixa?${startParams}`;
  return Response.json(
    {
      id: appId,
      name: `Mercado Alternativo - ${boxName}`,
      short_name: boxName.slice(0, 12),
      description: "Caixa Pix do Mercado Alternativo.",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      background_color: "#111714",
      theme_color: "#111714",
      icons: [icon, highResolutionIcon],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
