# H_DEV — Visionneuse 3D haute performance

Application web de visualisation 3D de **murs**, **dalles** et **espaces**,
conçue pour afficher un très grand nombre d'objets simultanément (jusqu'à
plusieurs millions). Moteur WebGL2 sur mesure, sans dépendance à l'exécution.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm run build    # vérification TypeScript + build de production dans dist/
```

Le paramètre d'URL `?n=2000000` choisit le nombre d'objets de la scène de test.

## Navigation

- **Orbite** (par défaut) : glisser pour tourner, Maj ou clic droit + glisser
  pour déplacer, molette ou pincement pour zoomer.
- **Mode vol** (touche F) : glisser pour regarder autour de soi, molette pour
  avancer.
- **Clavier**, dans les deux modes : ZQSD (WASD) ou flèches pour avancer,
  reculer et glisser ; E / A pour monter et descendre ; Maj pour aller 4 fois
  plus vite. Les touches sont lues par position physique.

## Pourquoi c'est rapide

- **Un objet = 32 octets.** Chaque mur, dalle ou espace est une boîte orientée
  (centre, demi-dimensions, rotation, couleur). Les mêmes octets vont du
  worker au GPU sans conversion.
- **Rendu instancié.** Un seul cube unitaire, étiré par le vertex shader.
- **Découpage spatial.** Les objets sont triés en blocs sur une grille ; le
  CPU ne manipule que ces blocs à chaque image (élimination hors champ, tri
  avant → arrière), jamais les objets un par un : un appel de dessin par bloc
  visible.
- **Rendu à la demande.** Aucune image n'est calculée tant que rien ne change.
- **Préparation hors du fil principal.** Génération, import et tri se font
  dans un Web Worker ; les tampons sont transférés, pas copiés.
- **Sélection par GPU.** Le clic rend les identifiants dans une cible de
  1 × 1 pixel avec une projection resserrée sur ce pixel.

## Importer ses données

Bouton « Importer JSON ». Coordonnées en mètres, plan `[x, y]`, altitude en Z.
Exemple complet : [`public/exemple.json`](public/exemple.json).

```json
{
  "walls":  [{ "start": [0, 0], "end": [12, 0], "elevation": 0, "height": 3, "thickness": 0.2, "color": "#d6d0c6" }],
  "slabs":  [{ "min": [0, 0], "max": [12, 8], "elevation": 0, "thickness": 0.25, "rotation": 0 }],
  "spaces": [{ "min": [0.2, 0.2], "max": [5.9, 7.8], "elevation": 0.25, "height": 2.6, "color": "#4f9dff" }]
}
```

`rotation` est en degrés autour du centre du rectangle ; `color` est facultatif.

Limite actuelle : dalles et espaces sont rectangulaires (pas de contour
polygonal ni d'ouvertures dans les murs).

## Structure

| Fichier | Rôle |
| --- | --- |
| `src/scene.ts` | Format des objets, découpage en blocs |
| `src/renderer.ts` | Rendu WebGL2, élimination hors champ, sélection |
| `src/camera.ts`, `src/controls.ts` | Caméra orbitale, souris et tactile |
| `src/generator.ts` | Ville procédurale de test |
| `src/importer.ts` | Import JSON |
| `src/worker.ts` | Préparation de la scène hors du fil principal |
| `src/main.ts` | Interface |

## Archive

L'ancien projet (planning Gantt « Planr ») est conservé dans
[`archive/planr-v1/`](archive/planr-v1/).
