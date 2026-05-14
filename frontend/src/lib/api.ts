const rawApiUrl = import.meta.env.PUBLIC_API_URL;

export const API_BASE_URL: string =
  rawApiUrl && rawApiUrl.trim() !== ''
    ? rawApiUrl.replace(/\/$/, '')
    : 'https://api-agencia-catalogo.n2wanx.easypanel.host';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
