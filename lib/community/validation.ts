export type KetQuaNoiDung = { value: string } | { error: string };
export type LoaiBai = "chia-se" | "cau-hoi";

export function docLoaiBai(raw: unknown): LoaiBai | null {
  return raw === "chia-se" || raw === "cau-hoi" ? raw : null;
}

export function docNoiDung(raw: unknown, max: number): KetQuaNoiDung {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: "Nội dung không được để trống." };
  if ([...value].length > max) {
    return { error: `Nội dung không được vượt quá ${max} ký tự.` };
  }
  return { value };
}
