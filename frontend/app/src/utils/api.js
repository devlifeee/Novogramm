const configuredBase = typeof __API_BASE_URL__ === 'string' ? __API_BASE_URL__ : '';
const apiBase = configuredBase.replace(/\/$/, '');

export const apiUrl = (path) => `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;

// Uploaded media belongs to the API service, while bundled static assets belong
// to the Appwrite Site. Stored media paths intentionally remain relative API URLs.
export const mediaUrl = (path) => (
  path && path.startsWith('/static/uploads/') ? apiUrl(path) : path
);
