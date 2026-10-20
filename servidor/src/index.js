// Bali Rush · EL SERVIDOR DEL MODO ONLINE (V220)
// Lo pidió Jose Javier (20-10-2026): «¿y no hay manera de que se juegue online?» → eligió Cloudflare.
// No guarda nada ni sabe de carreras: solo reenvía. Cada sala es un código de 4 letras y vive en su propio
// Durable Object (en memoria; se borra sola cuando se van todos). Quien crea la sala es la moto 1 y hace de
// centro, como en la wifi: los demás le hablan a él y él a ellos (estrella), así el juego no cambia por dentro.
//   wss://…/s/KUTA?rol=crea   → «!soy 1»               (si ya hay alguien creándola: «!err ocupada»)
//   wss://…/s/KUTA?rol=une    → «!soy N» (N = 2…6)     («!err nosala» si no hay nadie, «!err llena» si son 6)
//   la moto 1 manda «N|texto» (a la moto N) o «*|texto» (a todos); recibe «N|texto», «!entra N», «!sale N»
//   las demás mandan «texto» (a la moto 1) y reciben «texto»; si la moto 1 se va: «!fin»
import { DurableObject } from 'cloudflare:workers';

const MAX = 6;                                       // motos por sala
const LARGO = 8000;                                  // letras por mensaje, como mucho
const POR_SEG = 80;                                  // mensajes por segundo y móvil, como mucho (el juego manda ~17)
const ORIGENES = ['https://sceptiko3.github.io', 'http://localhost', 'http://127.0.0.1'];

function origenVale(o) { return !o || ORIGENES.some((b) => o === b || o.startsWith(b + ':')); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/s\/([A-Z]{4,6})$/);
    if (!m) return new Response('Bali Rush online: funcionando', { headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Hace falta WebSocket', { status: 426 });
    if (!origenVale(req.headers.get('Origin'))) return new Response('No', { status: 403 });
    return env.SALA.get(env.SALA.idFromName(m[1])).fetch(req);
  },
};

export class Sala extends DurableObject {
  socks() { return this.ctx.getWebSockets().map((w) => ({ w, a: w.deserializeAttachment() || {} })); }
  de(p) { const s = this.socks().find((x) => x.a.p === p); return s ? s.w : null; }
  manda(w, t) { try { w.send(t); } catch (e) {} }
  async fetch(req) {
    const rol = new URL(req.url).searchParams.get('rol');
    const [cli, srv] = Object.values(new WebSocketPair());
    const fallo = (t) => { srv.accept(); srv.send('!err ' + t); srv.close(4000, t); return new Response(null, { status: 101, webSocket: cli }); };
    const ss = this.socks(), host = this.de(1);
    let p;
    if (rol === 'crea') { if (host) return fallo('ocupada'); p = 1; }
    else if (rol === 'une') {
      if (!host) return fallo('nosala');
      for (let n = 2; n <= MAX; n++) if (!ss.some((x) => x.a.p === n)) { p = n; break; }
      if (!p) return fallo('llena');
    } else return fallo('rol');
    srv.serializeAttachment({ p, s: 0, n: 0 });
    this.ctx.acceptWebSocket(srv);
    srv.send('!soy ' + p);
    if (p > 1) this.manda(host, '!entra ' + p);
    return new Response(null, { status: 101, webSocket: cli });
  }
  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > LARGO) return;
    const a = ws.deserializeAttachment() || {}, s = Math.floor(Date.now() / 1000);
    if (a.s !== s) { a.s = s; a.n = 0; }
    if (++a.n > POR_SEG) return;
    ws.serializeAttachment(a);
    if (a.p === 1) {
      const k = msg.indexOf('|'); if (k < 1) return;
      const d = msg.slice(0, k), t = msg.slice(k + 1);
      if (d === '*') { for (const x of this.socks()) if (x.a.p > 1) this.manda(x.w, t); }
      else { const w = this.de(+d); if (w) this.manda(w, t); }
    } else if (a.p > 1) {
      const h = this.de(1); if (h) this.manda(h, a.p + '|' + msg);
    }
  }
  async webSocketClose(ws) { this.fuera(ws); try { ws.close(1000, 'adios'); } catch (e) {} }
  async webSocketError(ws) { this.fuera(ws); }
  fuera(ws) {
    const a = ws.deserializeAttachment() || {};
    if (a.p === 1) { for (const x of this.socks()) if (x.w !== ws && x.a.p > 1) { this.manda(x.w, '!fin'); try { x.w.close(1000, 'fin'); } catch (e) {} } }
    else if (a.p > 1) { const h = this.de(1); if (h && h !== ws) this.manda(h, '!sale ' + a.p); }
    try { ws.serializeAttachment({}); } catch (e) {}
  }
}
