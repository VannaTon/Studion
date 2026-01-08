
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
  LogOut,
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
  School,
  Phone,
  Bookmark
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

  // Registration Flow State
  const [regStep, setRegStep] = useState<'LOGIN' | 'ROLE' | 'UNI_SELECT' | 'UNI_FORM' | 'DETAILS'>('LOGIN');
  const [tempAuthUser, setTempAuthUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  
  // Registration Form Data
  const [uniFormData, setUniFormData] = useState({
    name: '',
    description: '',
    location: '',
    website: '',
    phoneNumber: ''
  });
  
  const [personalFormData, setPersonalFormData] = useState({
    phoneNumber: '',
    subject: ''
  });

  // UI state
  const [showClassModal, setShowClassModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const enrolledClasses = useMemo(() => {
    if (!user || user.role !== UserRole.STUDENT) return [];
    return classes.filter(c => c.studentIds.includes(user.id));
  }, [classes, user]);

  // Auth initialization and listener
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const profile = await dbService.getCurrentUser();
          if (profile) {
            setUser(profile);
            if (profile.universityId) {
              const uni = await dbService.getUniversityById(profile.universityId);
              setUniversity(uni);
            }
          } else {
            setTempAuthUser(session.user);
            setRegStep('ROLE');
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUniversity(null);
        setClasses([]);
        setSelectedClass(null);
        setCurrentTab('classes');
        setRegStep('LOGIN');
        setLoading(false);
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setLoading(true);
        const profile = await dbService.getCurrentUser();
        if (profile) {
          setUser(profile);
          if (profile.universityId) {
            const uni = await dbService.getUniversityById(profile.universityId);
            setUniversity(uni);
          }
        } else {
          setTempAuthUser(session.user);
          setRegStep('ROLE');
        }
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      if (user.role === UserRole.TEACHER) {
        const teacherClasses = await dbService.getClassesByTeacher(user.id);
        setClasses(teacherClasses);
      } else if (user.role === UserRole.STUDENT) {
        const allClasses = await dbService.getAllClasses();
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

  const initiateGoogleSignIn = async () => {
    // We use window.location.href to ensure the origin is captured exactly as the browser sees it.
    // Ensure this URL is whitelisted in Supabase Dashboard -> Auth -> URL Configuration.
    const redirectTo = window.location.origin;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error("Login Error:", error.message);
      alert("Authentication failed: " + error.message);
    }
  };

  const handleLogout = async () => {
    setOpLoading(true);
    try {
      // Clear local state first for immediate UI feedback
      setUser(null);
      setUniversity(null);
      setSelectedClass(null);
      setClasses([]);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setOpLoading(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    setSelectedRole(role);
    if (role === UserRole.UNIVERSITY) {
      setRegStep('UNI_FORM');
    } else {
      setOpLoading(true);
      const unis = await dbService.getAllUniversities();
      setAllUniversities(unis);
      setOpLoading(false);
      setRegStep('UNI_SELECT');
    }
  };

  const finalizeRegistration = async () => {
    if (!tempAuthUser || !selectedRole) return;
    setOpLoading(true);
    try {
      let finalUniId = selectedUniId;

      if (selectedRole === UserRole.UNIVERSITY) {
        const newUni: University = {
          id: crypto.randomUUID(),
          ...uniFormData,
          logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(uniFormData.name)}`,
          phoneNumber: uniFormData.phoneNumber
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
        universityId: finalUniId || undefined,
        phoneNumber: personalFormData.phoneNumber || uniFormData.phoneNumber,
        subject: selectedRole === UserRole.TEACHER ? personalFormData.subject : undefined
      };
      
      const success = await dbService.upsertProfile(newUser);
      if (success) {
        setUser(newUser);
        if (finalUniId && !university) {
          const uni = await dbService.getUniversityById(finalUniId);
          setUniversity(uni);
        }
      }
    } catch (err) {
      console.error("Registration finalization error:", err);
      alert("Registration failed. Please check your connection.");
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
        alert("Class not found in your university. Check the code.");
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
      const success = await dbService.saveAttendance(record);
      if (success) {
        alert("Clocked in successfully!");
        await refreshData();
      } else {
        alert("Attendance already marked for today.");
      }
      setShowScannerModal(false);
    } catch (e) {
      alert("Invalid Code Format");
    } finally {
      setOpLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 w-12 h-12 mb-4" />
      <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Synchronizing with Cloud</p>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] p-10 max-w-xl w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">EduScan <span className="text-indigo-600">Enterprise</span></h1>
            <p className="text-slate-500 font-medium">Modernizing Academic Attendance</p>
          </div>

          {regStep === 'LOGIN' && (
            <div className="animate-in fade-in duration-300">
              <Button fullWidth onClick={initiateGoogleSignIn} className="py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                <LogIn className="w-5 h-5" /> Sign in with Google
              </Button>
              <p className="mt-6 text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest">Secure OAuth 2.0 Encryption</p>
            </div>
          )}

          {regStep === 'ROLE' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-xl font-black text-slate-800 text-center">I am registering as a...</h2>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { role: UserRole.UNIVERSITY, title: 'University Admin', icon: Building2, color: 'indigo', desc: 'Control your entire institution' },
                  { role: UserRole.TEACHER, title: 'Teacher / Professor', icon: BookOpen, color: 'emerald', desc: 'Manage classes and rosters' },
                  { role: UserRole.STUDENT, title: 'Student', icon: Users, color: 'amber', desc: 'Track your personal attendance' }
                ].map((item) => (
                  <button key={item.role} onClick={() => handleRoleSelect(item.role)} className="p-6 border-2 border-slate-50 rounded-[1.5rem] hover:border-indigo-600 transition-all flex items-center justify-between group bg-slate-50/50">
                    <div className="flex items-center gap-5">
                      <div className={`p-4 rounded-2xl bg-white shadow-sm text-${item.color}-600 group-hover:rotate-6 transition-transform`}>
                        <item.icon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {regStep === 'UNI_SELECT' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setRegStep('ROLE')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-black text-slate-800">Choose your University</h2>
              </div>
              <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {allUniversities.map(u => (
                  <button key={u.id} onClick={() => { setSelectedUniId(u.id); setRegStep('DETAILS'); }} className="w-full p-4 border-2 border-slate-50 rounded-2xl hover:border-indigo-600 transition-all text-left flex items-center gap-4 bg-slate-50/50">
                    <img src={u.logo} className="w-12 h-12 rounded-xl border-2 border-white shadow-sm" />
                    <div className="flex-1">
                      <p className="font-black text-slate-800 leading-tight">{u.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{u.location}</p>
                    </div>
                  </button>
                ))}
                {allUniversities.length === 0 && <div className="text-center py-12"><Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No institutions found</p></div>}
              </div>
            </div>
          )}

          {regStep === 'UNI_FORM' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2">
                <button onClick={() => setRegStep('ROLE')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-black text-slate-800">Institution Information</h2>
              </div>
              <div className="space-y-4">
                <div className="relative"><Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" /><input placeholder="University Legal Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={uniFormData.name} onChange={e => setUniFormData({...uniFormData, name: e.target.value})} /></div>
                <div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" /><input placeholder="Campus Location" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={uniFormData.location} onChange={e => setUniFormData({...uniFormData, location: e.target.value})} /></div>
                <div className="relative"><Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" /><input placeholder="Website (e.g. uni.edu)" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={uniFormData.website} onChange={e => setUniFormData({...uniFormData, website: e.target.value})} /></div>
                <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" /><input placeholder="Official Phone Number" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={uniFormData.phoneNumber} onChange={e => setUniFormData({...uniFormData, phoneNumber: e.target.value})} /></div>
                <textarea placeholder="Tell us about the institution..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600 min-h-[100px]" value={uniFormData.description} onChange={e => setUniFormData({...uniFormData, description: e.target.value})} />
                <Button fullWidth onClick={finalizeRegistration} className="py-5 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Establish Portal</Button>
              </div>
            </div>
          )}

          {regStep === 'DETAILS' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2">
                <button onClick={() => setRegStep('UNI_SELECT')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-black text-slate-800">Final Personal Details</h2>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 rounded-2xl flex items-center gap-3">
                   <img src={tempAuthUser?.user_metadata?.avatar_url} className="w-10 h-10 rounded-full" />
                   <div><p className="font-black text-sm text-slate-800">{tempAuthUser?.user_metadata?.full_name}</p><p className="text-[10px] font-bold text-indigo-600 uppercase">Affiliating with Institutional Node</p></div>
                </div>
                
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input placeholder="Personal Phone Number" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={personalFormData.phoneNumber} onChange={e => setPersonalFormData({...personalFormData, phoneNumber: e.target.value})} />
                </div>

                {selectedRole === UserRole.TEACHER && (
                  <div className="relative">
                    <Bookmark className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input placeholder="Teaching Subject (e.g. Quantum Physics)" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-600" value={personalFormData.subject} onChange={e => setPersonalFormData({...personalFormData, subject: e.target.value})} />
                  </div>
                )}
                
                <Button fullWidth onClick={finalizeRegistration} className="py-5 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Complete Profile</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} activeTab={currentTab} onTabChange={(t) => { setSelectedClass(null); setCurrentTab(t as any); }}>
      {opLoading && <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-white w-12 h-12" /></div>}

      {currentTab === 'profile' && user ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 max-w-4xl mx-auto">
           <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12"><UserCircle className="w-64 h-64" /></div>
              <div className="relative z-10">
                <img src={user.picture} alt="Profile" className="w-40 h-40 rounded-[3rem] mx-auto mb-8 border-8 border-indigo-50 shadow-2xl" />
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{user.name}</h2>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-8">{user.email}</p>
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                   <div className="px-6 py-2 bg-indigo-600 text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2">
                     <Award className="w-4 h-4" /> {user.role} Member
                   </div>
                   {user.subject && (
                     <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                       <Bookmark className="w-4 h-4" /> {user.subject} Expert
                     </div>
                   )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-2xl mx-auto mb-12">
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                      <p className="font-bold text-slate-800">{user.phoneNumber || 'Not provided'}</p>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Affiliated Institution</p>
                      <p className="font-bold text-slate-800">{university?.name || 'Independent Node'}</p>
                   </div>
                </div>

                <Button variant="danger" onClick={handleLogout} className="px-12 py-5 rounded-2xl flex items-center justify-center gap-3 mx-auto shadow-xl shadow-red-100 active:scale-95 transition-all">
                  <LogOut className="w-5 h-5" /> Sign Out from Cloud
                </Button>
              </div>
           </div>
        </div>
      ) : currentTab === 'university' && university ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12"><Building2 className="w-64 h-64" /></div>
            <img src={university.logo} className="w-56 h-56 rounded-[2.5rem] shadow-2xl border-8 border-indigo-50 relative z-10" />
            <div className="flex-1 space-y-5 relative z-10">
              <h2 className="text-5xl font-black tracking-tighter text-slate-900">{university.name}</h2>
              <p className="text-slate-500 font-medium leading-relaxed max-w-2xl text-lg">{university.description}</p>
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest"><MapPin className="w-4 h-4 text-indigo-500" /> {university.location}</div>
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest"><Phone className="w-4 h-4 text-indigo-500" /> {university.phoneNumber}</div>
                <a href={university.website} target="_blank" className="flex items-center gap-3 px-5 py-3 bg-indigo-600 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"> Official Website <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 p-8 opacity-10 group-hover:scale-110 transition-transform"><BookOpen className="w-24 h-24" /></div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Academic Nodes</h3>
              <p className="text-6xl font-black mb-4">{classes.length}</p>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Active Classrooms</p>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute -right-4 -bottom-4 p-8 opacity-[0.03] text-indigo-600 group-hover:scale-110 transition-transform"><Users className="w-24 h-24" /></div>
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Total Population</h3>
               <p className="text-6xl font-black text-slate-900 mb-4">{classes.reduce((acc, c) => acc + c.studentIds.length, 0)}</p>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Enrolled Students</p>
            </div>
          </div>
        </div>
      ) : selectedClass ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedClass(null)} className="p-4 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-100 transition-all"><ArrowLeft /></button>
            <div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-900">{selectedClass.name}</h2>
              <div className="flex items-center gap-2"><School className="w-3 h-3 text-indigo-600" /><p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{university?.name}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                   <div className="flex gap-8 border-b border-slate-100 mb-10">
                     <button onClick={() => setActiveTab('roster')} className={`pb-5 px-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'roster' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-300'}`}>Class Roster</button>
                     <button onClick={() => setActiveTab('attendance')} className={`pb-5 px-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-300'}`}>Live Logs</button>
                   </div>
                   {activeTab === 'roster' ? (
                     <div className="divide-y divide-slate-50">
                        {studentProfiles.length === 0 ? <div className="py-20 text-center"><Users className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Classroom is Empty</p></div> : 
                        studentProfiles.map(s => <div key={s.id} className="py-5 flex items-center justify-between group hover:bg-slate-50/50 rounded-2xl px-4 transition-all"><div className="flex items-center gap-4"><img src={s.picture} className="w-12 h-12 rounded-2xl shadow-sm" /><div><p className="font-black text-slate-900">{s.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.phoneNumber || 'No phone recorded'}</p></div></div><span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg uppercase tracking-tighter">ID: {s.id.slice(0,8)}</span></div>)}
                     </div>
                   ) : (
                     <div className="divide-y divide-slate-50">
                        {attendance.length === 0 ? <div className="py-20 text-center"><Clock className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Recent Activity</p></div> : 
                        attendance.map(a => <div key={a.id} className="py-5 flex justify-between items-center px-4"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle className="text-emerald-500 w-6 h-6" /></div><div><p className="font-black text-slate-900">{studentProfiles.find(s => s.id === a.studentId)?.name || 'Unknown User'}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{format(new Date(a.timestamp), 'h:mm a • MMM do')}</p></div></div><span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Marked Present</span></div>)}
                     </div>
                   )}
                </div>
             </div>
             <div className="space-y-6">
                <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><QrCode className="w-32 h-32" /></div>
                  <h3 className="font-black text-xs uppercase tracking-[0.4em] text-indigo-400 mb-10 relative z-10">Academic Command</h3>
                  <Button fullWidth className="py-5 mb-4 rounded-[1.5rem] bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-900" onClick={() => setShowQRModal(true)}>Deploy Entrance QR</Button>
                  <Button variant="outline" fullWidth className="py-5 rounded-[1.5rem] text-white border-slate-700 hover:border-indigo-400 font-black text-xs uppercase tracking-widest" onClick={() => alert("Export function disabled in preview")}>Export Statistics</Button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12"><Sparkles className="w-64 h-64" /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="text-center md:text-left">
                <p className="text-indigo-200 font-black text-[10px] uppercase tracking-[0.4em] mb-3">{university?.name}</p>
                <h2 className="text-5xl font-black tracking-tighter mb-4">Hello, {user.name.split(' ')[0]}!</h2>
                <div className="flex items-center gap-3 text-indigo-100/80 font-medium">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  Portal connected to Cloud Node
                </div>
              </div>
              <button onClick={() => setCurrentTab('university')} className="px-10 py-5 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center gap-4 hover:bg-white/20 transition-all font-black text-xs uppercase tracking-[0.2em] shadow-2xl"><Building2 className="w-5 h-5" /> Institutional Hub</button>
            </div>
          </div>

          {user.role === UserRole.TEACHER ? (
            <div className="space-y-10">
              <div className="flex justify-between items-center px-4"><h3 className="text-3xl font-black tracking-tighter text-slate-900">Assigned Courses</h3><Button onClick={() => setShowClassModal(true)} className="flex items-center gap-3 py-4 px-8 rounded-2xl shadow-indigo-100 shadow-2xl text-xs font-black uppercase tracking-widest"><Plus className="w-5 h-5" /> New Unit</Button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {classes.map(c => <div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-10 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer group border border-slate-100 relative overflow-hidden"><div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all shadow-sm"><BookOpen className="w-8 h-8" /></div><h4 className="text-2xl font-black mb-2 tracking-tight group-hover:text-indigo-600 transition-colors">{c.name}</h4><div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest pt-6 border-t border-slate-50"><span>{c.subject}</span><span className="bg-slate-50 px-3 py-1 rounded-lg">{c.studentIds.length} ENROLLED</span></div></div>)}
                {classes.length === 0 && <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100"><BookOpen className="w-16 h-16 text-slate-100 mx-auto mb-6" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active classrooms detected</p></div>}
              </div>
            </div>
          ) : user.role === UserRole.STUDENT ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-12">
                <div className="bg-white p-12 rounded-[3rem] shadow-sm border-2 border-indigo-50/50">
                  <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3"><UserPlus className="w-5 h-5 text-indigo-600" /> Enter Course Code</h3>
                  <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-5">
                    <div className="relative flex-1"><Hash className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" /><input value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} placeholder="6-DIGIT CODE" className="w-full pl-16 pr-8 py-6 bg-slate-50 border-0 rounded-[2rem] font-black tracking-[0.5em] text-2xl uppercase focus:ring-2 focus:ring-indigo-600" /></div>
                    <Button type="submit" className="px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Enroll</Button>
                  </form>
                </div>
                <div className="space-y-6">
                   <h3 className="text-xs font-black text-slate-400 flex items-center gap-3 tracking-[0.3em] uppercase px-4"><Bookmark className="w-4 h-4 text-indigo-600" /> My Current Enrollments</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                     {enrolledClasses.map(c => <div key={c.id} onClick={() => setSelectedClass(c)} className="bg-white p-8 rounded-[2.5rem] shadow-sm border-l-[12px] border-indigo-600 flex justify-between items-center cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-1 group"><div><p className="font-black text-xl text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{c.name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{c.subject}</p></div><div className="p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></div></div>)}
                     {enrolledClasses.length === 0 && <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-50 text-slate-400 font-bold text-xs uppercase tracking-widest">No active courses found</div>}
                   </div>
                </div>
              </div>
              <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white flex flex-col items-center justify-center gap-10 shadow-2xl shadow-indigo-200 group">
                <div className="relative"><div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 group-hover:scale-175 transition-transform"></div><QrCode className="w-24 h-24 relative z-10 opacity-80" /></div>
                <div className="text-center"><h3 className="text-3xl font-black mb-3 tracking-tighter">Instant Clock-in</h3><p className="text-indigo-100/80 font-medium text-sm leading-relaxed">Ready to mark your attendance? Scan the classroom code now.</p></div>
                <Button variant="secondary" fullWidth className="py-6 rounded-[2rem] bg-white text-indigo-600 font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl hover:scale-105 active:scale-95 transition-all" onClick={() => setShowScannerModal(true)}>Open Scanner</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
               <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-50 flex flex-col justify-between hover:shadow-2xl transition-all group">
                  <div><div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-8 group-hover:rotate-6 transition-transform shadow-sm"><Users className="w-8 h-8" /></div><h3 className="text-2xl font-black mb-3 tracking-tighter">Faculty Control</h3><p className="text-slate-500 text-sm font-medium leading-relaxed">Manage professor profiles, specialized subjects, and contact information institutional-wide.</p></div>
                  <Button variant="outline" className="mt-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Access Roster</Button>
               </div>
               <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-50 flex flex-col justify-between hover:shadow-2xl transition-all group">
                  <div><div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 group-hover:rotate-6 transition-transform shadow-sm"><ListChecks className="w-8 h-8" /></div><h3 className="text-2xl font-black mb-3 tracking-tighter">Audit System</h3><p className="text-slate-500 text-sm font-medium leading-relaxed">Real-time attendance metrics across all departments. Verify academic engagement instantly.</p></div>
                  <Button variant="outline" className="mt-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setCurrentTab('classes')}>View Analytics</Button>
               </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title="New Academic Unit"><ClassForm onSubmit={handleAddClass} onCancel={() => setShowClassModal(false)} /></Modal>
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="Session Entry Token"><div className="flex flex-col items-center gap-10 py-8"><div className="p-8 bg-white rounded-[3rem] shadow-inner border-[12px] border-slate-50"><QRCodeSVG value={JSON.stringify({ classId: selectedClass?.id, timestamp: Date.now() })} size={280} level="H" includeMargin={true} /></div><div className="text-center"><p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] mb-2">Secure Cloud Token</p><p className="text-slate-400 font-bold text-xs">Expires automatically in 30 minutes</p></div><Button fullWidth onClick={() => setShowQRModal(false)} className="py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest">Close Access</Button></div></Modal>
      <Modal isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} title="Biometric Scanner"><QRScanner onScan={handleScan} onCancel={() => setShowScannerModal(false)} /></Modal>
    </Layout>
  );
}
