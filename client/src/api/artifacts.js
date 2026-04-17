import { api } from './client';

export const artifacts = {
  list: (universeId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/v1/universes/${universeId}/artifacts${q ? '?' + q : ''}`);
  },
  get: (universeId, artId) => api.get(`/api/v1/universes/${universeId}/artifacts/${artId}`),
};
