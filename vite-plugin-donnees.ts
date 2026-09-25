import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Miroir sur disque des données saisies (prix, relevés, réglages).
 *
 * Le navigateur les garde dans `localStorage`, qui est lié à l'origine : changer
 * de port ou de navigateur les fait disparaître. Ce plugin expose, pendant
 * `npm run dev` et `npm run preview` uniquement, un point d'entrée qui lit et
 * écrit un fichier du projet — donc suivi par git, donc récupérable.
 *
 * Il n'existe pas dans un build statique : l'application retombe alors sur le
 * `localStorage` seul, et l'export/import manuel reste disponible.
 */
export { CHEMIN_DONNEES } from './src/lib/cheminDonnees.ts';
import { CHEMIN_DONNEES } from './src/lib/cheminDonnees.ts';
const ROUTE = '/__donnees';
const TAILLE_MAX = 8 * 1024 * 1024;

export function pluginDonnees(): Plugin {
  let fichier = '';

  const lire = () => {
    if (!existsSync(fichier)) return null;
    try {
      return JSON.parse(readFileSync(fichier, 'utf8')) as unknown;
    } catch {
      return null;
    }
  };

  const ecrire = (contenu: unknown) => {
    mkdirSync(path.dirname(fichier), { recursive: true });
    writeFileSync(fichier, JSON.stringify(contenu, null, 2), 'utf8');
  };

  const middleware: Plugin['configureServer'] = (server) => {
    fichier = path.resolve(server.config.root, CHEMIN_DONNEES);
    server.middlewares.use(ROUTE, (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.method === 'GET') {
        res.end(JSON.stringify(lire()));
        return;
      }
      if (req.method === 'POST') {
        let corps = '';
        let trop = false;
        req.on('data', (bout) => {
          corps += bout;
          if (corps.length > TAILLE_MAX) {
            trop = true;
            req.destroy();
          }
        });
        req.on('end', () => {
          if (trop) {
            res.statusCode = 413;
            res.end('{"ok":false}');
            return;
          }
          try {
            ecrire(JSON.parse(corps));
            res.end('{"ok":true}');
          } catch {
            res.statusCode = 400;
            res.end('{"ok":false}');
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end('{"ok":false}');
    });
  };

  return {
    name: 'brisage-donnees',
    apply: 'serve',
    configureServer: middleware,
    configurePreviewServer: middleware as unknown as Plugin['configurePreviewServer'],
  };
}
