import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiList,
  FiMoreVertical,
  FiPlus,
  FiTrash2,
  FiShoppingCart,
  FiX,
} from "react-icons/fi";
import { taskService } from "../api";
import InputMonto from "./InputMonto";
import style from "../style/ShoppingLists.module.css";

const LIST_COLORS = [
  "color1",
  "color4",
  "color3",
  "color5",
  "color7",
  "color6",
  "color2",
];

// Acento vivo por color de lista (la versión saturada del papel pastel)
const LIST_ACCENTS = {
  color1: "#6ee14b",
  color2: "#ff9d5c",
  color3: "#ffd35c",
  color4: "#3ed9a4",
  color5: "#69a7ff",
  color6: "#f070b8",
  color7: "#a78bfa",
  color8: "#ff7a6e",
  color9: "#9ab09a",
  color10: "#a9bfae",
  color11: "#8ea8a8",
};
const accentOf = (c) => LIST_ACCENTS[c] || LIST_ACCENTS.color1;

// Categorías de ítems (chips de color dentro de la lista)
const ITEM_CATS = [
  { key: "hogar", label: "Hogar", emoji: "🏠", color: "#6ee14b" },
  { key: "alimentos", label: "Alimentos", emoji: "🍎", color: "#ffd35c" },
  { key: "limpieza", label: "Limpieza", emoji: "✨", color: "#a78bfa" },
  { key: "bebidas", label: "Bebidas", emoji: "🥤", color: "#69a7ff" },
  { key: "ropa", label: "Ropa", emoji: "👕", color: "#f070b8" },
  { key: "otros", label: "Otros", emoji: "🏷️", color: "#9ba8b0" },
];
const catOf = (key) => ITEM_CATS.find((c) => c.key === key) || ITEM_CATS[ITEM_CATS.length - 1];

// id local para los ítems (no depende del backend).
let itemSeq = 0;
const makeItemId = () => `it_${Date.now().toString(36)}_${(itemSeq++).toString(36)}`;

