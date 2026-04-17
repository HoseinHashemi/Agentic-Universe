import { api } from './client';

const BASE = '/api/v1/universes';

export const universes = {
  list:   ()               => api.get(BASE),
  get:    (id)             => api.get(`${BASE}/${id}`),
  create: (body)           => api.post(BASE, body),           // { description }
  refine: (id, body)       => api.put(`${BASE}/${id}`, body), // { instruction }
  delete: (id)             => api.delete(`${BASE}/${id}`),
  fork:   (id)             => api.post(`${BASE}/${id}/fork`),
};
