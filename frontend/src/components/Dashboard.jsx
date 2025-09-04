// src/components/Dashboard.jsx

import Results from './Results';
import Add from './Add';
import style from '../style/App.module.css';

function Dashboard({ token, onAuthSuccess, onLoginClick, onCloseModal, activeView, onMovementAdded, movimientos, refreshKey }) {
  return (
    <div className={style.contentSide}>
      <Results
        token={token}
        onAuthSuccess={onAuthSuccess}
        onLoginClick={onLoginClick}
        onCloseModal={onCloseModal}
        activeView={activeView}
        movimientos={movimientos}
        refreshKey={refreshKey}
      />
      <Add 
        token={token} 
        onMovementAdded={onMovementAdded} 
      />
    </div>
  );
}

export default Dashboard;