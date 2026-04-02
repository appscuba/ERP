import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  Users, 
  Settings, 
  LogOut,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from './lib/api';
import { cn, formatCurrency } from './lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Types ---
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: { name: string };
}

interface AuditLog {
  id: string;
  action: string;
  module: string;
  createdAt: string;
  user: { name: string };
  oldValues: string;
  newValues: string;
  ipAddress: string;
}

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User, token: string) => void }) => {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { email, password });
      onLogin(res.data.user, res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <LayoutDashboard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Enterprise ERP</h1>
          <p className="text-slate-500 mt-2">Inicia sesión para gestionar tu negocio</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Correo Electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="admin@admin.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
          >
            Entrar al Sistema
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const ChangePassword = ({ onComplete }: { onComplete: () => void }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }
    if (newPassword.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres');
    }
    try {
      await api.post('/auth/change-password', { newPassword });
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cambiar contraseña');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-2xl mb-4 text-orange-600">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cambio de Contraseña Obligatorio</h1>
          <p className="text-slate-500 mt-2">Por seguridad, debes cambiar tu contraseña en el primer acceso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nueva Contraseña</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar Nueva Contraseña</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg active:scale-[0.98]"
          >
            Actualizar y Continuar
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const data = [
    { name: 'Lun', sales: 4000 },
    { name: 'Mar', sales: 3000 },
    { name: 'Mie', sales: 5000 },
    { name: 'Jue', sales: 2780 },
    { name: 'Vie', sales: 1890 },
    { name: 'Sab', sales: 2390 },
    { name: 'Dom', sales: 3490 },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Ventas Hoy', value: '€1,240.00', trend: '+12.5%', icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Productos', value: '156', trend: '4 bajos', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Clientes', value: '1,204', trend: '+24', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Facturas', value: '42', trend: 'Pendientes', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <span className={cn("text-xs font-medium px-2 py-1 rounded-full", 
                stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {stat.trend}
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Resumen de Ventas Semanal</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Actividad Reciente</h3>
          <div className="space-y-6">
            {[
              { user: 'Admin', action: 'Nueva Venta', time: 'hace 2 min', icon: ShoppingCart, color: 'bg-emerald-100 text-emerald-600' },
              { user: 'Cajero', action: 'Stock Actualizado', time: 'hace 15 min', icon: Package, color: 'bg-blue-100 text-blue-600' },
              { user: 'Admin', action: 'Login Exitoso', time: 'hace 1 hora', icon: Clock, color: 'bg-slate-100 text-slate-600' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                  <item.icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500">{item.user} • {item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventario de Productos</h2>
          <p className="text-sm text-slate-500">Gestiona tus existencias y precios</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-indigo-100">
          <Plus size={18} />
          Nuevo Producto
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Precio</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="px-6 py-4 font-semibold text-slate-900">{p.name}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                    {p.category.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-indigo-600">{formatCurrency(p.price)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={cn("font-bold", p.stock < 10 ? "text-red-500" : "text-slate-900")}>
                    {p.stock}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                    <CheckCircle2 size={14} />
                    Activo
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.get('/audit-logs').then(res => setLogs(res.data));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-bold text-slate-900">Registro de Auditoría</h2>
        <p className="text-sm text-slate-500">Trazabilidad completa de acciones en el sistema</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Módulo</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">IP</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-xs text-slate-500">
                  {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">{log.user?.name || 'Sistema'}</td>
                <td className="px-6 py-4">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", 
                    log.action === 'CREATE' ? "bg-emerald-100 text-emerald-700" :
                    log.action === 'UPDATE' ? "bg-blue-100 text-blue-700" :
                    log.action === 'LOGIN' ? "bg-indigo-100 text-indigo-700" :
                    "bg-slate-100 text-slate-700"
                  )}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-medium text-slate-600 capitalize">{log.module}</td>
                <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{log.ipAddress}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-indigo-600 hover:text-indigo-800 text-xs font-bold">Ver JSON</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/inventory').then(res => setProducts(res.data));
  }, []);

  const addToCart = (p: Product) => {
    const existing = cart.find(item => item.id === p.id);
    if (existing) {
      setCart(cart.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...p, qty: 1 }]);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    try {
      await api.post('/sales', {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.qty,
          price: item.price,
          tax: item.price * 0.21, // Mock tax
        })),
        total,
        tax: total * 0.21,
        subtotal: total * 0.79,
      });
      setCart([]);
      alert('Venta procesada con éxito');
    } catch (err) {
      alert('Error al procesar venta');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-12rem)]">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar productos por nombre o SKU..."
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pr-2">
          {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-500 transition-all text-left group"
            >
              <div className="w-full aspect-square bg-slate-50 rounded-xl mb-3 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                <Package className="text-slate-300 group-hover:text-indigo-400 transition-colors" size={32} />
              </div>
              <h4 className="font-bold text-slate-900 truncate">{p.name}</h4>
              <p className="text-xs text-slate-500 mb-2">{p.category.name}</p>
              <p className="text-lg font-black text-indigo-600">{formatCurrency(p.price)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Stock: {p.stock}</p>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart size={20} />
            Carrito de Venta
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <ShoppingCart size={48} strokeWidth={1} />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.qty} x {formatCurrency(item.price)}</p>
                </div>
                <p className="font-bold text-slate-900">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
          <div className="flex justify-between text-slate-500 text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(total * 0.79)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-sm">
            <span>IVA (21%)</span>
            <span>{formatCurrency(total * 0.21)}</span>
          </div>
          <div className="flex justify-between text-slate-900 text-xl font-black pt-2 border-t border-slate-200">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] mt-4"
          >
            Finalizar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  if (user.mustChangePassword) {
    return (
      <ChangePassword 
        onComplete={() => {
          const updatedUser = { ...user, mustChangePassword: false };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }} 
      />
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
    { id: 'audit', label: 'Auditoría', icon: History, adminOnly: true },
    { id: 'users', label: 'Usuarios', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <motion.aside 
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-white border-r border-slate-200 flex flex-col z-20"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          {isSidebarOpen && <span className="font-black text-xl text-slate-900 tracking-tight">ERP PRO</span>}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            if (item.adminOnly && user.role !== 'ADMIN') return null;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={cn("shrink-0", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-900")} />
                {isSidebarOpen && <span className="font-semibold text-sm">{item.label}</span>}
                {isActive && isSidebarOpen && (
                  <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-semibold text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <LayoutDashboard size={20} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-sm font-bold text-slate-900">{user.name}</p>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{user.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <Users size={20} className="text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'inventory' && <Inventory />}
              {activeTab === 'pos' && <POS />}
              {activeTab === 'audit' && <AuditLogs />}
              {activeTab === 'users' && <div className="p-12 text-center text-slate-400">Módulo de Usuarios en desarrollo...</div>}
              {activeTab === 'settings' && <div className="p-12 text-center text-slate-400">Módulo de Configuración en desarrollo...</div>}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
