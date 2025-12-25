
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, UserRole, Class, AttendanceRecord, University } from './types.ts';
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
  Award,
  Building2,
  Globe,
  MapPin,
  ExternalLink,
  School
} from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [allUniversities, setAllUniversities] = useState<University[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opLoading, setOpLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'classes' | 'profile' | 'scan' | 'university'>('classes');
  
  const lastFetchedId = useRef<string | null>(null);

  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showUniSelection, setShowUniSelection] = useState(false);
  const [showUniForm, setShowUniForm] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Registration data
  const [tempAuthUser, setTempAuthUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [uniFormData, setUniFormData] = useState({
    name: '',
    description: '',
    location: '',
    website: '',
    logo: ''
  });

  const enrolledClasses = useMemo(() => {
    if (!user || user.role !== UserRole.STUDENT) return [];
    return classes.filter(c => c.studentIds.includes(user.id));
  }, [classes, user]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await dbService.getCurrentUser();
          if (profile) {
            setUser(profile);
            if (profile.universityId) {
              const uni = await dbService.getUniversityById(profile.universityId);
              setUniversity(uni);
            }
          } else {
            setTempAuthUser(session.user);
            setShowRoleSelection(true);
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      if (user.role === UserRole.TEACHER) {
        const teacherClasses = await dbService.getClassesByTeacher(user.id);
        setClasses(teacherClasses);
      } else if (user.role === UserRole.STUDENT) {
        const allClasses = await dbService.getAllClasses();
        // Students see only classes in their uni
        setClasses(allClasses.filter(c => c.universityId === user.universityId));
      } else if (user.role === UserRole.UNIVERSITY) {
        if (user.universityId) {
          const uniClasses = await dbService.getClassesByUniversity(user.universityId);
          setClasses(uniClasses);
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let isMounted = true;
    const fetchClassDetails = async () => {
      if (!selectedClass) {
        setAttendance([]);
        setStudentProfiles([]);
        lastFetchedId.current = null;
        return;
      }
      if (lastFetchedId.current !== selectedClass.id) setOpLoading(true);

      try {
        const [records, profiles] = await Promise.all([
          dbService.getAttendance(selectedClass.id),
          user?.role === UserRole.TEACHER || user?.role === UserRole.UNIVERSITY
            ? dbService.getProfilesByIds(selectedClass.studentIds)
            : Promise.resolve([])
        ]);

        if (isMounted) {
          setAttendance(records);
          setStudentProfiles(profiles);
          lastFetchedId.current = selectedClass.id;
        }
      } finally {
        if (isMounted) setOpLoading(false);
      }
    };
    fetchClassDetails();
    return () => { isMounted = false; };
  }, [selectedClass?.id]);

  const initiateGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleRoleSelect = async (role: UserRole) => {
    setSelectedRole(role);
    setShowRoleSelection(false);
    if (role === UserRole.UNIVERSITY) {
      setShowUniForm(true);
    } else {
      setOpLoading(true);
      const unis = await dbService.getAllUniversities();
      setAllUniversities(unis);
      setOpLoading(false);
      setShowUniSelection(true);
    }
  };

  const finalizeRegistration = async (uniId?: string, isNewUni = false) => {
    if (!tempAuthUser || !selectedRole) return;
    setOpLoading(true);
    try {
      let finalUniId = uniId;
      if (isNewUni) {
        const newUni: University = {
          id: crypto.randomUUID(),
          ...uniFormData,
          logo: `https://api.dicebear.com/7.x/initials/svg?seed=${uniFormData.name}`
        };
        await dbService.upsertUniversity(newUni);
        finalUniId = newUni.id;
        setUniversity(newUni);
      }

      const newUser: User = {
        id: tempAuthUser.id,
        googleId: tempAuthUser.id,
        name: tempAuthUser.user_metadata?.full_name || tempAuthUser.email,
        email: tempAuthUser.email || '',
        picture: tempAuthUser.user_metadata?.avatar_url || '',
        role: selectedRole,
        universityId: finalUniId
      };
      
      const success = await dbService.upsertProfile(newUser);
      if (success) {
        setUser(newUser);
        setShowUniSelection(false);
        setShowUniForm(false);
        if (finalUniId && !university) {
          const uni = await dbService.getUniversityById(finalUniId);
          setUniversity(uni);
        }
      }
    } finally {
      setOpLoading(false);
    }
  };

  const handleAddClass = async (data: Partial<Class>) => {
    if (!user || !university) return;
    setOpLoading(true);
    try {
      const newClass: Class = {
        id: crypto.randomUUID(),
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        teacherId: user.id,
        universityId: university.id,
        studentIds: [],
        ...data as any
      };
      await dbService.saveClass(newClass);
      await refreshData();
      setShowClassModal(false);
    } finally {
      setOpLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setOpLoading(true);
    try {
      const allAvailable = await dbService.getAllClasses();
      const target = allAvailable.find(c => c.code === joinCode.toUpperCase() && c.universityId === user.universityId);
      if (!target) {
        alert("Class not found in your university.");
        return;
      }
      await dbService.joinClass(target.id, user.id);
      await refreshData();
      setJoinCode('');
    } finally {
      setOpLoading(false);
    }
  };

  const handleScan = async (qrData: string) => {
    try {
      const data = JSON.parse(qrData);
      setOpLoading(true);
      const record: AttendanceRecord = {
        id: crypto.randomUUID(),
        classId: data.classId,
        studentId: user!.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        timestamp: new Date().toISOString(),
        status: 'Present',
        method: 'QR'
      };
      await dbService.saveAttendance(record);
      alert("Clocked in!");
      await refreshData();
      setShowScannerModal(false);
    } catch (e) {
      alert("Invalid Code");
    } finally {
      setOpLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] p-12 max-w-lg w-full shadow-2xl text-center relative overflow-hidden">
          <h1 className="text-4xl font-black mb-8 tracking-tighter">EduScan <span className="text-indigo-600">Pro</span></h1>
          {!showRoleSelection && !showUniSelection && !showUniForm ? (
            <Button fullWidth onClick={initiateGoogleSignIn} className="py-5 rounded-2xl flex items-center justify-center gap-3">
              <LogIn className="w-5 h-5" /> Sign in to Continue
            </Button>
          ) : showRoleSelection ? (
            <div className="space-y-4 text-left">
              <p className="font-black text-xs text-slate-400 uppercase tracking-widest px-1">Institutional Setup</p>
              <button onClick={() => handleRoleSelect(UserRole.UNIVERSITY)} className="w-full p-6 border-2 border-slate-100 rounded-2xl hover:border-indigo-600 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 rounded-xl"><Building2 className="text-indigo-600" /></div><div className="text-left"><p className="font-bold text-slate-800">University Admin</p><p className="text-xs text-slate-500">Register your whole institution</p></div></div>
                <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </button>
              <button onClick={() => handleRoleSelect(UserRole.TEACHER)} className="w-full p-6 border-2 border-slate-100 rounded-2xl hover:border-indigo-600 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4"><div className="p-3 bg-emerald-50 rounded-xl"><BookOpen className="text-emerald-600" /></div><div className="text-left"><p className="font-bold text-slate-800">Professor / Teacher</p><p className="text-xs text-slate-500">Manage your classroom sessions</p></div></div>
                <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </button>
              <button onClick={() => handleRoleSelect(UserRole.STUDENT)} className="w-full p-6 border-2 border-slate-100 rounded-2xl hover:border-indigo-600 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4"><div className="p-3 bg-amber-50 rounded-xl"><Users className="text-amber-600" /></div><div className="text-left"><p className="font-bold text-slate-800">Student</p><p className="text-xs text-slate-500">Track your attendance history</p></div></div>
                <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </button>
            </div>
          ) : showUniSelection ? (
            <div className="space-y-6 text-left">
              <div className="flex items-center gap-2"><button onClick={() => setShowRoleSelection(true)}><ArrowLeft className="w-5 h-5 text-slate-400" /></button><p className="font-black text-xs text-slate-400 uppercase tracking-widest">Select Your University</p></div>
              <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {allUniversities.map(u => (
                  <button key={u.id} onClick={() => finalizeRegistration(u.id)} className="w-full p-5 border-2 border-slate-100 rounded-2xl hover:border-indigo-600 transition-all text-left flex items-center gap-4">
                    <img src={u.logo} className="w-10 h-10 rounded-lg" />
                    <div><p className="font-bold text-slate-800">{u.name}</p><p className="text-[10px] text-slate-500 uppercase font-black">{u.location}</p></div>
                  </button>
                ))}
                {allUniversities.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">No universities registered yet.</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-left">
              <div className="flex items-center gap-2"><button onClick={() => setShowRoleSelection(true)}><ArrowLeft className="w-5 h-5 text-slate-400" /></button><p className="font-black text-xs text-slate-400 uppercase tracking-widest">Register University</p></div>
              <div className="space-y-4">
                <input placeholder="University Name" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={uniFormData.name} onChange={e => setUniFormData({...uniFormData, name: e.target.value})} />
                <input placeholder="Location" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={uniFormData.location} onChange={e => setUniFormData({...uniFormData, location: e.target.value})} />
                <input placeholder="Website URL" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={uniFormData.website} onChange={e => setUniFormData({...uniFormData, website: e.target.value})} />
                <textarea placeholder="Description" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={uniFormData.description} onChange={e => setUniFormData({...uniFormData, description: e.target.value})} />
                <Button fullWidth onClick={() => finalizeRegistration(undefined, true)} className="py-4">Create Institution</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={() => supabase.auth.signOut()} activeTab={currentTab} onTabChange={(t) => { setSelectedClass(null); setCurrentTab(t as any); }}>
      {opLoading && <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-white w-12 h-12" /></div>}

      {currentTab === 'university' && university ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-10 items-center">
            <img src={university.logo} className="w-48 h-48 rounded-[2rem] shadow-2xl border-4 border-indigo-50" />
            <div className="flex-1 space-y-4">
              <h2 className="text-4xl font-black tracking-tighter text-slate-900">{university.name}</h2>
              <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">{university.description}</p>
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-slate-600 font-bold text-xs"><MapPin className="w-4 h-4" /> {university.location}</div>
                <a href={university.website} target="_blank" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all"><Globe className="w-4 h-4" /> Official Site <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl">
              <Users className="w-10 h-10 mb-6 opacity-40" />
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-1">Active Classes</h3>
              <p className="text-5xl font-black">{classes.length}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <School className="w-10 h-10 mb-6 text-indigo-100" />
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Enrollment</h3>
               <p className="text-5xl font-black text-slate-900">{classes.reduce((acc, c) => acc + c.studentIds.length, 0)}</p>
            </div>
          </div>
        </div>
      ) : selectedClass ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedClass(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-100"><ArrowLeft /></button>
            <div><h2 className="text-2xl font-black tracking-tight">{selectedClass.name}</h2><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{university?.name}</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 overflow-hidden">
                   <div className="flex gap-4 border-b mb-8"><button onClick={() => setActiveTab('roster')} className={`pb-4 px-2 font-black text-[10px] uppercase tracking-widest ${activeTab === 'roster' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-300'}`}>Roster</button><button onClick={() => setActiveTab('attendance')} className={`pb-4 px-2 font-black text-[10px] uppercase tracking-widest ${activeTab === 'attendance' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-300'}`}>Live Logs</button></div>
                   {activeTab === 'roster' ? (
                     <div className="divide-y">{studentProfiles.map(s => <div key={s.id} className="py-4 flex items-center justify-between"><div className="flex items-center gap-3"><img src={s.picture} className="w-10 h-10 rounded-full" /><div><p className="font-bold">{s.name}</p><p className="text-[10px] text-slate-400">{s.email}</p></div></div><span className="text-[10px] font-black text-slate-400"># {s.id.slice(0,5)}</span></div>)}</div>
                   ) : (
                     <div className="divide-y">{attendance.map(a => <div key={a.id} className="py-4 flex justify-between"><div><p className="font-bold">{studentProfiles.find(s => s.id === a.studentId)?.name || 'Student'}</p><p className="text-[10px] text-slate-400">{format(new Date(a.timestamp), 'h:mm a')}</p></div><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black">{a.status}</span></div>)}</div>
                   )}
                </div>
             </div>
             <div className="space-y-6">
                <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
                  <h3 className="font-black text-xs uppercase tracking-[0.3em] text-indigo-400 mb-6">Session Control</h3>
                  <Button fullWidth className="py-4 mb-3" onClick={() => setShowQRModal(true)}>Launch QR Code</Button>
                  <Button variant="outline" fullWidth className="py-4 text-white border-slate-700 hover:border-indigo-400">Export History</Button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="bg-indigo-600 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="text-center md:text-left">
                <p className="text-indigo-200 font-black text-[10px] uppercase tracking-[0.3em] mb-2">{university?.name}</p>
                <h2 className="text-4xl font-black tracking-tighter mb-2">Welcome back, {user.name.split(' ')[0]}</h2>
                <p className="text-indigo-100 font-medium opacity-80">Accessing institutional data via Cloud Portal.</p>
              </div>
              <button onClick={() => setCurrentTab('university')} className="px-8 py-4 bg-white/10 backdrop-blur-md rounded-2xl flex items-center gap-3 hover:bg-white/20 transition-all font-bold text-sm"><Building2 className="w-5 h-5" /> University Info</button>
            </div>
          </div>

          {user.role === UserRole.TEACHER ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center px-4"><h3 className="text-2xl font-black">My Courses</h3><Button onClick={() => setShowClassModal(true)} className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add Course</Button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {classes.map(c => <div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer group border border-slate-100"><div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:rotate-12 transition-transform"><BookOpen /></div><h4 className="text-xl font-black mb-1">{c.name}</h4><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{c.subject}</p></div>)}
              </div>
            </div>
          ) : user.role === UserRole.STUDENT ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border-2 border-indigo-50">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Register for Course</h3>
                  <form onSubmit={handleJoinByCode} className="flex gap-4">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} placeholder="COURSE CODE" className="flex-1 p-5 bg-slate-50 border rounded-2xl font-black tracking-[0.4em] uppercase" />
                    <Button type="submit">Join</Button>
                  </form>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {enrolledClasses.map(c => <div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-6 rounded-3xl shadow-sm border-l-[8px] border-indigo-600 flex justify-between items-center cursor-pointer hover:shadow-lg transition-all"><div><p className="font-black">{c.name}</p><p className="text-[10px] text-slate-400">{c.subject}</p></div><ChevronRight className="text-slate-300" /></div>)}
                </div>
              </div>
              <div className="bg-indigo-600 p-10 rounded-[3rem] text-white flex flex-col items-center justify-center gap-6 shadow-2xl">
                <QrCode className="w-20 h-20 opacity-30" />
                <h3 className="text-2xl font-black text-center">Clock-in</h3>
                <Button variant="secondary" fullWidth onClick={() => setShowScannerModal(true)}>Open Scanner</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
               <div className="bg-white p-10 rounded-[3rem] shadow-sm border flex flex-col justify-between">
                  <div><Users className="text-indigo-600 w-10 h-10 mb-6" /><h3 className="text-2xl font-black mb-2">Manage Faculty</h3><p className="text-slate-500 text-sm">Overview of all active professors and teachers within the institution.</p></div>
                  <Button variant="outline" className="mt-8">Manage Users</Button>
               </div>
               <div className="bg-white p-10 rounded-[3rem] shadow-sm border flex flex-col justify-between">
                  <div><ListChecks className="text-emerald-600 w-10 h-10 mb-6" /><h3 className="text-2xl font-black mb-2">Classroom Audit</h3><p className="text-slate-500 text-sm">View attendance metrics and active sessions across the university.</p></div>
                  <Button variant="outline" className="mt-8" onClick={() => setCurrentTab('classes')}>View Analytics</Button>
               </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title="Create New Course"><ClassForm onSubmit={handleAddClass} onCancel={() => setShowClassModal(false)} /></Modal>
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="Session Entrance QR"><div className="flex flex-col items-center gap-8 py-6"><QRCodeSVG value={JSON.stringify({ classId: selectedClass?.id, timestamp: Date.now() })} size={250} /><p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Valid for 30 minutes</p></div></Modal>
      <Modal isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} title="Optical Scanner"><QRScanner onScan={handleScan} onCancel={() => setShowScannerModal(false)} /></Modal>
    </Layout>
  );
}
