import { useEffect, useState } from 'react';
import api from './lib/api';

type User = { id: string; name: string; email: string; role: string };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [companyName, setCompanyName] = useState('Mi Empresa');
  const [name, setName] = useState('Super Admin');
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456');

  async function checkSetup() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/setup/status');
      setIsSetup(Boolean(res.data?.isSetup));
    } catch {
      setError('No se pudo conectar a /api/setup/status. Verifica variables en Vercel y base URL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkSetup();
  }, []);

  async function setupInit() {
    try {
      await api.post('/setup/init', { companyName, name, email, password });
      await checkSetup();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error de instalación');
    }
  }

  async function login() {
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error de login');
    }
  }

  return (
    <div className="container">
      <h1>ERP Vercel Ready</h1>
      {loading && <div className="card">Cargando...</div>}
      {!!error && (
        <div className="card">
          <strong>{error}</strong>
          <div><button onClick={checkSetup}>Reintentar</button></div>
        </div>
      )}

      {!loading && !isSetup && (
        <div className="card grid">
          <h3>Asistente de instalación</h3>
          <label>Empresa<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
          <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></label>
          <button onClick={setupInit}>Inicializar</button>
        </div>
      )}

      {!loading && isSetup && !user && (
        <div className="card grid">
          <h3>Login</h3>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></label>
          <button onClick={login}>Entrar</button>
        </div>
      )}

      {user && (
        <div className="card">
          <h3>Bienvenido {user.name}</h3>
          <p>Rol: {user.role}</p>
          <p>API lista en Vercel: /api/products, /api/sales, /api/audit-logs</p>
        </div>
      )}
    </div>
  );
}
