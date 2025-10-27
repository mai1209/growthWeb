import { useState } from 'react';
import Results from './Results';
import Add from './Add';
import style from '../style/App.module.css';

function Dashboard({ 
  token, 
  movimientos, 
  refreshKey, 
  onMovementUpdate, 
  movementToEdit, 
  setMovementToEdit, 
  
  ...authProps 
}) {
  // --- NUEVO ESTADO: controlar si se ven todos los movimientos ---
  const [showAllMovimientos, setShowAllMovimientos] = useState(false);

  // --- FUNCIONES QUE PASAMOS A RESULTS ---
  const handleShowAllChange = (showAll) => {
    setShowAllMovimientos(showAll);
  };

  const handleEditClick = (mov) => {
    setMovementToEdit(mov);
    setShowAllMovimientos(false); // opcional: esconder tabla al editar
  };



  return (
    <div className={style.contentSide}>
      <Results
        token={token} 
        movimientos={movimientos}
        refreshKey={refreshKey}
        onEditClick={handleEditClick}
        onMovementUpdate={onMovementUpdate}
        onShowAllChange={handleShowAllChange} // <-- NUEVO PROP
        {...authProps}
      />

      {/* Mostrar Add solo si no estamos viendo todos los movimientos */}
      {!showAllMovimientos && (
        <Add 
          onMovementAdded={onMovementUpdate} 
          movementToEdit={movementToEdit}
        />
      )}
    </div>
  );
}

export default Dashboard;
