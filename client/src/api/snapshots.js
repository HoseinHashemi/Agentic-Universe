import { api } from './client';

export const snapshots = {
  list: (universeId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/v1/universes/${universeId}/snapshots${q ? `?${q}` : ''}`);
  },
  get: (universeId, snapId) =>
    api.get(`/api/v1/universes/${universeId}/snapshots/${snapId}`),
};
