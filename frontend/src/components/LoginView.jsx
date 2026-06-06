import React, { useState } from 'react';
import api from '../api';

const LoginView = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      onLogin(); 
    } catch (err) {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0f1c] flex flex-col items-center justify-center font-sans overflow-hidden">
      
      {/* ========================================================= */}
      {/* FONDO ELABORADO: Marca de Agua & Malla de Seguridad       */}
      {/* ========================================================= */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
        
        {/* Marca de agua gigante corporativa */}
        <div className="absolute whitespace-nowrap text-[12vw] font-black text-white/[0.02] -rotate-12 select-none tracking-tighter">
          POWERCONTROL
        </div>
        <div className="absolute whitespace-nowrap text-[12vw] font-black text-power-purple/[0.02] -rotate-12 select-none mt-[40vh] ml-[30vw] tracking-tighter">
          ANTIFRAUDE
        </div>

        {/* Malla (Grid) tecnológica */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_20%,#000_40%,transparent_100%)]"></div>
        
        {/* Scanlines horizontales sutiles */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#ffffff02_2px,#ffffff02_4px)] opacity-50"></div>

        {/* Orbes de iluminación (Glows) */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-power-purple/20 rounded-full blur-[130px] mix-blend-screen animate-pulse duration-10000"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[130px] mix-blend-screen"></div>
      </div>

      {/* ========================================================= */}
      {/* HEADER: Logo y Sistema Antifraude (Superior Izquierda)    */}
      {/* ========================================================= */}
      <div className="absolute top-8 left-8 md:top-10 md:left-10 z-20">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight italic drop-shadow-lg">
          Power<span className="text-power-purple">Control</span>
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          <span className="text-xs md:text-sm text-slate-300 font-bold uppercase tracking-widest">
            Sistema Antifraude
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTENEDOR CENTRAL: Login y Herramientas                  */}
      {/* ========================================================= */}
      <div className="relative z-10 w-full max-w-[420px] px-4 mt-12 md:mt-0">
        
        {/* CAJA BLANCA PRINCIPAL */}
        <div className="bg-white rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-8 md:p-10 border border-white/10 backdrop-blur-sm">
          
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Iniciar Sesión</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">Credenciales de analista requeridas</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold p-3 rounded-xl mb-6 flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
                </div>
                <input 
                  type="email" 
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-power-purple/50 focus:border-power-purple outline-none transition-all text-sm font-medium text-slate-700"
                  placeholder="Correo corporativo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <input 
                  type="password" 
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-power-purple/50 focus:border-power-purple outline-none transition-all text-sm font-medium text-slate-700"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={cargando}
                className="relative w-full bg-power-blue text-white font-bold py-3.5 rounded-xl shadow-lg shadow-power-blue/30 hover:shadow-power-blue/50 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2 overflow-hidden group"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                {cargando ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Verificando...
                  </>
                ) : (
                  'Acceder al sistema'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* COMPLEMENTOS */}
        <div className="mt-4 bg-white/10 backdrop-blur-md px-5 py-3.5 text-xs text-white flex justify-between items-center rounded-xl border border-white/10 shadow-lg cursor-not-allowed">
          <span className="font-medium">Español</span>
          <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
        
        <div className="mt-8 text-center relative z-20">
          <p className="text-[10px] text-slate-500 font-medium">
            © {new Date().getFullYear()} PowerPay Limited. Uso interno exclusivo.
          </p>
        </div>

      </div>
    </div>
  );
};

export default LoginView;