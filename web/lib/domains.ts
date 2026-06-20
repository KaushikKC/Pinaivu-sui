const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || '';

export function chatUrl(path: string = ''): string {
  if (!BASE_DOMAIN) return path || '/';
  return `https://chat.${BASE_DOMAIN}${path}`;
}

export function explorerUrl(path: string = ''): string {
  if (!BASE_DOMAIN) return `/explorer${path}`;
  return `https://explorer.${BASE_DOMAIN}${path}`;
}

export function apiUrl(path: string = ''): string {
  if (!BASE_DOMAIN) return path;
  return `https://api.${BASE_DOMAIN}${path}`;
}
