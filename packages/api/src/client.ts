// Browser-safe API entry point.
// Do not export payments, media/R2, admin, webhooks, or server-only services here.

export * from './auth/auth.service';
export {
  ensureUserProfile,
  getCurrentProfile,
  getDashboardRedirectPath,
} from './profiles/profile.service';
export { createProfileForAuthUser } from './profiles/profile.repository';
