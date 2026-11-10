# Planning Gantt - Application Web

Application de planification Gantt accessible via GitHub Pages avec synchronisation multi-utilisateurs en temps réel.

## 📋 Description

Cette application de planning Gantt permet de :
- Créer et gérer des tâches dans un diagramme de Gantt interactif
- Organiser les tâches par groupes et métiers
- Suivre l'avancement, les coûts et les ressources (ETP)
- Exporter/importer des plannings au format JSON
- **Synchroniser les données en temps réel entre plusieurs utilisateurs (via Firebase)**

## 🌐 Accès GitHub Pages

L'application est déployée et accessible directement via GitHub Pages :

**URL : [https://nilujien.github.io/H_DEV/](https://nilujien.github.io/H_DEV/)**

Aucune installation n'est nécessaire ! L'application fonctionne entièrement dans votre navigateur.

## 🚀 Fonctionnalités principales

- ✅ Application statique (HTML/CSS/JavaScript)
- ✅ **Synchronisation multi-utilisateurs en temps réel (Firebase Realtime Database)**
- ✅ Stockage de toutes les données dans Firebase
- ✅ Déploiement automatique via GitHub Actions
- ✅ Accessible publiquement

## 💾 Stockage des Données

### Firebase Realtime Database (REQUIS)

**Firebase Realtime Database est REQUIS** pour que l'application fonctionne. Toutes les données sont stockées dans Firebase :
- Données de planning (lignes, tâches, jalons)
- Préférences utilisateur (thème, configuration KPI)
- Synchronisation multi-utilisateurs en temps réel

**Important** : Utilisez "Export JSON" régulièrement pour sauvegarder vos plannings localement.

### Sauvegarde automatique

L'application sauvegarde automatiquement toutes les modifications dans Firebase après un délai de 400 ms (debounced).

## 🔄 Configuration Firebase

Pour activer l'application, suivez le guide **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**.

En résumé :
1. Créez un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activez **Realtime Database** (région Europe)
3. Configurez les règles de sécurité
4. Copiez la configuration Firebase dans la section `FIREBASE_CONFIG` de `index.html`
5. Committez et poussez → le déploiement est automatique

## 📦 Export/Import de Données

### Exporter

1. Cliquez sur "↓ Export" dans l'interface
2. Un fichier JSON sera téléchargé avec toutes vos données

### Importer

1. Cliquez sur "↑ Import" dans l'interface
2. Sélectionnez un fichier JSON précédemment exporté
3. Les données seront chargées et synchronisées dans Firebase

## 📁 Structure du Projet

```
H_DEV/
├── index.html              # Interface utilisateur (contient la config Firebase)
├── FIREBASE_SETUP.md       # Guide de configuration Firebase
├── .github/
│   └── workflows/
│       └── deploy.yml     # Workflow GitHub Actions pour déploiement
├── server.js               # Serveur Express (optionnel, pour dev local)
├── package.json            # Dépendances pour développement local
├── scripts/
│   └── init-db.js         # Script d'initialisation DB (optionnel)
└── .gitignore             # Fichiers à ignorer par Git
```

## 📋 Prérequis

- Utilisez un navigateur récent (Chrome, Firefox, Safari, Edge)
- Activez JavaScript
- Configurez Firebase Realtime Database (voir [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))

## 🛠️ Développement

### Mode développement local

```bash
npm install
npm start
```

Le serveur démarre sur http://localhost:3000

### Structure du code

- **Frontend** : Vanilla JavaScript dans `index.html` (section `<script>`)
- **Sync** : Firebase Realtime Database (SDK compat v10 chargé via CDN)
- **Stockage** : Toutes les données dans Firebase uniquement
- **Backend local** : Express.js dans `server.js` (optionnel, non utilisé en production)

## ⚠️ Notes Importantes

### 1. Stockage Firebase

**Impact** : L'application utilise Firebase Realtime Database pour stocker toutes les données.

**Conséquences** :
- Les données sont stockées dans le cloud Firebase
- Synchronisation automatique entre tous les utilisateurs
- Les données persistent tant que votre projet Firebase est actif
- **Important** : Utilisez la fonction "Export JSON" régulièrement pour sauvegarder vos plannings localement

### 2. Sauvegarde et backup

**Impact** : Les données sont dans Firebase.

**Recommandations** :
- Exportez régulièrement vos plannings (bouton "Export JSON")
- Sauvegardez les fichiers JSON exportés dans un endroit sûr
- Firebase conserve vos données même si tous les utilisateurs ferment leurs navigateurs

### 3. Capacité de stockage

**Impact** : Firebase Realtime Database (forfait gratuit) a une limite de 1 GB de stockage et 10 GB/mois de transfert.

**Conséquences** :
- Largement suffisant pour un usage d'équipe (2-20 utilisateurs)
- Pour des plannings très volumineux (milliers de tâches), surveillez votre usage dans la console Firebase

### 4. Compatibilité navigateur

**Impact** : L'application utilise des fonctionnalités JavaScript modernes.

**Recommandations** :
- Utilisez un navigateur récent (Chrome, Firefox, Safari, Edge)
- Activez JavaScript
- Connexion internet requise pour la synchronisation Firebase

## 🐛 Dépannage

### Les données ne se synchronisent pas entre utilisateurs

→ Firebase n'est peut-être pas configuré. Suivez [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

### Le badge "⚠️ Erreur sync" s'affiche

1. Vérifiez votre connexion internet
2. Vérifiez les règles de sécurité dans Firebase Console
3. Ouvrez la console du navigateur (F12) pour plus de détails

### L'application affiche "Firebase requis"

→ Firebase n'est pas configuré ou la configuration est incorrecte. Vérifiez la section `FIREBASE_CONFIG` dans `index.html` et assurez-vous que tous les champs sont remplis.

### Réinitialiser toutes les données

**Attention** : Cette opération est irréversible et supprimera toutes les données de Firebase.

Dans la console Firebase, supprimez manuellement les données du nœud `planning` de votre Realtime Database, ou exportez d'abord vos données puis supprimez-les.

## 📄 Licence

ISC

## 👥 Support

Pour toute question ou problème, créez une issue dans le dépôt GitHub.
