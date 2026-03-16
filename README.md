# Planning Gantt - Application Web

Application de planification Gantt accessible via le web avec stockage localStorage.

## 📋 Description

Cette application de planning Gantt permet de :
- Créer et gérer des tâches dans un diagramme de Gantt interactif
- Organiser les tâches par groupes et métiers
- Suivre l'avancement, les coûts et les ressources (ETP)
- Exporter/importer des plannings au format JSON
- Stocker les données de manière persistante dans le navigateur (localStorage)

## 🌐 Accès GitHub Pages

L'application est déployée et accessible directement via GitHub Pages :

**URL : [https://nilujien.github.io/H_DEV/](https://nilujien.github.io/H_DEV/)**

Aucune installation n'est nécessaire ! L'application fonctionne entièrement dans votre navigateur avec stockage local des données.

### Caractéristiques du déploiement GitHub Pages

- ✅ Application statique (HTML/CSS/JavaScript)
- ✅ Stockage des données dans le navigateur (localStorage)
- ✅ Aucun serveur backend requis
- ✅ Déploiement automatique via GitHub Actions
- ✅ Accessible publiquement

## 🚀 Installation et Démarrage (Développement Local)

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
├── index.html              # Interface utilisateur de l'application (statique)
├── .github/
│   └── workflows/
│       └── deploy.yml     # Workflow GitHub Actions pour déploiement
├── server.js               # Serveur Express (optionnel, pour dev local)
├── package.json            # Dépendances pour développement local
├── scripts/
│   └── init-db.js         # Script d'initialisation (optionnel)
└── .gitignore             # Fichiers à ignorer par Git
```

## 💾 Stockage des Données

### LocalStorage (navigateur)

Les données sont stockées localement dans votre navigateur via l'API localStorage :

- Toutes les modifications sont automatiquement sauvegardées
- Les données persistent même après fermeture du navigateur
- Chaque navigateur a son propre stockage (les données ne sont pas partagées entre navigateurs)
- Capacité : environ 5-10 MB (suffisant pour des plannings complexes)

### Sauvegarde automatique

L'application sauvegarde automatiquement toutes les modifications dans localStorage après un délai de 400ms (debounced).

### Export/Import

Pour sauvegarder vos données ou les transférer :
1. Utilisez le bouton "Export JSON" pour télécharger vos données
2. Utilisez le bouton "Import JSON" pour charger des données sauvegardées

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

## ⚠️ Notes Importantes

### 1. Stockage Local

**Impact** : L'application utilise localStorage du navigateur pour stocker les données.

**Conséquences** :
- Les données sont stockées uniquement dans votre navigateur
- Chaque navigateur/appareil a son propre stockage indépendant
- Si vous videz le cache/localStorage du navigateur, vous perdez vos données
- **Important** : Utilisez la fonction "Export JSON" régulièrement pour sauvegarder vos plannings

### 2. Sauvegarde et backup

**Impact** : Les données sont dans le navigateur uniquement.

**Recommandations** :
- Exportez régulièrement vos plannings (bouton "Export JSON")
- Sauvegardez les fichiers JSON exportés dans un endroit sûr
- Pour partager un planning : exportez le JSON et envoyez le fichier à vos collaborateurs
- Pour transférer vers un autre navigateur/appareil : exportez puis importez le JSON

### 3. Capacité de stockage

**Impact** : localStorage a une limite de ~5-10 MB selon les navigateurs.

**Conséquences** :
- Suffisant pour des plannings complexes avec des centaines de tâches
- Si vous atteignez la limite, l'application affichera une erreur
- Solution : exportez et archivez les anciens plannings, puis créez-en de nouveaux

### 4. Compatibilité navigateur

**Impact** : L'application utilise des fonctionnalités JavaScript modernes.

**Recommandations** :
- Utilisez un navigateur récent (Chrome, Firefox, Safari, Edge)
- Activez JavaScript
- Autorisez le localStorage pour le site

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
