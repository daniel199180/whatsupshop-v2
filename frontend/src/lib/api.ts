export const API_BASE_URL: string =
  import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
