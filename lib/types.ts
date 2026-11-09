export type PixKeyType = "telefone" | "cpf" | "cnpj" | "email" | "aleatoria";

export type PixKey = {
  id: string;
  apelido: string;
  tipo_chave: PixKeyType;
  chave: string;
  titular: string;
  cidade: string;
  ativa: boolean;
  created_at: string;
};

export type PixSession = {
  id: string;
  chave_id: string;
  valor: number;
  payload_pix: string;
  status: "pendente" | "pago";
  created_at: string;
  apelido?: string;
};

export const DEFAULT_KEY: PixKey = {
  id: "local-default",
  apelido: "Chave de teste",
  tipo_chave: "aleatoria",
  chave: "123e4567-e12b-12d1-a456-426614174000",
  titular: "MINIMERCADO",
  cidade: "SAO PAULO",
  ativa: true,
  created_at: new Date(0).toISOString(),
};

export const KEYS_STORAGE = "pixfacil.keys.v1";
export const HISTORY_STORAGE = "pixfacil.history.v1";
export const ACTIVE_SESSION_STORAGE = "pixfacil.active-session.v1";
export const RETENTION_STORAGE = "pixfacil.retention-days.v1";
