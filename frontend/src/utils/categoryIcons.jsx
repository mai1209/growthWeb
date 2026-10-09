import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiBook,
  FiBriefcase,
  FiCoffee,
  FiCreditCard,
  FiDollarSign,
  FiDroplet,
  FiFeather,
  FiFileText,
  FiFilm,
  FiGift,
  FiGlobe,
  FiHeadphones,
  FiHeart,
  FiHome,
  FiMonitor,
  FiMusic,
  FiNavigation,
  FiPackage,
  FiPieChart,
  FiPlay,
  FiScissors,
  FiShoppingBag,
  FiShoppingCart,
  FiSmartphone,
  FiStar,
  FiSun,
  FiTag,
  FiTool,
  FiTrendingUp,
  FiTruck,
  FiTv,
  FiUser,
  FiUsers,
  FiZap,
} from "react-icons/fi";

// Las categorías guardan un emoji (compartido con la app). En la web se muestra
// un ícono de línea del mismo color en su lugar; este mapa traduce cada emoji
// del selector a un ícono. Lo que no esté acá cae al ícono por nombre o a una etiqueta.
const EMOJI_ICONS = {
  "🍔": FiCoffee, "🍕": FiCoffee, "🍎": FiCoffee, "🥑": FiCoffee, "🍞": FiCoffee, "🥩": FiCoffee,
  "🥦": FiCoffee, "☕": FiCoffee, "🍺": FiCoffee, "🍷": FiCoffee, "🧉": FiCoffee, "🍰": FiGift,
  "🛒": FiShoppingCart, "🛍️": FiShoppingBag, "🎁": FiGift, "🏠": FiHome, "🛋️": FiHome,
  "🧹": FiHome, "🧼": FiDroplet, "🧻": FiPackage, "💡": FiZap, "🔌": FiZap,
  "🚗": FiTruck, "🚕": FiTruck, "🚌": FiTruck, "🚆": FiTruck, "✈️": FiNavigation, "⛽": FiDroplet,
  "🚲": FiActivity, "🛵": FiTruck,
  "💊": FiHeart, "🩺": FiHeart, "🏥": FiHeart, "🦷": FiHeart, "🏋️": FiActivity, "🧘": FiActivity, "🧴": FiDroplet,
  "👕": FiShoppingBag, "👟": FiShoppingBag, "👗": FiShoppingBag, "🕶️": FiSun, "💇": FiScissors, "💅": FiFeather,
  "🎬": FiFilm, "🎮": FiPlay, "🎧": FiHeadphones, "🎵": FiMusic, "📺": FiTv, "🎟️": FiStar, "📚": FiBook,
  "🎨": FiFeather, "⚽": FiActivity, "🏀": FiActivity, "🎾": FiActivity,
  "📱": FiSmartphone, "💻": FiMonitor, "🖥️": FiMonitor, "💼": FiBriefcase, "🧾": FiFileText, "🖊️": FiFeather,
  "📈": FiTrendingUp, "📊": FiBarChart2,
  "💵": FiDollarSign, "💳": FiCreditCard, "🏦": FiCreditCard, "💰": FiDollarSign, "🪙": FiPieChart,
  "🎓": FiAward, "🐶": FiHeart, "🐱": FiHeart, "🧸": FiGift, "👶": FiUser,
  "🔧": FiTool, "🛠️": FiTool, "🧰": FiTool, "🌱": FiFeather, "🌍": FiGlobe, "🏖️": FiSun, "🏨": FiHome,
  "🎉": FiStar, "🏷️": FiTag,
};

const NAME_ICONS = [
  [/super|almac|comida|food|resto|cafe|bar\b|verdul|carnic|panad/i, FiShoppingCart],
  [/alquiler|casa|hogar|expensa|luz|gas|agua|internet|servicio/i, FiHome],
  [/sueldo|trabajo|salario|honorario|freelance|venta/i, FiBriefcase],
  [/tarjeta|credito|crédito|prestamo|préstamo|banco|deuda/i, FiCreditCard],
  [/invers|accion|cripto|plazo|fondo/i, FiTrendingUp],
  [/auto|nafta|transporte|uber|taxi|colectivo|viaje|pasaje/i, FiTruck],
  [/salud|medic|farmacia|obra social|gym|gimnasio/i, FiHeart],
  [/ropa|calzado|indument/i, FiShoppingBag],
  [/cine|juego|stream|netflix|spotify|salida|ocio/i, FiFilm],
  [/celular|telefono|teléfono|compu|tecno/i, FiSmartphone],
  [/educ|curso|libro|facultad|colegio/i, FiBook],
  [/familia|hijo|mascota|amig|pareja/i, FiUsers],
];

export const categoryIconFor = (icono, nombre) => {
  const key = typeof icono === "string" ? icono.trim() : "";
  if (key && EMOJI_ICONS[key]) return EMOJI_ICONS[key];
  const texto = String(nombre || "");
  const match = NAME_ICONS.find(([re]) => re.test(texto));
  return match ? match[1] : FiTag;
};

export default function CategoryIcon({ icono, nombre, ...rest }) {
  const Icon = categoryIconFor(icono, nombre);
  return <Icon {...rest} />;
}
