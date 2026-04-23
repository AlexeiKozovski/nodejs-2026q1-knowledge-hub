import { UserRole } from '../types';

/** Populated by JwtAuthGuard from access token payload */
export interface AuthenticatedUser {
  userId: string;
  login: string;
  role: UserRole;
}
