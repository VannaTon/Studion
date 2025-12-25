
import { supabase } from './supabase.ts';
import { Class, AttendanceRecord, User, UserRole, University } from '../types.ts';

export const dbService = {
  // Authentication & Profiles
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;

    if (profile) {
      return {
        id: profile.id,
        googleId: profile.google_id,
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
        role: profile.role,
        universityId: profile.university_id,
        phoneNumber: profile.phone_number || '',
        subject: profile.subject || ''
      } as User;
    }
    return null;
  },

  getProfilesByIds: async (ids: string[]): Promise<User[]> => {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids);
    
    if (error) return [];
    return data.map(p => ({
      id: p.id,
      googleId: p.google_id,
      name: p.name,
      email: p.email,
      picture: p.picture,
      role: p.role,
      universityId: p.university_id,
      phoneNumber: p.phone_number || '',
      subject: p.subject || ''
    }));
  },

  upsertProfile: async (user: User) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        google_id: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        role: user.role,
        university_id: user.universityId,
        phone_number: user.phoneNumber,
        subject: user.subject
      });
    return !error;
  },

  // Universities
  getAllUniversities: async (): Promise<University[]> => {
    const { data, error } = await supabase
      .from('universities')
      .select('*');
    if (error) return [];
    return data.map(u => ({
      id: u.id,
      name: u.name,
      description: u.description,
      location: u.location,
      website: u.website,
      logo: u.logo,
      phoneNumber: u.phone_number || ''
    }));
  },

  getUniversityById: async (id: string): Promise<University | null> => {
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      location: data.location,
      website: data.website,
      logo: data.logo,
      phoneNumber: data.phone_number || ''
    };
  },

  upsertUniversity: async (uni: University) => {
    const { error } = await supabase
      .from('universities')
      .upsert({
        id: uni.id,
        name: uni.name,
        description: uni.description,
        location: uni.location,
        website: uni.website,
        logo: uni.logo,
        phone_number: uni.phoneNumber
      });
    return !error;
  },

  // Classes
  getClassesByTeacher: async (teacherId: string): Promise<Class[]> => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, enrollments:class_enrollments(student_id)')
      .eq('teacher_id', teacherId);

    if (error) return [];
    return data.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      subject: c.subject,
      grade: c.grade,
      academicYear: c.academic_year,
      teacherId: c.teacher_id,
      universityId: c.university_id,
      studentIds: (c.enrollments || []).map((e: any) => e.student_id)
    }));
  },

  getClassesByUniversity: async (uniId: string): Promise<Class[]> => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, enrollments:class_enrollments(student_id)')
      .eq('university_id', uniId);

    if (error) return [];
    return data.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      subject: c.subject,
      grade: c.grade,
      academicYear: c.academic_year,
      teacherId: c.teacher_id,
      universityId: c.university_id,
      studentIds: (c.enrollments || []).map((e: any) => e.student_id)
    }));
  },

  getAllClasses: async (): Promise<Class[]> => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, enrollments:class_enrollments(student_id)');

    if (error) return [];
    return data.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      subject: c.subject,
      grade: c.grade,
      academicYear: c.academic_year,
      teacherId: c.teacher_id,
      universityId: c.university_id,
      studentIds: (c.enrollments || []).map((e: any) => e.student_id)
    }));
  },

  saveClass: async (newClass: Class) => {
    const { error } = await supabase
      .from('classes')
      .upsert({
        id: newClass.id,
        code: newClass.code,
        teacher_id: newClass.teacherId,
        university_id: newClass.universityId,
        name: newClass.name,
        subject: newClass.subject,
        grade: newClass.grade,
        academic_year: newClass.academicYear
      });
    return !error;
  },

  deleteClass: async (classId: string) => {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);
    return !error;
  },

  joinClass: async (classId: string, studentId: string) => {
    const { error } = await supabase
      .from('class_enrollments')
      .insert({ class_id: classId, student_id: studentId });
    return !error;
  },

  getAttendance: async (classId?: string, studentId?: string): Promise<AttendanceRecord[]> => {
    let query = supabase.from('attendance').select('*');
    if (classId) query = query.eq('class_id', classId);
    if (studentId) query = query.eq('student_id', studentId);

    const { data, error } = await query;
    if (error) return [];
    return data.map(r => ({
      id: r.id,
      classId: r.class_id,
      studentId: r.student_id,
      date: r.date,
      timestamp: r.timestamp,
      status: r.status,
      method: r.method
    }));
  },

  saveAttendance: async (record: AttendanceRecord) => {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('class_id', record.classId)
      .eq('student_id', record.studentId)
      .eq('date', record.date)
      .maybeSingle();

    if (existing) return false;

    const { error } = await supabase
      .from('attendance')
      .insert({
        id: record.id,
        class_id: record.classId,
        student_id: record.studentId,
        date: record.date,
        timestamp: record.timestamp,
        status: record.status,
        method: record.method
      });
    return !error;
  }
};
