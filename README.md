# Planning Gantt - Application Web

Application de planification Gantt accessible via le web avec stockage SQLite persistant.

## 📋 Description

Cette application de planning Gantt permet de :
- Créer et gérer des tâches dans un diagramme de Gantt interactif
- Organiser les tâches par groupes et métiers
- Suivre l'avancement, les coûts et les ressources (ETP)
- Exporter/importer des plannings au format JSON
- Stocker les données de manière persistante dans une base SQLite

## 🚀 Installation et Démarrage

### Prérequis

- Node.js (version 14 ou supérieure)
- npm (généralement installé avec Node.js)

### Étapes d'installation

1. **Installer les dépendances**
   ```bash
   npm install
   ```

2. **Initialiser la base de données**
   ```bash
   npm run init-db
   ```

   Cette commande va :
   - Créer le fichier `planning.db` (base SQLite)
   - Créer les tables nécessaires
   - Charger les données initiales depuis `planning_2026-03-14.json`

3. **Démarrer le serveur**
   ```bash
   npm start
   ```

   Le serveur démarre sur http://localhost:3000

4. **Accéder à l'application**

   Ouvrez votre navigateur et allez sur http://localhost:3000

## 📁 Structure du Projet

```
H_DEV/
├── index.html              # Interface utilisateur de l'application
├── server.js               # Serveur Express avec API REST
├── package.json            # Dépendances et scripts npm
├── scripts/
│   └── init-db.js         # Script d'initialisation de la base de données
├── planning.db            # Base de données SQLite (créée après init-db)
├── planning_2026-03-14.json  # Données initiales
└── .gitignore             # Fichiers à ignorer par Git
```

## 🔌 API Endpoints

L'application expose les endpoints suivants :

- **GET /api/planning** - Récupère toutes les données de planning
- **POST /api/planning** - Sauvegarde l'état complet du planning
- **GET /api/planning/export** - Exporte le planning au format JSON
- **GET /api/health** - Vérifie l'état du serveur

## 💾 Stockage des Données

### Base de données SQLite

Les données sont stockées dans `planning.db` avec les tables suivantes :

- **planning_state** - État global (zoom, vue, compteurs)
- **groups** - Groupes de tâches
- **rows** - Lignes du planning
- **tasks** - Tâches individuelles
- **task_objectives** - Objectifs des tâches
- **task_deps** - Dépendances entre tâches
- **milestones** - Jalons

### Sauvegarde automatique

L'application sauvegarde automatiquement toutes les modifications dans la base de données après un délai de 400ms (debounced).

## 🌐 Accès Web sans Rendre le Dépôt Public

Pour rendre l'application accessible depuis le web sans rendre le dépôt public, plusieurs options sont disponibles :

### Option 1 : Déploiement sur un serveur privé

Déployez l'application sur votre propre serveur (VPS, serveur dédié, etc.) :

```bash
# Sur le serveur
git clone <votre-repo-privé>
cd H_DEV
npm install
npm run init-db
npm start
```

Configurez un reverse proxy (nginx, Apache) pour exposer l'application.

### Option 2 : Services d'hébergement avec dépôts privés

- **Heroku** : Supporte les dépôts GitHub privés
- **Render** : Supporte les dépôts privés
- **Railway** : Supporte les dépôts privés
- **Fly.io** : Supporte les dépôts privés

### Option 3 : Tunnel local (développement/démo)

Pour partager temporairement :

```bash
# Installer ngrok
npm install -g ngrok

# Démarrer l'application
npm start

# Dans un autre terminal, créer un tunnel
ngrok http 3000
```

## ⚠️ Effets de Bord Identifiés

### 1. Migration de localStorage vers API

**Impact** : L'application utilisait auparavant `localStorage` du navigateur pour stocker les données. Maintenant elle utilise une API REST avec SQLite.

