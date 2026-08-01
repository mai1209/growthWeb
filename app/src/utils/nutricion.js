// Cálculo de la norma diaria de calorías y macros (todo local, sin IA).

export const ACTIVIDADES = [
  { key: "sedentario", label: "Sedentario", factor: 1.2 },
  { key: "ligero", label: "Ligero", factor: 1.375 },
  { key: "moderado", label: "Moderado", factor: 1.55 },
  { key: "activo", label: "Activo", factor: 1.725 },
];

export const OBJETIVOS = [
  { key: "bajar", label: "Bajar grasa", ajuste: 0.8 },
  { key: "mantener", label: "Mantener", ajuste: 1 },
  { key: "ganar", label: "Ganar músculo", ajuste: 1.1 },
];

// cfg: { peso (kg), altura (cm), edad, sexo: "H"|"M", actividad, objetivo }
// Devuelve { kcal, carbG, protG, fatG } o null si faltan datos.
export function calcularPlan(cfg) {
  if (!cfg) return null;
  const peso = Number(cfg.peso);
  const altura = Number(cfg.altura);
  const edad = Number(cfg.edad);
  if (!peso || !altura || !edad) return null;

  // Mifflin-St Jeor
  const bmr = 10 * peso + 6.25 * altura - 5 * edad + (cfg.sexo === "M" ? -161 : 5);
  const factor = ACTIVIDADES.find((a) => a.key === cfg.actividad)?.factor || 1.375;
  const ajuste = OBJETIVOS.find((o) => o.key === cfg.objetivo)?.ajuste ?? 1;
  const kcal = Math.round((bmr * factor * ajuste) / 10) * 10;

  // Macros: proteína y grasa según peso corporal, el resto en carbohidratos.
  const protG = Math.round(2 * peso);
  const fatG = Math.round(0.9 * peso);
  const carbKcal = Math.max(0, kcal - protG * 4 - fatG * 9);
  const carbG = Math.round(carbKcal / 4);

  return { kcal, carbG, protG, fatG };
}
