import { api } from './client';

export const sessions = {
  get:    (universeId) => api.get(`/api/v1/universes/${universeId}/session`),
  start:  (universeId) => api.post(`/api/v1/universes/${universeId}/session`),
  stop:   (universeId) => api.delete(`/api/v1/universes/${universeId}/session`),
  pause:  (universeId) => api.patch(`/api/v1/universes/${universeId}/session`, { action: 'pause' }),
  resume: (universeId) => api.patch(`/api/v1/universes/${universeId}/session`, { action: 'resume' }),
};
