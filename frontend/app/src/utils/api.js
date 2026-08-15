const configuredBase = typeof __API_BASE_URL__ === 'string' ? __API_BASE_URL__ : '';
const apiBase = configuredBase.replace(/\/$/, '');

export const apiUrl = (path) => `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
