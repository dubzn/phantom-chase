import { Routes, Route, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import Debugger from './pages/Debugger.tsx';

const AppLayout: React.FC = () => (
  <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
    <Outlet />
  </div>
);

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;
