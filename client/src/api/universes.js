import { api } from './client';

const BASE = '/api/v1/universes';

export const universes = {
  list:   ()              => api.get(BASE),
  get:    (id)            => api.get(`${BASE}/${id}`),
  create: (body)          => api.post(BASE, body),
  update: (id, body)      => api.put(`${BASE}/${id}`, body),
  delete: (id)            => api.delete(`${BASE}/${id}`),
  fork:   (id, body = {}) => api.post(`${BASE}/${id}/fork`, body),
};
