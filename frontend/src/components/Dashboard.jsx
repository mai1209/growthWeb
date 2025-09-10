import Results from './Results';
import Add from './Add';
import style from '../style/App.module.css';

// 1. Recibe 'setMovementToEdit' de AppRoutes
function Dashboard({ 
  token, 
  movimientos, 
  refreshKey, 
  onMovementUpdate, 
  movementToEdit, 
  setMovementToEdit, 
  ...authProps 
}) {
  return (
    <div className={style.contentSide}>
      <Results
        token={token}
        movimientos={movimientos}
        refreshKey={refreshKey}
        onEditClick={setMovementToEdit} // <-- 2. Pasa la función a Results como 'onEditClick'
        onMovementUpdate={onMovementUpdate}
        {...authProps}
      />
      <Add 
        onMovementAdded={onMovementUpdate} 
        movementToEdit={movementToEdit}
      />
    </div>
  );
}

export default Dashboard;