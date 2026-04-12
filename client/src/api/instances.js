import { api } from './client';

const BASE = '/api/v1/instances';

export const instances = {
  list:        ()             => api.get(BASE),
  create:      (body)         => api.post(BASE, body),
  delete:      (id)           => api.delete(`${BASE}/${id}`),
  start:       (id)           => api.post(`${BASE}/${id}/start`),
  stop:        (id)           => api.post(`${BASE}/${id}/stop`),
  reset:       (id)           => api.post(`${BASE}/${id}/reset`),
  patchConfig: (id, body)     => api.patch(`${BASE}/${id}/config`, body),
  getState:    (id)           => api.get(`${BASE}/${id}/state`),
};
