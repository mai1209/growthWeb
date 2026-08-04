// Búsqueda de comidas en Open Food Facts (gratis, sin API key) como respaldo
// del listado local. Devuelve items con el mismo formato que BASE_COMIDAS
// ({ nombre, unidad, gramos, kcal, carbG, protG, fatG, online:true }).
// Si falla la red o no hay resultados, devuelve [] (no rompe nada).
const OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl";

function normalizar(p) {
  const n = p.nutriments || {};
  let nombre = String(p.product_name || "").trim();
  if (!nombre) return null;
  const marca = p.brands ? String(p.brands).split(",")[0].trim() : "";
  if (marca && !nombre.toLowerCase().includes(marca.toLowerCase())) nombre = `${nombre} (${marca})`;
  nombre = nombre.slice(0, 50);

  const kcal100 = Number(n["energy-kcal_100g"]);
  if (!kcal100 || kcal100 <= 0 || kcal100 > 900) return null; // datos raros → descartar
  const carb100 = Number(n.carbohydrates_100g) || 0;
  const prot100 = Number(n.proteins_100g) || 0;
  const fat100 = Number(n.fat_100g) || 0;

  const serv = Number(p.serving_quantity);
  if (serv > 0 && serv < 1000) {
    const f = serv / 100;
    return {
      nombre,
      unidad: "porción",
      gramos: Math.round(serv),
      kcal: Math.round(kcal100 * f),
      carbG: Math.round(carb100 * f),
      protG: Math.round(prot100 * f),
      fatG: Math.round(fat100 * f),
      online: true,
    };
  }
  return {
    nombre,
    unidad: "100 g",
    gramos: 100,
    kcal: Math.round(kcal100),
    carbG: Math.round(carb100),
    protG: Math.round(prot100),
    fatG: Math.round(fat100),
    online: true,
  };
}

export async function buscarComidasOFF(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const url =
    `${OFF_URL}?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=20` +
    `&fields=product_name,brands,nutriments,serving_quantity`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const vistos = new Set();
    const out = [];
    for (const p of data.products || []) {
      const item = normalizar(p);
      if (!item) continue;
      const key = item.nombre.toLowerCase();
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push(item);
      if (out.length >= 10) break;
    }
    return out;
  } catch {
    return [];
  }
}
