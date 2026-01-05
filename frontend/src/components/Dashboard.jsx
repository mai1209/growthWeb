//import { useState } from 'react';
import Results from "./Results";
import Add from "./Add";
import style from "../style/App.module.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard({
  token,
  movimientos,
  refreshKey,
  onMovementUpdate,
  movementToEdit,
  setMovementToEdit,

  ...authProps
}) {
  // const navigate removed: no pantalla completa button desired
  const [showOnly, setShowOnly] = useState(null); // null | 'ingreso' | 'egreso'
  const [selectedType, setSelectedType] = useState("ingreso"); // switch control
  // --- NUEVO ESTADO: controlar si se ven todos los movimientos ---
  //const [showAllMovimientos, setShowAllMovimientos] = useState(false);

  // --- FUNCIONES QUE PASAMOS A RESULTS ---
  const navigate = useNavigate();

  const handleEditClick = (mov) => {
    // set the movement to edit at App level and navigate to the Add page
    if (setMovementToEdit) setMovementToEdit(mov);
    navigate("/add");
  };

  return (
    <div className={style.contentSide}>
      {token && (
        <div className={style.contentAllCargar}>
          {!showOnly && (
            <div className={style.typeButtons}>
              <button
                className={`${style.typeButton} ${
                  selectedType === "ingreso" ? style.activeIngreso : ""
                }  ${style.ingresoBtn} `}
                onClick={() => {
                  setSelectedType("ingreso");
                  setShowOnly("ingreso");
                }}
              >
                <div className={style.contentButton}>
                  <p>Agrega un Ingreso</p>
                  <img src="./Egreso.png" alt="ingreso" />
                </div>
              </button>

              <button
                className={`${style.typeButton} ${
                  selectedType === "egreso" ? style.activeEgreso : ""
                }  ${style.egresoBtn}`}
                onClick={() => {
                  setSelectedType("egreso");
                  setShowOnly("egreso");
                }}
              >
                <div className={style.contentButton}>
                  <p>Agrega un Egreso</p>
                  <img src="./Egreso.png" alt="egreso" />
                </div>
              </button>
            </div>
          )}
        </div>
      )}
      {!showOnly && (
        <Results
          token={token}
          movimientos={movimientos}
          refreshKey={refreshKey}
          onEditClick={handleEditClick}
          onMovementUpdate={onMovementUpdate}
          // onShowAllChange={handleShowAllChange} // <-- NUEVO PROP
          {...authProps}
        />
      )}
      {/* Mostrar el componente Add en la página si showOnly !== undefined */}
      {showOnly && (
        <div className={`${style.buttonSend} ${style.buttonToggle}`}>
          <div
            className={style.cancelContainer}
          >
            <button
              onClick={() => setShowOnly(null)}
              className={`${style.buttonSend} ${style.buttonToggle}`}
            >
              Cerrar
            </button>
          </div>
          <Add
            onMovementAdded={() => {
              onMovementUpdate();
              setShowOnly(null);
            }}
            movementToEdit={movementToEdit}
            only={showOnly}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
