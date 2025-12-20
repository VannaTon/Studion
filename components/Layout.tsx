
import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, User as UserIcon, BookOpen, QrCode } from 'lucide-react';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: 'classes' | 'profile' | 'scan';
  onTabChange?: (tab: 'classes' | 'profile' | 'scan') => void;
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
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange?.('classes')}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">EduScan</h1>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}
                onClick={() => onTabChange?.('profile')}
              >
                <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full" />
                <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.name}</span>
                <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-md font-bold uppercase">
                  {user.role}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="text-slate-400 hover:text-red-500 transition-colors p-2"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 pb-24">
        {children}
      </main>

      {user && (
         <nav className="fixed bottom-0 left-0 right-0 bg-white border-t sm:hidden h-16 flex items-center justify-around z-40 shadow-up">
           <button 
            onClick={() => onTabChange?.('classes')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'classes' ? 'text-indigo-600' : 'text-slate-400'}`}
           >
             <BookOpen className="w-6 h-6" />
             <span className="text-[10px] font-bold">Classes</span>
           </button>
           
           {user.role === UserRole.STUDENT && (
             <button 
              onClick={() => onTabChange?.('scan')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'scan' ? 'text-indigo-600' : 'text-slate-400'}`}
             >
               <QrCode className="w-6 h-6" />
               <span className="text-[10px] font-bold">Scan</span>
             </button>
           )}

           <button 
            onClick={() => onTabChange?.('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-indigo-600' : 'text-slate-400'}`}
           >
             <UserIcon className="w-6 h-6" />
             <span className="text-[10px] font-bold">Profile</span>
           </button>
         </nav>
      )}
    </div>
  );
};
