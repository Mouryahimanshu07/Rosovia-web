import { UserRole } from '../types/user';

export const ROLES: Record<string, UserRole> = {
  BUYER: 'buyer',
  CREATOR: 'creator',
  ADMIN: 'admin',
} as const;
