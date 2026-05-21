export type UserRole = 'buyer' | 'creator' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  city: string | null;
  state: string | null;
  country: string;
  language: string | null;
  is_seller: boolean;
  is_mentor: boolean;
  is_business: boolean;
  is_service_provider: boolean;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
