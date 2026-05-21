export const ROUTES = {
  HOME: '/',
  EXPLORE: '/explore',
  AUTH: {
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    CALLBACK: '/auth/callback',
    SELECT_ROLE: '/select-role',
    LOGOUT: '/logout',
  },
  DASHBOARD: {
    BUYER: '/dashboard/buyer',
    CREATOR: '/dashboard/creator',
    ADMIN: '/dashboard/admin',
  }
} as const;
