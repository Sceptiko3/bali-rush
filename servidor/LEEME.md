# Bali Rush · servidor del modo online

Un Worker de Cloudflare con un Durable Object por sala (`src/index.js`). Solo reenvía mensajes entre los móviles de una sala; no guarda nada.

- Lo despliega Cloudflare desde GitHub (Workers Builds): repositorio `Sceptiko3/bali-rush`, carpeta raíz `servidor`, orden `npx wrangler deploy`. Cada `git push` a `main` que toque esta carpeta lo vuelve a desplegar.
- El nombre del Worker tiene que ser `bali-rush-online` (el de `wrangler.jsonc`).
- Su dirección queda en `https://bali-rush-online.<subdominio>.workers.dev`; abrirla dice «Bali Rush online: funcionando». Esa dirección va en el juego: `RON.url` (`fuentes/nucleo/616_online.js`).
- Plan gratis: 100.000 peticiones al día en los Durable Objects (cada 20 mensajes que llegan cuentan como una); una carrera de 6 son unos 110 mensajes por segundo, o sea ~5 horas de carreras de 6 al día, mucho más con menos jugadores.
- Probar en local: `npm i -g wrangler` y `wrangler dev --local --port 8787` aquí dentro; el juego con `RON.url = 'http://127.0.0.1:8787'` (`node pruebas/online.js`).
