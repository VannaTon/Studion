
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  UNIVERSITY = 'UNIVERSITY',
  ADMIN = 'ADMIN'
}

export interface University {
  id: string;
  name: string;
  description: string;
  location: string;
  website: string;
  logo: string;
  phoneNumber: string; // Institutional contact
}

export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture: string;
  role: UserRole;
  universityId?: string; // Linked institution
  phoneNumber: string;
  subject?: string; // For teachers
}

export interface Class {
  id: string;
  code: string;
  teacherId: string;
  universityId: string; // Every class belongs to a university
  name: string;
  subject: string;
  grade: string;
  academicYear: string;
  studentIds: string[];
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'Present' | 'Absent' | 'Late';
  method: 'QR' | 'Manual';
}
