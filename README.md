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

## Scène de test

La ville de test est faite de sites de 4 à 16 bâtiments posés sur un
terrain. Chaque bâtiment est généré à partir de plans d'étage en cellules
rectangulaires adjacentes (pièces, couloirs, escaliers, gaines d'ascenseur) :

- trois typologies : barre à couloir central, plan en L, tour à noyau central
  et couloir en anneau ;
- noyaux (escalier, ascenseurs, gaine technique, sanitaires) alignés sur tous
  les étages ; second escalier dans les longues barres et les tours hautes ;
- un mur par arête partagée entre deux cellules, aucun entre deux couloirs ;
- portes choisies pour que chaque cellule soit accessible depuis un couloir ;
- façades avec fenêtres, entrées au rez-de-chaussée en bout de couloir ;
- dalles ouvertes dans les trémies, escaliers à deux volées, toiture ;
- cloisonnement des pièces qui change tous les quelques étages.

## Pourquoi c'est rapide

- **Un objet = 36 octets.** Chaque mur, dalle ou espace est une boîte orientée
  (centre, demi-dimensions, rotation, couleur, étage). Les mêmes octets vont du
  worker au GPU sans conversion.
- **Rendu instancié.** Un seul cube unitaire, étiré par le vertex shader.
- **Découpage en blocs.** Les objets sont triés par bâtiment et par étage,
  puis regroupés en blocs ; le
  CPU ne manipule que ces blocs à chaque image (élimination hors champ, tri
  avant → arrière), jamais les objets un par un : un appel de dessin par bloc
  visible.
- **Rendu à la demande.** Aucune image n'est calculée tant que rien ne change.
- **Préparation hors du fil principal.** Génération, import et tri se font
  dans un Web Worker ; les tampons sont transférés, pas copiés.
- **Sélection par GPU.** Le clic rend les identifiants dans une cible de
  1 × 1 pixel avec une projection resserrée sur ce pixel.

## Sites, bâtiments, étages, pièces

Toute la scène suit la même structure : **Site › Bâtiment › Étage › Pièce**.
Chaque objet appartient à un étage ; une pièce est un espace.

- **Arborescence** (panneau de droite) : cliquer sur un site, un bâtiment ou
  un étage n'affiche que lui et le cadre ; cliquer sur une pièce la
  sélectionne dans son étage.
- **Périmètre affiché** : fil d'Ariane, nombre de bâtiments, d'étages et de
  pièces, surface des pièces, et boutons pour changer d'étage (ou Page
  préc. / Page suiv.).
- **Sélection** : un objet indique son site, son bâtiment et son étage, avec
  un lien pour afficher chacun.

Les étages sont numérotés de sorte qu'un site, un bâtiment ou un étage soit
une plage continue d'identifiants, et les objets sont triés dans cet ordre.
Isoler un périmètre ne coûte donc rien : les blocs hors plage sont ignorés et
le shader écarte le reste.

## Importer ses données

Bouton « Importer JSON ». Coordonnées en mètres, plan `[x, y]`, altitude en Z.
Exemple complet : [`public/exemple.json`](public/exemple.json).

```json
{
  "sites": [{
    "name": "Campus",
    "buildings": [{
      "name": "Bâtiment A",
      "storeys": [{
        "name": "RDC", "elevation": 0, "height": 3,
        "walls":  [{ "start": [0, 0], "end": [12, 0], "elevation": 0.25, "height": 2.75, "thickness": 0.2 }],
        "slabs":  [{ "min": [0, 0], "max": [12, 8], "elevation": 0, "thickness": 0.25 }],
        "spaces": [{ "name": "Accueil", "min": [0.2, 0.2], "max": [5.9, 7.8], "elevation": 0.25, "height": 2.6 }]
      }]
    }]
  }]
}
```

- Dans un étage, les altitudes des objets sont relatives à celle de l'étage.
- `rotation` (dalles, espaces) est en degrés autour du centre ; `color`
  (`"#rrggbb"`) est facultatif.
- Formes abrégées acceptées : `buildings` ou `storeys` à la racine, ou
  directement `walls` / `slabs` / `spaces` (un seul site, bâtiment et étage).

Limite actuelle : dalles et espaces sont rectangulaires (pas de contour
polygonal ni d'ouvertures dans les murs importés).

## Structure

| Fichier | Rôle |
| --- | --- |
| `src/scene.ts` | Format des objets, structure site › bâtiment › étage, découpage en blocs |
| `src/navigator.ts` | Arborescence de la structure |
| `src/renderer.ts` | Rendu WebGL2, élimination hors champ, sélection |
| `src/camera.ts`, `src/controls.ts` | Caméra orbitale, souris et tactile |
| `src/generator.ts` | Ville procédurale de test (plans d'étage, murs, portes, escaliers) |
| `src/importer.ts` | Import JSON |
| `src/worker.ts` | Préparation de la scène hors du fil principal |
| `src/main.ts` | Interface |

## Archive

L'ancien projet (planning Gantt « Planr ») est conservé dans
[`archive/planr-v1/`](archive/planr-v1/).
