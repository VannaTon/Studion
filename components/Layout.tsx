
import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, User as UserIcon, BookOpen, QrCode, Building2 } from 'lucide-react';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: 'classes' | 'profile' | 'scan' | 'university';
  onTabChange?: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  user, 
  onLogout, 
  children, 
  activeTab = 'classes',
  onTabChange 
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange?.('classes')}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter hidden sm:block">EduScan</h1>
          </div>

          {user && (
            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-2">
                <button onClick={() => onTabChange?.('classes')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'classes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-900'}`}>Portal</button>
                <button onClick={() => onTabChange?.('university')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'university' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-900'}`}>University</button>
              </nav>

              <div className="flex items-center gap-4 border-l pl-6">
                <div 
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl transition-all cursor-pointer border ${activeTab === 'profile' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}
                  onClick={() => onTabChange?.('profile')}
                >
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-xl shadow-sm" />
                  <div className="hidden sm:block">
                    <p className="text-xs font-black text-slate-900">{user.name}</p>
                    <p className="text-[9px] font-black text-indigo-600 uppercase">{user.role}</p>
                  </div>
                </div>
                <button onClick={onLogout} className="text-slate-300 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 pb-32">
        {children}
      </main>

      {user && (
         <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t md:hidden h-20 flex items-center justify-around z-40 shadow-up px-6">
           <button onClick={() => onTabChange?.('classes')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'classes' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
             <BookOpen className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-widest">Portal</span>
           </button>
           <button onClick={() => onTabChange?.('university')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'university' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
             <Building2 className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-widest">Uni</span>
           </button>
           {user.role === UserRole.STUDENT && (
             <button onClick={() => onTabChange?.('scan')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'scan' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
               <QrCode className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-widest">Scan</span>
             </button>
           )}
           <button onClick={() => onTabChange?.('profile')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
             <UserIcon className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
           </button>
         </nav>
      )}
    </div>
  );
};
