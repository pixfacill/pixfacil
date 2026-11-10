import type { SupabaseClient } from "@supabase/supabase-js";

export async function hashCashboxToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createCashboxToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function redeemCashboxLink(
  supabase: SupabaseClient,
  boxId: string,
  token: string,
): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Não foi possível verificar a sessão: ${sessionError.message}`);
  if (!sessionData.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`Não foi possível iniciar a sessão do caixa: ${error.message}`);
  }

  const { error } = await supabase.rpc("redeem_cashbox_link", {
    p_box_id: boxId,
    p_access_token: token,
  });
  if (error) throw new Error(`Link do caixa inválido ou revogado: ${error.message}`);
}
