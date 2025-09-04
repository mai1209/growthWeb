import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import LeftsSite from './LeftsSite';
import LeftSideNotas from './LeftSideNotas';
import style from '../style/App.module.css';

function MainLayout({ token, onLogout, movimientos }) {
  const location = useLocation();

  // 1. Creamos un "mapa" de rutas a componentes de sidebar
  const sidebarMap = {
    '/notas': <LeftSideNotas />,
    
    // '/ayuda': <AyudaSidebar />,
  };

  // 2. Guardamos el sidebar por defecto en una variable
  const DefaultSidebar = <LeftsSite movimientos={movimientos} />;

  // 3. Buscamos el sidebar para la ruta actual en el mapa
  const CurrentSidebar = sidebarMap[location.pathname];

  return (
    <div className={style.container}>
      <Nav token={token} onLogout={onLogout} />
      <div className={style.content}>
        
        {/* 4. Mostramos el sidebar encontrado, o el de por defecto si no se encontró */}
        {CurrentSidebar || DefaultSidebar}
        
        <Outlet />
      </div>
    </div>
  );
}

export default MainLayout;