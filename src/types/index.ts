/** Shared TypeScript interfaces mirroring src/types/index.ts in the frontend. */

export type UserRole = 'patient' | 'nurse' | 'carer' | 'facility_admin' | 'admin';

export interface UserRow {
  id: string;
  email: string;
  hashed_password: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;           // stored encrypted
  role: UserRole;
  //avatar_url: string | null;
  date_of_birth: Date;
  emergency_contact: string | null;
  is_active: boolean;
  is_verified: boolean;
  mfa_enabled: boolean;
  oauth_provider: string | null;
  oauth_subject: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface NurseProfileRow {
  id: string;
  user_id: string;
  bio: string | null;
  years_of_experience: number;
  hourly_rate: number;
  location: string | null;
  is_available: boolean;
  rating: number;
  review_count: number;
  specializations: string | null;  // comma-separated
  created_at: Date;
  updated_at: Date;
}

export interface CredentialRow {
  id: string;
  nurse_profile_id: string;
  name: string;
  issuing_body: string;
  issue_date: string;
  expiry_date: string;
  document_url: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: Date;
}

export interface AvailabilitySlotRow {
  id: string;
  nurse_profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export type ServiceType =
  | 'home_care' | 'hospital_support' | 'elderly_care'
  | 'companion_service' | 'post_surgical' | 'pediatric_care';

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface BookingRow {
  id: string;
  patient_id: string;
  nurse_id: string;
  service_type: ServiceType;
  status: BookingStatus;
  start_date: string;
  end_date: string;
  hours: number;
  total_amount: number;
  address: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface HealthMetricRow {
  id: string;
  user_id: string;
  date: string;
  heart_rate: string | null;              // encrypted
  blood_pressure_systolic: string | null; // encrypted
  blood_pressure_diastolic: string | null;// encrypted
  oxygen_saturation: string | null;       // encrypted
  temperature: string | null;             // encrypted
  weight: string | null;                  // encrypted
  created_at: Date;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface MfaConfigRow {
  id: string;
  user_id: string;
  totp_secret: string | null;   // encrypted
  is_confirmed: boolean;
  created_at: Date;
}

// ── Express Request augmentation ──────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}