**Conséquences** :
- Les données stockées précédemment dans `localStorage` ne seront PAS automatiquement migrées
- Si vous aviez des données dans `localStorage`, utilisez la fonction "Export" pour les sauvegarder avant de passer à la nouvelle version
- Après migration, utilisez "Import" pour charger les anciennes données

### 2. Base de données SQLite

**Impact** : La base de données est un fichier local sur le serveur.

**Conséquences** :
- Les données sont persistantes mais liées au serveur spécifique
- En cas de déploiement multi-instances, chaque instance aura sa propre base
- Pour un environnement de production avec plusieurs instances, il faudrait migrer vers une base de données centralisée (PostgreSQL, MySQL)

### 3. Concurrence

**Impact** : L'application utilise des transactions SQLite pour les écritures.

**Conséquences** :
- SQLite supporte un seul écrivain à la fois
- Pour un usage avec beaucoup d'utilisateurs simultanés, considérez une base relationnelle (PostgreSQL)
- L'application actuelle est optimale pour 1-10 utilisateurs simultanés

### 4. Sauvegarde et backup

**Impact** : La base de données est dans un fichier `planning.db`.

**Recommandations** :
- Sauvegardez régulièrement le fichier `planning.db`
- Utilisez la fonction "Export JSON" pour créer des snapshots
- Le fichier `.db` est ignoré par Git (`.gitignore`), donc pas de backup automatique

### 5. Réseau et latence

**Impact** : Les données transitent maintenant via HTTP au lieu d'être locales.

**Conséquences** :
- Légère latence lors du chargement initial
- Dépendance à la connexion réseau
- Un indicateur de chargement a été ajouté pour améliorer l'expérience utilisateur

## 🔧 Configuration Avancée

### Changer le port du serveur

Par défaut, le serveur écoute sur le port 3000. Pour changer :

```bash
PORT=8080 npm start
```

Ou définir la variable d'environnement :

```bash
export PORT=8080
npm start
```

### Utiliser une base de données différente

Modifiez `server.js` et `scripts/init-db.js` pour pointer vers un autre fichier :

```javascript
const db = new Database('mon-planning.db');
```

## 📦 Export/Import de Données

### Exporter

1. Cliquez sur "↓ Export" dans l'interface
2. Un fichier JSON sera téléchargé avec toutes vos données

### Importer

1. Cliquez sur "↑ Import" dans l'interface
2. Sélectionnez un fichier JSON précédemment exporté
3. Les données seront chargées et sauvegardées dans la base

## 🛠️ Développement

### Mode développement

```bash
npm run dev
```

### Structure du code

- **Frontend** : Vanilla JavaScript dans `index.html` (section `<script>`)
- **Backend** : Express.js dans `server.js`
- **Base de données** : Better-sqlite3 (synchrone, performant)

## 📝 Notes Techniques

### Choix de Better-sqlite3

- **Synchrone** : Simplifie le code, pas de callbacks/promises pour les opérations DB
- **Performant** : Plus rapide que les bindings SQLite asynchrones
- **Transactions** : Support natif pour les transactions ACID
- **Sans dépendance native** : Compile lors de l'installation

### Sécurité

- Pas d'authentification par défaut (à ajouter selon les besoins)
- CORS activé pour permettre les requêtes cross-origin
- Utilisez un reverse proxy (nginx) avec HTTPS en production
- Considérez l'ajout d'authentification pour un usage en production

## 🐛 Dépannage

### La base de données est vide au démarrage

Exécutez à nouveau :
```bash
npm run init-db
```

### Erreur "Cannot find module 'better-sqlite3'"

Réinstallez les dépendances :
```bash
rm -rf node_modules
npm install
```

### Le serveur ne démarre pas

Vérifiez que le port 3000 n'est pas déjà utilisé :
```bash
lsof -i :3000  # Sur macOS/Linux
netstat -ano | findstr :3000  # Sur Windows
```

## 📄 Licence

ISC

## 👥 Support

Pour toute question ou problème, créez une issue dans le dépôt GitHub.
