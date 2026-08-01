import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiPlus,
  FiTrash2,
  FiShoppingCart,
  FiX,
} from "react-icons/fi";
import { taskService } from "../api";
import InputMonto from "./InputMonto";
import colorStyle from "../style/TaskStudio.module.css";
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
  const listsRef = useRef(lists); // estado fresco para mutaciones sincrónicas

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
    mutateItems(listId, (items) => [...items, { id: makeItemId(), text, done: false }]);
    setDraft("");
  };

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

  const openList = openListId ? lists.find((l) => l._id === openListId) : null;

  // ===== Vista detalle: dentro de una lista =====
  if (openList) {
    return (
      <ListDetail
        list={openList}
        colorClass={colorStyle[openList.color] || colorStyle.color1}
        draft={draft}
        onDraftChange={setDraft}
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
      />
    );
  }

  // ===== Vista board: previews de todas las listas =====
  return (
    <div className={style.wrap}>
      {/* Compositor: nueva lista */}
      <form className={style.composer} onSubmit={handleCreateList}>
        <div className={style.composerRow}>
          <FiShoppingCart className={style.composerIcon} />
          <input
            className={style.composerInput}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nueva lista (ej. Supermercado, Ferretería...)"
            maxLength={80}
          />
          <button type="submit" className={style.createBtn} disabled={!newTitle.trim() || creating}>
            <FiPlus />
            Crear lista
          </button>
          <div className={style.swatchRow} role="radiogroup" aria-label="Color de la lista">
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${style.swatch} ${colorStyle[c]} ${newColor === c ? style.swatchActive : ""}`}
                onClick={() => setNewColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={newColor === c}
              />
            ))}
          </div>
        </div>
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
          {totalPending > 0 ? (
            <p className={style.summary}>
              {totalPending} ítem{totalPending === 1 ? "" : "s"} pendiente
              {totalPending === 1 ? "" : "s"} en total
            </p>
          ) : null}
          <div className={style.board}>
            {lists.map((list) => (
              <PreviewCard
                key={list._id}
                list={list}
                colorClass={colorStyle[list.color] || colorStyle.color1}
                onOpen={() => setOpenListId(list._id)}
                onDeleteList={() => handleDeleteList(list._id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Tarjeta de vista previa: solo título + resumen + tachito. Se abre al hacer click.
function PreviewCard({ list, colorClass, onOpen, onDeleteList }) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const pending = items.length - doneCount;
  const isDark = list.color === "color11";

  const summary = !items.length
    ? "Lista vacía"
    : pending === 0
    ? "Todo comprado"
    : `${pending} pendiente${pending === 1 ? "" : "s"} · ${items.length} ítem${items.length === 1 ? "" : "s"}`;

  return (
    <article
      className={`${style.previewCard} ${colorClass} ${isDark ? style.cardDark : ""}`}
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
      <div className={style.previewTopRight}>
        <FiChevronRight className={style.previewChevron} />
        <button
          type="button"
          className={style.deleteListBtn}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteList();
          }}
          aria-label="Eliminar lista"
          title="Eliminar lista"
        >
          <FiTrash2 />
        </button>
      </div>

      <h3 className={style.previewTitle}>{list.meta || "Sin título"}</h3>
      <div className={style.previewFooter}>
        <span className={style.previewSummary}>{summary}</span>
      </div>
    </article>
  );
}

// Vista detalle: acá se anotan y tildan los ítems de la lista.
function ListDetail({
  list,
  colorClass,
  draft,
  onDraftChange,
  onBack,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
  onClearDone,
  onSetPrice,
}) {
  const inputRef = useRef(null);
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const isDark = list.color === "color11";

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

      <section className={`${style.detailCard} ${colorClass} ${isDark ? style.cardDark : ""}`}>
        <header className={style.detailHead}>
          <div className={style.detailTitleWrap}>
            <h3 className={style.detailTitle}>{list.meta || "Sin título"}</h3>
            <span className={style.cardCount}>
              {items.length ? `${doneCount}/${items.length}` : "vacía"}
            </span>
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

        <form className={style.addRow} onSubmit={submitItem}>
          <input
            ref={inputRef}
            className={style.addInput}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Anotá un ítem y presioná Enter..."
            maxLength={120}
          />
          <button type="submit" className={style.addBtn} disabled={!draft.trim()} aria-label="Agregar ítem">
            <FiPlus />
          </button>
        </form>

        <ul className={style.items}>
          {items.length === 0 ? (
            <li className={style.itemEmpty}>Todavía no anotaste nada. Escribí arriba para empezar.</li>
          ) : (
            items.map((it) => (
              <li key={it.id} className={`${style.item} ${it.done ? style.itemDone : ""}`}>
                <button
                  type="button"
                  className={`${style.check} ${it.done ? style.checkDone : ""}`}
                  onClick={() => onToggleItem(it.id)}
                  aria-label={it.done ? "Marcar como pendiente" : "Marcar como comprado"}
                  aria-pressed={it.done}
                >
                  {it.done ? <FiCheck /> : null}
                </button>
                <span className={style.itemText}>{it.text}</span>

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
            ))
          )}
        </ul>

        {total > 0 ? (
          <div className={style.totalRow}>
            <span className={style.totalLabel}>Total</span>
            <strong className={style.totalMonto}>$ {fmt(total)}</strong>
          </div>
        ) : null}

        {doneCount > 0 ? (
          <button type="button" className={style.clearDone} onClick={onClearDone}>
            Quitar {doneCount} comprado{doneCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </section>
    </div>
  );
}

export default ShoppingLists;
