//import { useState } from 'react';
import Results from './Results';
import Add from './Add';
import style from '../style/App.module.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [selectedType, setSelectedType] = useState('ingreso'); // switch control
  // --- NUEVO ESTADO: controlar si se ven todos los movimientos ---
  //const [showAllMovimientos, setShowAllMovimientos] = useState(false);

  // --- FUNCIONES QUE PASAMOS A RESULTS ---
  const navigate = useNavigate();

 
  const handleEditClick = (mov) => {
    // set the movement to edit at App level and navigate to the Add page
    if (setMovementToEdit) setMovementToEdit(mov);
    navigate('/add');
  };



  return (
    <div className={style.contentSide}>
      {token && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.5rem' , padding: ' 2rem 2rem 1rem  0' }}>
          {!showOnly && (
            <>
              <label className={style.toggleSwitch}>
                <input
                  type="checkbox"
                  className={style.toggleSwitchInput}
                  checked={selectedType === 'egreso'}
                  onChange={() => setSelectedType(prev => prev === 'ingreso' ? 'egreso' : 'ingreso')}
                />
                <span className={style.toggleSlider}></span>
                <span className={style.toggleText}>{selectedType === 'ingreso' ? 'Ingreso' : 'Egreso'}</span>
              </label>
              <button onClick={() => setShowOnly(selectedType)} className={`${style.buttonSend} ${style.buttonToggle}`}>
                Cargar 
              </button>
            </>
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
        <div  className={`${style.buttonSend} ${style.buttonToggle}`}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button onClick={() => setShowOnly(null)} className={`${style.buttonSend} ${style.buttonToggle}`}>
              Cerrar
            </button>
          </div>
          <Add
            onMovementAdded={() => { onMovementUpdate(); setShowOnly(null); }}
            movementToEdit={movementToEdit}
            only={showOnly}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard; 
