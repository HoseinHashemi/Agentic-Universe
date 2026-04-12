/**
 * WebSocket client wrapper.
 * Reconnects automatically. Routes messages by type to registered handlers.
 */
export class WsClient {
  constructor(url) {
    this._url = url;
    this._handlers = new Map(); // type → [fn, ...]
    this._connected = false;
    this._reconnectDelay = 1500;
    this._connect();
  }

  _connect() {
    const ws = new WebSocket(this._url);
    this._ws = ws;

    ws.addEventListener('open', () => {
      this._connected = true;
      this._reconnectDelay = 1500;
      this._dispatch('_connected', null);
    });

    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      this._dispatch(msg.type, msg.payload);
    });

    ws.addEventListener('close', () => {
      this._connected = false;
      this._dispatch('_disconnected', null);
      setTimeout(() => this._connect(), this._reconnectDelay);
      this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, 10000);
    });

    ws.addEventListener('error', () => ws.close());
  }

  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, []);
    this._handlers.get(type).push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const arr = this._handlers.get(type);
    if (arr) {
      const i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    }
  }

  _dispatch(type, payload) {
    for (const fn of (this._handlers.get(type) || [])) {
      try { fn(payload); } catch (e) { console.error('[WS dispatch]', e); }
    }
  }

  get connected() { return this._connected; }
}
