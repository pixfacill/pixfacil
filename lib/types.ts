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

export type CashRegister = {
  id: string;
  nome: string;
  ativo: boolean;
  excluido?: boolean;
  created_at: string;
};

export type PixSession = {
  id: string;
  chave_id: string;
  caixa_id: string | null;
  caixa_nome?: string;
  valor: number;
  payload_pix: string;
  status: "pendente" | "pago" | "cancelado";
  created_at: string;
  apelido?: string;
};

export const KEYS_STORAGE = "pixfacil.keys.v1";
export const HISTORY_STORAGE = "pixfacil.history.v1";
export const ACTIVE_SESSION_STORAGE = "pixfacil.active-session.v1";
export const RETENTION_STORAGE = "pixfacil.retention-days.v1";
export const BOXES_STORAGE = "pixfacil.boxes.v1";
export const ACTIVE_BOX_STORAGE = "pixfacil.active-box.v1";

export function activeSessionStorageKey(boxId: string): string {
  return `${ACTIVE_SESSION_STORAGE}.${boxId}`;
}
