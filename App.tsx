
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserRole, Class, AttendanceRecord } from './types.ts';
import { dbService } from './services/dbService.ts';
import { supabase } from './services/supabase.ts';
import { Layout } from './components/Layout.tsx';
import { Button } from './components/Shared/Button.tsx';
import { Modal } from './components/Shared/Modal.tsx';
import { ClassForm } from './components/Teacher/ClassForm.tsx';
import { QRScanner } from './components/Student/QRScanner.tsx';
import { 
  Plus, 
  Users, 
  QrCode, 
  Calendar, 
  ChevronRight, 
  CheckCircle, 
  Clock,
  Download,
  Trash2,
  ArrowLeft,
  BookOpen,
  LogIn,
  Sparkles,
  Hash,
  ArrowRight,
  Copy,
  RefreshCw,
  Share2,
  ListChecks,
  History,
  ShieldCheck,
  UserCircle,
  Loader2,
  UserPlus,
  Mail,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opLoading, setOpLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'classes' | 'profile' | 'scan'>('classes');
  
  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Auth state
  const [tempAuthUser, setTempAuthUser] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Filter classes the student is enrolled in
  const enrolledClasses = useMemo(() => {
    if (!user || user.role !== UserRole.STUDENT) return [];
    return classes.filter(c => c.studentIds.includes(user.id));
  }, [classes, user]);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('setup') === 'true') {
        setPreviewMode(true);
        setShowRoleSelection(true);
        setTempAuthUser({
          email: 'preview@example.com',
          user_metadata: {
            full_name: 'Preview User',
            avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
          }
        });
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await dbService.getCurrentUser();
          if (profile) {
            setUser(profile);
            setShowRoleSelection(false);
          } else {
            setTempAuthUser(session.user);
            setShowRoleSelection(true);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
          const profile = await dbService.getCurrentUser();
          if (profile) {
            setUser(profile);
            setShowRoleSelection(false);
          } else {
            setTempAuthUser(session.user);
            setShowRoleSelection(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setTempAuthUser(null);
          setShowRoleSelection(false);
          setSelectedClass(null);
          setCurrentTab('classes');
        }
      });

      return () => subscription.unsubscribe();
    };
    initAuth();
  }, []);

  // Main data fetcher
  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      if (user.role === UserRole.TEACHER) {
        const teacherClasses = await dbService.getClassesByTeacher(user.id);
        setClasses(teacherClasses);
      } else if (user.role === UserRole.STUDENT) {
        const allClasses = await dbService.getAllClasses();
        setClasses(allClasses);
      }
    } catch (err) {
      console.error("Data refresh error:", err);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Sync selectedClass object with the classes array updates
  useEffect(() => {
    if (selectedClass) {
      const updated = classes.find(c => c.id === selectedClass.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedClass)) {
        setSelectedClass(updated);
      }
    }
  }, [classes]);

  // Fetch class details (attendance/roster) when a class is selected
  useEffect(() => {
    let isMounted = true;
    const fetchClassDetails = async () => {
      if (!selectedClass) {
        setAttendance([]);
        setStudentProfiles([]);
        return;
      }
      
      // Role-aware loading logic: Students don't fetch profiles, so ignore that count
      const isMissingData = user?.role === UserRole.TEACHER 
        ? (attendance.length === 0 || studentProfiles.length === 0)
        : (attendance.length === 0);

      // Only show global blocking loader if it's the first time we're seeing this class ID
      if (isMissingData) {
        setOpLoading(true);
      }

      try {
        const [records, profiles] = await Promise.all([
          dbService.getAttendance(selectedClass.id),
          user?.role === UserRole.TEACHER 
            ? dbService.getProfilesByIds(selectedClass.studentIds)
            : Promise.resolve([])
        ]);

        if (isMounted) {
          setAttendance(records);
          setStudentProfiles(profiles);
        }
      } catch (err) {
        console.error("Error fetching class details:", err);
      } finally {
        // ALWAYS clear the loader, even if unmounted
        setOpLoading(false);
      }
    };

    fetchClassDetails();
    return () => { isMounted = false; };
  }, [selectedClass?.id, user?.role]);

  const initiateGoogleSignIn = async () => {
    const redirectUrl = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    if (error) {
      console.error("Login error:", error.message);
      alert("Error starting Google Login: " + error.message);
    }
  };

  const finalizeLogin = async (role: UserRole) => {
    if (previewMode) {
      alert("Preview mode: Auth disabled.");
      window.location.href = window.location.origin;
      return;
    }
    if (!tempAuthUser) return;
    setOpLoading(true);
    
    const newUser: User = {
      id: tempAuthUser.id,
      googleId: tempAuthUser.id,
      name: tempAuthUser.user_metadata?.full_name || tempAuthUser.email,
      email: tempAuthUser.email || '',
      picture: tempAuthUser.user_metadata?.avatar_url || '',
      role
    };
    
    const success = await dbService.upsertProfile(newUser);
    if (success) {
      setUser(newUser);
      setShowRoleSelection(false);
      setTempAuthUser(null);
    } else {
      alert("Database error. Check Supabase logs.");
    }
    setOpLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const generateRandomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleAddClass = async (data: Partial<Class>) => {
    if (!user) return;
    setOpLoading(true);
    const newClass: Class = {
      id: crypto.randomUUID(),
      code: generateRandomCode(),
      teacherId: user.id,
      studentIds: [],
      ...data as any
    };
    await dbService.saveClass(newClass);
    await refreshData();
    setShowClassModal(false);
    setOpLoading(false);
  };

  const handleRegenerateCode = async () => {
    if (!selectedClass || !confirm('Regenerate code?')) return;
    setOpLoading(true);
    const updatedClass = {
      ...selectedClass,
      code: generateRandomCode()
    };
    await dbService.saveClass(updatedClass);
    await refreshData();
    setOpLoading(false);
  };

  const handleCopyCode = () => {
    if (!selectedClass) return;
    navigator.clipboard.writeText(selectedClass.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!selectedClass || attendance.length === 0) return;
    const headers = ['Student Name', 'Date', 'Time', 'Status', 'Method'];
    const rows = attendance.map(record => {
      const student = studentProfiles.find(p => p.id === record.studentId);
      return [
        student?.name || 'Unknown',
        format(new Date(record.timestamp), 'yyyy-MM-dd'),
        format(new Date(record.timestamp), 'HH:mm:ss'),
        record.status,
        record.method
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedClass.name}_attendance.csv`);
    link.click();
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== UserRole.STUDENT) return;
    setOpLoading(true);
    const targetCode = joinCode.trim().toUpperCase();
    const allAvailable = await dbService.getAllClasses();
    const targetClass = allAvailable.find(c => c.code === targetCode);
    if (!targetClass) {
      alert("Invalid code.");
      setOpLoading(false);
      return;
    }
    if (targetClass.studentIds.includes(user.id)) {
      alert("Already joined.");
      setJoinCode('');
      setOpLoading(false);
      return;
    }
    const success = await dbService.joinClass(targetClass.id, user.id);
    if (success) {
      await refreshData();
      setJoinCode('');
      alert(`Joined ${targetClass.name}!`);
    }
    setOpLoading(false);
  };

  const handleDeleteClass = async (id: string) => {
    if (confirm('Delete class permanently?')) {
      setOpLoading(true);
      await dbService.deleteClass(id);
      await refreshData();
      setSelectedClass(null);
      setOpLoading(false);
    }
  };

  const generateQRToken = (classId: string) => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const expiresAt = Date.now() + (30 * 60 * 1000);
    return JSON.stringify({ classId, date, expiresAt, secret: 'v3ry-s3cur3' });
  };

  const handleScan = async (qrData: string) => {
    try {
      const data = JSON.parse(qrData);
      if (data.expiresAt < Date.now()) {
        alert("QR expired.");
        return;
      }
      const record: AttendanceRecord = {
        id: crypto.randomUUID(),
        classId: data.classId,
        studentId: user!.id,
        date: data.date,
        timestamp: new Date().toISOString(),
        status: 'Present',
        method: 'QR'
      };
      const success = await dbService.saveAttendance(record);
      if (success) {
        alert("Attendance marked!");
        await refreshData();
      } else {
        alert("Already marked today.");
      }
      setShowScannerModal(false);
    } catch (e) {
      alert("Invalid QR format.");
    }
  };

  const handleTabChange = (tab: 'classes' | 'profile' | 'scan') => {
    if (tab === 'scan' && user?.role === UserRole.STUDENT) {
      setShowScannerModal(true);
      return;
    }
    setCurrentTab(tab);
    setSelectedClass(null);
    setAttendance([]); 
    setStudentProfiles([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Syncing Cloud...</p>
      </div>
    );
  }

  if (!user && !previewMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
          <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-indigo-200 shadow-2xl rotate-3">
            <LogIn className="text-white w-12 h-12 -rotate-3" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">EduScan</h1>
          <p className="text-slate-500 mb-12 leading-relaxed font-medium">Next-gen attendance powered by Supabase.</p>
          {!showRoleSelection ? (
            <div className="space-y-4">
              <button onClick={initiateGoogleSignIn} className="w-full flex items-center justify-center gap-4 p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-600 hover:bg-slate-50 transition-all group shadow-sm active:scale-95">
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="G" className="w-6 h-6" />
                <span className="font-bold text-slate-700">Continue with Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img src={tempAuthUser?.user_metadata?.avatar_url} alt="P" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-800">{tempAuthUser?.user_metadata?.full_name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{tempAuthUser?.email}</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-left px-1">Choose Account Type</p>
                <button disabled={opLoading} onClick={() => finalizeLogin(UserRole.TEACHER)} className="w-full p-5 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-between group shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    {opLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <BookOpen className="w-6 h-6" />}
                    <span>Teacher Account</span>
                  </div>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button disabled={opLoading} onClick={() => finalizeLogin(UserRole.STUDENT)} className="w-full p-5 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-between group hover:border-indigo-600 hover:text-indigo-600 active:scale-95 transition-all disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    {opLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Users className="w-6 h-6" />}
                    <span>Student Account</span>
                  </div>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} activeTab={currentTab} onTabChange={handleTabChange}>
      {opLoading && (
        <div className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[2px] flex items-center justify-center">
           <div className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="font-black text-slate-900 uppercase tracking-widest text-xs">Processing</span>
           </div>
        </div>
      )}

      {currentTab === 'profile' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
           <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-[0.03]"><UserCircle className="w-48 h-48" /></div>
              <div className="relative z-10">
                <img src={user?.picture} alt="P" className="w-32 h-32 rounded-[2.5rem] mx-auto mb-6 border-4 border-indigo-50 shadow-2xl" />
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{user?.name}</h2>
                <div className="flex items-center justify-center gap-2 text-slate-500 font-medium mb-8"><Mail className="w-4 h-4" /> {user?.email}</div>
                <div className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100">
                   <Award className="w-4 h-4" /> {user?.role} Member
                </div>
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Stats</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center"><span className="text-slate-500 font-bold">Enrolled Classes</span><span className="text-xl font-black text-indigo-600">{classes.length}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500 font-bold">Total Attendance Records</span><span className="text-xl font-black text-indigo-600">{attendance.filter(r => r.studentId === user?.id).length || '0'}</span></div>
                 </div>
              </div>
           </div>
        </div>
      ) : selectedClass ? (
        user?.role === UserRole.TEACHER ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedClass(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-100 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
              <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedClass.name}</h2><p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{selectedClass.subject} • {selectedClass.grade} Grade</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" className="flex items-center gap-2 px-6" onClick={() => setShowQRModal(true)}><QrCode className="w-5 h-5" /> Start QR Attendance</Button>
                  <Button variant="outline" className="flex items-center gap-2 px-6" onClick={exportCSV}><Download className="w-5 h-5" /> Export History</Button>
                  <Button variant="danger" className="flex items-center gap-2 px-6" onClick={() => handleDeleteClass(selectedClass.id)}><Trash2 className="w-5 h-5" /> Delete Class</Button>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                  <div className="flex border-b">
                    <button className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'roster' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`} onClick={() => setActiveTab('roster')}>Student Roster</button>
                    <button className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'attendance' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`} onClick={() => setActiveTab('attendance')}>Live Logs</button>
                  </div>
                  <div className="p-8">
                    {activeTab === 'roster' ? (
                      <div className="space-y-4">
                        <div className="divide-y border border-slate-50 rounded-[2rem] overflow-hidden">
                          {studentProfiles.length === 0 ? <div className="p-20 text-center"><Users className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No students enrolled</p></div> : 
                            studentProfiles.map(s => (<div key={s.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"><div className="flex items-center gap-4"><img src={s.picture} className="w-12 h-12 rounded-2xl border-2 border-slate-50" /><div><p className="font-black text-slate-900 tracking-tight">{s.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.email}</p></div></div><span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-tighter">ID: {s.id.slice(0,8)}</span></div>))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="divide-y border border-slate-50 rounded-[2rem] overflow-hidden">
                          {attendance.length === 0 ? <div className="p-20 text-center"><Clock className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</p></div> : 
                            attendance.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(record => {
                              const student = studentProfiles.find(p => p.id === record.studentId);
                              return (<div key={record.id} className="p-5 flex items-center justify-between bg-white hover:bg-emerald-50/30 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div><div><p className="text-sm font-black text-slate-900">{student?.name || 'User'}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{format(new Date(record.timestamp), 'MMM d, h:mm a')}</p></div></div><span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">{record.status}</span></div>);
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
                  <div className="relative z-10">
                    <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight flex items-center gap-2"><Hash className="w-5 h-5 text-indigo-600" /> Invite Code</h3>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-6">
                      <span className="text-5xl font-mono font-black text-indigo-600 tracking-tighter block">{selectedClass.code}</span>
                      <div className="flex gap-2"><button onClick={handleCopyCode} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-600 shadow-sm'}`}>{copied ? 'Copied' : 'Copy'}</button><button onClick={handleRegenerateCode} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-indigo-600 transition-all"><RefreshCw className="w-4 h-4" /></button></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
             <div className="flex items-center gap-4">
              <button onClick={() => setSelectedClass(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-100 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
              <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedClass.name}</h2><p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{selectedClass.subject} • Grade {selectedClass.grade}</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="md:col-span-2 space-y-6">
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-indigo-50/30"><h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-[10px]"><History className="w-4 h-4 text-indigo-600" /> My Attendance Records</h3></div>
                    <div className="divide-y divide-slate-50">
                       {attendance.filter(r => r.studentId === user?.id).length === 0 ? <div className="p-20 text-center"><Clock className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No scans found</p></div> : 
                        attendance.filter(r => r.studentId === user?.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(record => (
                          <div key={record.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center"><Calendar className="w-6 h-6 text-emerald-600" /></div><div><p className="font-black text-slate-900 tracking-tight">{format(new Date(record.timestamp), 'EEEE, MMM do')}</p><p className="text-[10px] text-slate-400 font-black uppercase">{format(new Date(record.timestamp), 'h:mm a')}</p></div></div><span className="px-4 py-2 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-xl uppercase tracking-widest">{record.status}</span></div>))}
                    </div>
                  </div>
               </div>
               <div className="space-y-6"><div className="bg-indigo-600 p-10 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200"><QrCode className="w-12 h-12 mb-6 opacity-40" /><h3 className="text-2xl font-black mb-2 tracking-tight">Clock-in Now</h3><p className="text-indigo-100 text-sm font-medium mb-8 opacity-80">Is your teacher showing a QR code? Tap below to scan.</p><Button variant="secondary" fullWidth className="bg-white text-indigo-600 py-5 text-sm font-black uppercase tracking-widest" onClick={() => setShowScannerModal(true)}>Open Scanner</Button></div></div>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="p-12 bg-indigo-600 rounded-[3rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-48 h-48" /></div><div className="relative z-10"><p className="text-indigo-200 font-black text-[10px] uppercase tracking-[0.3em] mb-4">Institutional Dashboard</p><h2 className="text-4xl font-black mb-2 tracking-tight">Hello, {user?.name.split(' ')[0]}!</h2><p className="text-indigo-100 font-medium opacity-90 max-w-sm">Manage your academic schedule and track real-time attendance syncing.</p></div></div>
          {user?.role === UserRole.TEACHER ? (
            <><div className="flex items-center justify-between"><div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Your Classrooms</h2><p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Connected to Cloud</p></div><Button onClick={() => setShowClassModal(true)} className="flex items-center gap-2 py-4 px-8 rounded-2xl shadow-indigo-100 shadow-2xl text-xs font-black uppercase tracking-widest"><Plus className="w-5 h-5" /> Add Class</Button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-8">{classes.length === 0 ? <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200"><BookOpen className="w-16 h-16 text-slate-100 mx-auto mb-6" /><h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Empty Classroom</h3><Button variant="secondary" onClick={() => setShowClassModal(true)} className="px-10 py-4 text-xs font-black uppercase tracking-widest">Get Started</Button></div> : 
                  classes.map(c => (<div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden"><div className="relative z-10"><div className="flex justify-between items-start mb-8"><div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform"><Users className="w-8 h-8" /></div><span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl uppercase tracking-widest">{c.code}</span></div><h3 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">{c.name}</h3><p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-8">{c.subject}</p><div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-8 font-black uppercase tracking-[0.2em]"><span className="flex items-center gap-2"><ListChecks className="w-4 h-4" /> {c.studentIds.length} Enrolled</span><ChevronRight className="w-5 h-5 text-indigo-400" /></div></div></div>))
                }</div></>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-10"><div className="bg-white p-10 rounded-[3rem] border-2 border-indigo-600/10 shadow-2xl relative overflow-hidden"><div className="relative z-10"><h3 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-6 uppercase tracking-widest text-xs"><UserPlus className="w-6 h-6 text-indigo-600" /> Join a Classroom</h3><form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-4"><div className="relative flex-1"><Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" /><input type="text" placeholder="6-DIGIT CODE" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none font-mono font-black tracking-[0.5em] text-xl uppercase focus:border-indigo-600" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={6} required /></div><Button type="submit" disabled={opLoading} className="px-10 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Register</Button></form></div></div>
                <div className="space-y-6"><h3 className="text-xs font-black text-slate-400 flex items-center gap-3 tracking-[0.3em] uppercase px-2"><CheckCircle className="w-4 h-4 text-indigo-600" /> My Current Courses</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{enrolledClasses.length === 0 ? <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">No active enrollments found.</div> : 
                      enrolledClasses.map(c => (<div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-8 rounded-[2.5rem] border border-indigo-50 shadow-sm flex items-center justify-between border-l-[10px] border-l-indigo-600 group hover:shadow-2xl transition-all cursor-pointer hover:-translate-y-1"><div><h4 className="font-black text-slate-900 tracking-tight text-xl mb-1">{c.name}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.subject}</p></div><div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></div></div>))
                    }</div></div>
              </div>
              <div className="space-y-8"><div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl text-center"><h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight">Clock-in</h3><Button fullWidth onClick={() => setShowScannerModal(true)} className="py-10 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex flex-col items-center justify-center gap-4 shadow-indigo-100 shadow-2xl transition-all hover:scale-105 active:scale-95"><QrCode className="w-12 h-12" /><span>Scan Code</span></Button></div></div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title="New Educational Unit"><ClassForm onSubmit={handleAddClass} onCancel={() => setShowClassModal(false)} /></Modal>
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="Session QR Code"><div className="flex flex-col items-center gap-10 py-6"><div className="p-10 bg-white border-[16px] border-slate-50 rounded-[4rem] shadow-inner"><QRCodeSVG value={selectedClass ? generateQRToken(selectedClass.id) : ''} size={260} level="H" includeMargin={true} /></div><p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Scan with Student App</p><Button fullWidth onClick={() => setShowQRModal(false)} className="py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs">Close Session</Button></div></Modal>
      <Modal isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} title="Optical Scanner"><QRScanner onScan={handleScan} onCancel={() => setShowScannerModal(false)} /></Modal>
    </Layout>
  );
}
