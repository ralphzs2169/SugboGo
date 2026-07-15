/**
 * Application environment configuration.
 *
 * Centralizes access to environment variables so the rest of the application
 * doesn't read directly from process.env.
 */
export const ENV = {
  API_URL: process.env.EXPO_PUBLIC_API_URL!,
};
