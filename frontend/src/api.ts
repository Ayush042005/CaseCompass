const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL = (configuredApiUrl ?? (import.meta.env.PROD ? '' : 'http://localhost:8000')).replace(/\/$/, '');