function ShoppingLists({ activeWorkspace = "personal" }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [openListId, setOpenListId] = useState(null); // null => board; id => detalle
  const [draft, setDraft] = useState(""); // borrador del ítem en el detalle abierto
  const [draftCat, setDraftCat] = useState("otros"); // categoría del ítem nuevo
  const [sortBy, setSortBy] = useState("recientes"); // orden del board
  const [menuId, setMenuId] = useState(null); // card con el menú ⋮ abierto
  const composerInputRef = useRef(null);
  const listsRef = useRef(lists); // estado fresco para mutaciones sincrónicas

  // Cierra el menú ⋮ al hacer click en cualquier otro lado
  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  const fetchLists = useCallback(async () => {
    setError("");
    try {
      const res = await taskService.getAll({ tipo: "shopping", workspace: activeWorkspace });
      const data = Array.isArray(res.data) ? res.data : res.data?.tasks || [];
      // Guarda: si el backend todavía no filtra por "shopping", no dejamos
      // que se cuelen tareas/notas en el panel de listas.
      setLists(data.filter((d) => d && d.tipo === "shopping"));
    } catch {
      setError("No se pudieron cargar las listas.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    setLoading(true);
    setOpenListId(null); // al cambiar de workspace, volvemos al board
    fetchLists();
  }, [fetchLists]);

  // Persiste los ítems de una lista (optimista: la UI ya se actualizó).
  const persistItems = useCallback(
    async (listId, items) => {
      try {
        await taskService.update(listId, { items, workspace: activeWorkspace });
      } catch {
        setError("No se pudo guardar el cambio. Reintentá.");
        fetchLists();
      }
    },
    [activeWorkspace, fetchLists]
  );

  const mutateItems = useCallback(
    (listId, updater) => {
      const target = listsRef.current.find((list) => list._id === listId);
      if (!target) return;
      const nextItems = updater(target.items || []);
      const nextLists = listsRef.current.map((list) =>
        list._id === listId ? { ...list, items: nextItems } : list
      );
      listsRef.current = nextLists; // sincroniza para mutaciones consecutivas
      setLists(nextLists);
      persistItems(listId, nextItems);
    },
    [persistItems]
  );

  const handleCreateList = async (event) => {
    event?.preventDefault?.();
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await taskService.create({
        meta: title,
        tipo: "shopping",
        color: newColor,
        items: [],
        fecha: new Date().toISOString(),
        workspace: activeWorkspace,
      });
      setLists((prev) => [res.data, ...prev]);
      setNewTitle("");
      // rota el color sugerido para la próxima lista
      setNewColor((prev) => {
        const idx = LIST_COLORS.indexOf(prev);
        return LIST_COLORS[(idx + 1) % LIST_COLORS.length];
      });
    } catch {
      setError("No se pudo crear la lista.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm("¿Eliminar esta lista y todos sus ítems?")) return;
    const snapshot = lists;
    if (openListId === listId) setOpenListId(null);
    setLists((prev) => prev.filter((list) => list._id !== listId));
    try {
      await taskService.delete(listId);
    } catch {
      setError("No se pudo eliminar la lista.");
      setLists(snapshot);
    }
  };

  const handleToggleItem = (listId, itemId) =>
    mutateItems(listId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
    );

  const handleDeleteItem = (listId, itemId) =>
    mutateItems(listId, (items) => items.filter((it) => it.id !== itemId));

  const handleAddItem = (listId) => {
    const text = draft.trim();
    if (!text) return;
    mutateItems(listId, (items) => [
      ...items,
      { id: makeItemId(), text, done: false, categoria: draftCat },
    ]);
    setDraft("");
  };

  const handleSetCategoria = (listId, itemId, categoria) =>
    mutateItems(listId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, categoria } : it))
    );

  const handleClearDone = (listId) =>
    mutateItems(listId, (items) => items.filter((it) => !it.done));

  const handleSetPrice = (listId, itemId, precio, cantidad) =>
    mutateItems(listId, (items) =>
      items.map((it) =>
        it.id === itemId ? { ...it, precio, cantidad: cantidad || 1 } : it
      )
    );

  const totalPending = useMemo(
    () => lists.reduce((acc, l) => acc + (l.items || []).filter((it) => !it.done).length, 0),
    [lists]
  );

  // Orden del board según el selector
  const sortedLists = useMemo(() => {
    const arr = [...lists];
    const pend = (l) => (l.items || []).filter((it) => !it.done).length;
    if (sortBy === "az") arr.sort((a, b) => (a.meta || "").localeCompare(b.meta || "", "es"));
    else if (sortBy === "antiguas")
      arr.sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
    else if (sortBy === "pendientes") arr.sort((a, b) => pend(b) - pend(a));
    else arr.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
    return arr;
  }, [lists, sortBy]);

  const openList = openListId ? lists.find((l) => l._id === openListId) : null;

  // ===== Vista detalle: dentro de una lista =====
  if (openList) {
    return (
      <ListDetail
        list={openList}
        draft={draft}
        onDraftChange={setDraft}
        draftCat={draftCat}
        onDraftCatChange={setDraftCat}
        onBack={() => {
          setOpenListId(null);
          setDraft("");
        }}
        onAddItem={() => handleAddItem(openList._id)}
        onToggleItem={(itemId) => handleToggleItem(openList._id, itemId)}
        onDeleteItem={(itemId) => handleDeleteItem(openList._id, itemId)}
        onDeleteList={() => handleDeleteList(openList._id)}
        onClearDone={() => handleClearDone(openList._id)}
        onSetPrice={(itemId, precio, cantidad) =>
          handleSetPrice(openList._id, itemId, precio, cantidad)
        }
        onSetCategoria={(itemId, categoria) =>
          handleSetCategoria(openList._id, itemId, categoria)
        }
      />
    );
  }

  // ===== Vista board: previews de todas las listas =====
  return (
    <div className={style.wrap}>
      {/* Encabezado de la sección */}
      <header className={style.headV2}>
        <div>
          <span className={style.headKicker}>Listas</span>
          <h2 className={style.headTitle}>
            Listas <span>de compras</span>
          </h2>
          <p className={style.headSub}>
            Organizá tus compras, ahorrá tiempo y llevá el control de lo que necesitás.
          </p>
        </div>
        <button
          type="button"
          className={style.headNewBtn}
          onClick={() => composerInputRef.current?.focus()}
        >
          <FiShoppingCart />
          Nueva lista
          <FiPlus />
        </button>
      </header>

      {/* Compositor: nueva lista */}
      <form className={style.composerV2} onSubmit={handleCreateList}>
        <span className={style.composerV2Icon} style={{ "--acc": accentOf(newColor) }}>
          <FiShoppingCart />
        </span>
        <input
          ref={composerInputRef}
          className={style.composerV2Input}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nueva lista (ej: Súper, Ferretería...)"
          maxLength={80}
        />
        <div className={style.swatchRowV2} role="radiogroup" aria-label="Color de la lista">
          {LIST_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${style.swatchV2} ${newColor === c ? style.swatchV2On : ""}`}
              style={{ "--acc": accentOf(c) }}
              onClick={() => setNewColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={newColor === c}
            >
              {newColor === c ? <FiCheck /> : null}
            </button>
          ))}
        </div>
        <button type="submit" className={style.createBtn} disabled={!newTitle.trim() || creating}>
          <FiPlus />
          Crear lista
        </button>
      </form>

      {error ? <p className={style.error}>{error}</p> : null}

      {loading ? (
        <p className={style.hint}>Cargando listas...</p>
      ) : lists.length === 0 ? (
        <p className={style.empty}>
          Todavía no tenés listas de compras. Creá la primera arriba y después entrá para anotar lo que
          necesites comprar.
        </p>
      ) : (
        <>
          {/* Stats + orden */}
          <div className={style.statsRow}>
            <span className={style.statChip}>
              <FiList />
              <strong>{lists.length}</strong> lista{lists.length === 1 ? "" : "s"}
            </span>
            <span className={style.statText}>
              {totalPending} ítem{totalPending === 1 ? "" : "s"} pendiente
              {totalPending === 1 ? "" : "s"} en total
            </span>
            <select
              className={style.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar listas"
            >
              <option value="recientes">Más recientes</option>
              <option value="antiguas">Más antiguas</option>
              <option value="az">A → Z</option>
              <option value="pendientes">Más pendientes</option>
            </select>
          </div>

          <div className={style.boardV2}>
            {sortedLists.map((list) => (
              <PreviewCard
                key={list._id}
                list={list}
                menuOpen={menuId === list._id}
                onToggleMenu={() => setMenuId((prev) => (prev === list._id ? null : list._id))}
                onOpen={() => setOpenListId(list._id)}
                onDeleteList={() => handleDeleteList(list._id)}
                onToggleItem={(itemId) => handleToggleItem(list._id, itemId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Tarjeta de vista previa: tinte del color de la lista, anillo de progreso,
// primeros ítems tildeables, "Ver lista →" y menú ⋮.
const PREVIEW_MAX = 4;
function PreviewCard({ list, menuOpen, onToggleMenu, onOpen, onDeleteList, onToggleItem }) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const pending = items.length - doneCount;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const preview = items.slice(0, PREVIEW_MAX);

  return (
    <article
      className={style.cardV2}
      style={{ "--acc": accentOf(list.color), "--p": pct }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      title={`Abrir "${list.meta || "Sin título"}"`}
    >
      <header className={style.cardV2Head}>
        <span className={style.cardV2Icon}>
          <FiShoppingCart />
        </span>
        <span className={style.cardV2Ring} aria-label={`${doneCount} de ${items.length} comprados`}>
          <span>{items.length ? `${doneCount}/${items.length}` : "0"}</span>
        </span>
      </header>

      <h3 className={style.cardV2Title}>{list.meta || "Sin título"}</h3>
      <p className={style.cardV2Meta}>
        {items.length
          ? `${items.length} ítem${items.length === 1 ? "" : "s"} · ${
              pending === 0 ? "todo comprado" : `${pending} pendiente${pending === 1 ? "" : "s"}`
            }`
          : "Lista vacía"}
      </p>

      {preview.length > 0 ? (
        <ul className={style.cardV2Items}>
          {preview.map((it) => (
            <li key={it.id} className={it.done ? style.cardV2ItemDone : ""}>
              <button
                type="button"
                className={`${style.cardV2Check} ${it.done ? style.cardV2CheckOn : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleItem(it.id);
                }}
                aria-label={it.done ? "Marcar como pendiente" : "Marcar como comprado"}
                aria-pressed={it.done}
              >
                {it.done ? <FiCheck /> : null}
              </button>
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length > PREVIEW_MAX ? (
        <span className={style.cardV2More}>+{items.length - PREVIEW_MAX} más</span>
      ) : null}

      <footer className={style.cardV2Foot}>
        <button
          type="button"
          className={style.cardV2Open}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          Ver lista <FiArrowRight />
        </button>
        <div className={style.cardV2MenuWrap}>
          <button
            type="button"
            className={style.cardV2MenuBtn}
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu();
            }}
            aria-label="Opciones de la lista"
            aria-expanded={menuOpen}
          >
            <FiMoreVertical />
          </button>
          {menuOpen ? (
            <div className={style.cardV2Menu} onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={onOpen}>
                <FiArrowRight /> Abrir
              </button>
              <button type="button" className={style.cardV2MenuDanger} onClick={onDeleteList}>
                <FiTrash2 /> Eliminar
              </button>
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

// Vista detalle: acá se anotan y tildan los ítems de la lista.
function ListDetail({
  list,
  draft,
  onDraftChange,
  draftCat,
  onDraftCatChange,
  onBack,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
  onClearDone,
  onSetPrice,
  onSetCategoria,
}) {
  const inputRef = useRef(null);
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const acc = accentOf(list.color);

  // Filtro por categoría + orden de los ítems (solo presentación)
  const [filtroCat, setFiltroCat] = useState("todas");
  const [ordenItems, setOrdenItems] = useState("recientes");
  const [catMenuId, setCatMenuId] = useState(null); // ítem con el selector de categoría abierto

  useEffect(() => {
    if (!catMenuId) return undefined;
    const close = () => setCatMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [catMenuId]);

  const visibleItems = useMemo(() => {
    let arr = items;
    if (filtroCat !== "todas") arr = arr.filter((it) => (it.categoria || "otros") === filtroCat);
    arr = [...arr];
    if (ordenItems === "recientes") arr.reverse();
    else if (ordenItems === "az") arr.sort((a, b) => (a.text || "").localeCompare(b.text || "", "es"));
    else if (ordenItems === "pendientes") arr.sort((a, b) => Number(a.done) - Number(b.done));
    return arr;
  }, [items, filtroCat, ordenItems]);
  const pendVisible = visibleItems.filter((it) => !it.done).length;

  // Precio por ítem (precio unitario × cantidad); el total suma cada línea.
  const [priceOpenId, setPriceOpenId] = useState(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [qtyDraft, setQtyDraft] = useState("1");
  const fmt = (n) => Number(n || 0).toLocaleString("es-AR");
  const lineaTotal = (it) => (Number(it.precio) || 0) * (Number(it.cantidad) || 1);
  const total = items.reduce((acc, it) => acc + lineaTotal(it), 0);

  const abrirPrecio = (it) => {
    setPriceOpenId(it.id);
    setPriceDraft(it.precio != null ? String(it.precio) : "");
    setQtyDraft(it.cantidad ? String(it.cantidad) : "1");
  };
  const guardarPrecio = (itemId) => {
    const n = parseFloat(String(priceDraft).replace(",", "."));
    const q = parseInt(qtyDraft, 10);
    onSetPrice(
      itemId,
      Number.isFinite(n) && n >= 0 ? n : null,
      Number.isFinite(q) && q >= 1 ? q : 1
    );
    setPriceOpenId(null);
    setPriceDraft("");
    setQtyDraft("1");
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submitItem = (event) => {
    event.preventDefault();
    onAddItem();
    inputRef.current?.focus();
  };

  return (
    <div className={style.wrap}>
      <button type="button" className={style.backBtn} onClick={onBack}>
        <FiArrowLeft />
        Volver a las listas
      </button>

      <section className={style.detailV2} style={{ "--acc": acc }}>
        {/* Encabezado con icono, rótulo y carrito de fondo */}
        <FiShoppingCart className={style.detailV2Marca} aria-hidden />
        <header className={style.detailV2Head}>
          <span className={style.detailV2Icon}>
            <FiShoppingCart />
          </span>
          <div className={style.detailV2Titles}>
            <span className={style.detailV2Kicker}>Lista de compras</span>
            <h3 className={style.detailV2Title}>{list.meta || "Sin título"}</h3>
            <p className={style.detailV2Sub}>
              {items.length
                ? `${items.length} ítem${items.length === 1 ? "" : "s"} · ${
                    items.length - doneCount === 0
                      ? "todo comprado"
                      : `${items.length - doneCount} pendiente${items.length - doneCount === 1 ? "" : "s"}`
                  }`
                : "Anotá lo que necesites comprar."}
            </p>
          </div>
          <button
            type="button"
            className={style.deleteListBtn}
            onClick={onDeleteList}
            aria-label="Eliminar lista"
            title="Eliminar lista"
          >
            <FiTrash2 />
          </button>
        </header>

        {/* Barra de agregar: ítem + categoría + filtro */}
        <form className={style.addRowV2} onSubmit={submitItem}>
          <input
            ref={inputRef}
            className={style.addInputV2}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Agregar un ítem..."
            maxLength={120}
          />
          <button type="submit" className={style.addBtnV2} disabled={!draft.trim()}>
            <FiPlus />
            Agregar
          </button>
          <div className={style.catDots} role="radiogroup" aria-label="Categoría del ítem nuevo">
            {ITEM_CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${style.catDot} ${draftCat === c.key ? style.catDotOn : ""}`}
                style={{ "--cat": c.color }}
                onClick={() => onDraftCatChange(c.key)}
                aria-pressed={draftCat === c.key}
                title={c.label}
              >
                <span aria-hidden>{c.emoji}</span>
              </button>
            ))}
          </div>
          <select
            className={style.sortSelect}
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="todas">Todas</option>
            {ITEM_CATS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </form>

        {/* Stats + orden */}
        <div className={style.detailStats}>
          <span className={style.statChip}>
            <FiList />
            <strong>{visibleItems.length}</strong> ítem{visibleItems.length === 1 ? "" : "s"} ·{" "}
            {pendVisible} pendiente{pendVisible === 1 ? "" : "s"}
          </span>
          <select
            className={style.sortSelect}
            value={ordenItems}
            onChange={(e) => setOrdenItems(e.target.value)}
            aria-label="Ordenar ítems"
            style={{ marginLeft: "auto" }}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="az">A → Z</option>
            <option value="pendientes">Pendientes primero</option>
          </select>
        </div>

        <ul className={style.itemsV2}>
          {visibleItems.length === 0 ? (
            <li className={style.itemEmpty}>
              {items.length === 0
                ? "Todavía no anotaste nada. Escribí arriba para empezar."
                : "No hay ítems en esta categoría."}
            </li>
          ) : (
            visibleItems.map((it) => {
              const cat = catOf(it.categoria);
              return (
              <li key={it.id} className={`${style.itemV2} ${it.done ? style.itemV2Done : ""}`}>
                <button
                  type="button"
                  className={`${style.checkV2} ${it.done ? style.checkV2On : ""}`}
                  onClick={() => onToggleItem(it.id)}
                  aria-label={it.done ? "Marcar como pendiente" : "Marcar como comprado"}
                  aria-pressed={it.done}
                >
                  {it.done ? <FiCheck /> : null}
                </button>
                <span className={style.itemTextV2}>{it.text}</span>

                {/* Chip de categoría: click para cambiarla */}
                <span className={style.catChipWrap}>
                  <button
                    type="button"
                    className={style.catChip}
                    style={{ "--cat": cat.color }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCatMenuId((prev) => (prev === it.id ? null : it.id));
                    }}
                    title="Cambiar categoría"
                  >
                    <span aria-hidden>{cat.emoji}</span> {cat.label}
                  </button>
                  {catMenuId === it.id ? (
                    <div className={style.catMenu} onClick={(event) => event.stopPropagation()}>
                      {ITEM_CATS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          style={{ "--cat": c.color }}
                          className={(it.categoria || "otros") === c.key ? style.catMenuOn : ""}
                          onClick={() => {
                            onSetCategoria(it.id, c.key);
                            setCatMenuId(null);
                          }}
                        >
                          <span aria-hidden>{c.emoji}</span> {c.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </span>

                {priceOpenId === it.id ? (
                  <span
                    className={style.precioEdit}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        guardarPrecio(it.id);
                      }
                    }}
                  >
                    <InputMonto
                      className={style.precioInput}
                      value={priceDraft}
                      onChange={setPriceDraft}
                      required={false}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          guardarPrecio(it.id);
                        }
                      }}
                      placeholder="$"
                    />
                    <span className={style.precioX}>×</span>
                    <input
                      className={style.cantInput}
                      type="number"
                      min="1"
                      step="1"
                      value={qtyDraft}
                      onChange={(e) => setQtyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          guardarPrecio(it.id);
                        }
                      }}
                      aria-label="Cantidad"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`${style.precioBtn} ${it.precio != null ? style.precioBtnSet : ""}`}
                    onClick={() => abrirPrecio(it)}
                    title="Ponerle precio (precio × cantidad)"
                  >
                    {it.precio != null
                      ? Number(it.cantidad) > 1
                        ? `$ ${fmt(lineaTotal(it))} · ×${it.cantidad}`
                        : `$ ${fmt(it.precio)}`
                      : "precio"}
                  </button>
                )}

                <button
                  type="button"
                  className={style.itemDelete}
                  onClick={() => onDeleteItem(it.id)}
                  aria-label="Quitar ítem"
                  title="Quitar ítem"
                >
                  <FiX />
                </button>
              </li>
              );
            })
          )}
        </ul>

        {total > 0 ? (
          <div className={style.totalRow}>
            <span className={style.totalLabel}>Total</span>
            <strong className={style.totalMonto}>$ {fmt(total)}</strong>
          </div>
        ) : null}

        {/* Barra inferior: comprados + limpiar */}
        <div className={style.footBarV2}>
          <span className={style.footBarInfo}>
            <FiShoppingCart />
            {doneCount} comprado{doneCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className={style.footBarDelete}
            onClick={onClearDone}
            disabled={doneCount === 0}
          >
            <FiTrash2 />
            Eliminar comprados
          </button>
        </div>
      </section>
    </div>
  );
}

export default ShoppingLists;
