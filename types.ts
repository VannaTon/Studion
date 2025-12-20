
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture: string;
  role: UserRole;
}

export interface Class {
  id: string;
  code: string; // Unique short code for students to join
  teacherId: string;
  name: string;
  subject: string;
  grade: string;
  academicYear: string;
  studentIds: string[];
}

export interface Student {
  id: string;
  studentId: string; // School-specific ID
  name: string;
  email?: string;
  classes: string[];
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

export interface QRToken {
  classId: string;
  date: string;
  token: string;
  expiresAt: number;
}
