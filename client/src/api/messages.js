import { api } from './client';

export const messages = {
  list: (universeId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/v1/universes/${universeId}/messages${q ? '?' + q : ''}`);
  },
  send: (universeId, body) => api.post(`/api/v1/universes/${universeId}/message`, body),
};
