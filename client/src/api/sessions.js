import { api } from './client';

export const sessions = {
  get:   (universeId) => api.get(`/api/v1/universes/${universeId}/session`),
  start: (universeId) => api.post(`/api/v1/universes/${universeId}/session`),
  stop:  (universeId) => api.delete(`/api/v1/universes/${universeId}/session`),
};
