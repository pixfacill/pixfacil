import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  }

  const setupKey = process.env.INITIAL_ADMIN_SETUP_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ROLE_KEY;
  const missing: string[] = [];
  if (!setupKey || setupKey.length < 32) missing.push("INITIAL_ADMIN_SETUP_KEY (mínimo 32 caracteres)");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ROLE_KEY (chave secreta do servidor)");
  if (!setupKey || setupKey.length < 32 || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: `Faltam configurações no servidor para criar o administrador: ${missing.join("; ")}.` },
      { status: 503 },
    );
  }

  let body: { setupKey?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de configuração inválidos." }, { status: 400 });
  }

  const submittedKey = typeof body.setupKey === "string" ? Buffer.from(body.setupKey) : Buffer.alloc(0);
  const expectedKey = Buffer.from(setupKey);
  if (
    submittedKey.length !== expectedKey.length ||
    !timingSafeEqual(submittedKey, expectedKey)
  ) {
    return NextResponse.json({ error: "Código inicial incorreto." }, { status: 403 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
    return NextResponse.json({ error: "Informe um e-mail válido e uma senha de pelo menos 12 caracteres." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !userData.user) {
    return NextResponse.json({ error: createError?.message ?? "Não foi possível criar o usuário administrador." }, { status: 400 });
  }

  const { data: claimed, error: claimError } = await adminClient.rpc("claim_first_admin", {
    p_user_id: userData.user.id,
  });
  if (claimError || claimed !== true) {
    await adminClient.auth.admin.deleteUser(userData.user.id);
    return NextResponse.json(
      { error: claimError?.message ?? "A configuração inicial já foi concluída." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
