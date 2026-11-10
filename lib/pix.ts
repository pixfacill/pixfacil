import type { PixKey } from "@/lib/types";

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function cleanText(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(key: PixKey, amount: number, transactionId = "***"): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (!key.chave.trim()) {
    throw new Error("A chave Pix selecionada está vazia.");
  }

  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", key.chave.trim());
  const amountString = amount.toFixed(2);
  const txid = transactionId.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const additionalData = emv("05", txid);
  const payload =
    emv("00", "01") +
    emv("26", merchantAccount) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amountString) +
    emv("58", "BR") +
    emv("59", cleanText(key.titular || key.apelido || "LOJA", 25)) +
    emv("60", cleanText(key.cidade || "BRASILIA", 15)) +
    emv("62", additionalData) +
    "6304";
  return payload + crc16(payload);
}

export function parseAmount(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "");
  let normalized: string;

  if (raw.includes(",")) {
    const parts = raw.split(",");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
    if (!/^\d+$/.test(parts[0]) && !/^\d{1,3}(?:\.\d{3})+$/.test(parts[0])) return null;
    normalized = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else if (/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    normalized = raw;
  } else {
    return null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
