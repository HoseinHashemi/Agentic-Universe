import { api } from './client';

export const agents = {
  list:   (universeId)          => api.get(`/api/v1/universes/${universeId}/agents`),
  add:    (universeId, body)    => api.post(`/api/v1/universes/${universeId}/agents`, body),
  remove: (universeId, agentId) => api.delete(`/api/v1/universes/${universeId}/agents/${agentId}`),
};
