import { requireOptionalNativeModule } from "expo";

// El módulo puede no existir (Expo Go, o build sin la extensión): degradamos a no-op.
const M = requireOptionalNativeModule("GrowthLiveActivity");

export function liveActivitySupported(): boolean {
  try {
    return M?.isSupported?.() ?? false;
  } catch {
    return false;
  }
}

export function startWalkActivity(metros: number, segundos: number): string | null {
  try {
    return M?.start?.(metros, segundos) ?? null;
  } catch {
    return null;
  }
}

export function updateWalkActivity(metros: number, segundos: number): void {
  try {
    M?.update?.(metros, segundos);
  } catch {}
}

export function endWalkActivity(): void {
  try {
    M?.end?.();
  } catch {}
}
