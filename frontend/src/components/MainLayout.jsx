import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import LeftsSite from './LeftsSite';
import LeftSideNotas from './LeftSideNotas';

function MainLayout({ token, onLogout, taskToEdit, onTaskUpdate , refreshKey}) {
  const location = useLocation();

  const sidebarMap = {
    // Pasamos la prop con el nombre consistente a LeftSideNotas
    '/notas': <LeftSideNotas onTaskUpdate={onTaskUpdate} taskToEdit={taskToEdit} />,
  };

  const DefaultSidebar = <LeftsSite    token={token} refreshKey={refreshKey} />;
  const CurrentSidebar = sidebarMap[location.pathname];

  return (
    <div>
      <Nav token={token} onLogout={onLogout} />
      <main style={{ display: 'flex' }}>
        {CurrentSidebar || DefaultSidebar}
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;