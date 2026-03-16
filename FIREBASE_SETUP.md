# Guide de configuration Firebase — Synchronisation multi-utilisateurs

Ce guide explique comment activer la synchronisation en temps réel de votre planning Gantt entre plusieurs utilisateurs sur GitHub Pages.

## Vue d'ensemble

Sans configuration Firebase, l'application fonctionne en **mode local** : les données sont sauvegardées dans le `localStorage` du navigateur. Chaque utilisateur voit sa propre copie des données.

Avec Firebase Realtime Database, toutes les modifications sont **synchronisées instantanément** entre tous les utilisateurs ouverts sur la même page.

---

## Étape 1 — Créer un projet Firebase

1. Rendez-vous sur [https://console.firebase.google.com](https://console.firebase.google.com)
2. Cliquez sur **"Créer un projet"**
3. Donnez un nom à votre projet (ex: `gantt-planning`)
4. Désactivez Google Analytics si non nécessaire
5. Cliquez sur **"Créer le projet"**

---

## Étape 2 — Activer Realtime Database

1. Dans la console Firebase, allez dans **"Créer"** → **"Realtime Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez la région **`europe-west1`** (Belgique) pour des performances optimales en Europe
4. Démarrez en **mode test** (accès ouvert pendant 30 jours, idéal pour débuter)
5. Cliquez sur **"Activer"**

---

## Étape 3 — Configurer les règles de sécurité

Dans la console Firebase → **Realtime Database** → onglet **"Règles"**, définissez :

### Règles recommandées (accès ouvert à votre équipe) :
```json
{
  "rules": {
    "planning": {
      ".read": true,
      ".write": true
    }
  }
}
```

> ⚠️ Ces règles permettent un accès public en lecture/écriture. Elles sont adaptées à un usage en équipe interne. Pour restreindre l'accès, consultez la [documentation Firebase Authentication](https://firebase.google.com/docs/auth).

Cliquez sur **"Publier"** pour appliquer les règles.

---

## Étape 4 — Récupérer la configuration de votre application

1. Dans la console Firebase, cliquez sur l'icône ⚙️ (Paramètres du projet)
2. Allez dans **"Général"** → section **"Vos applications"**
3. Cliquez sur **"Ajouter une application"** → icône **Web** (`</>`)
4. Donnez un surnom à l'application (ex: `gantt-web`)
5. **Ne cochez pas** "Firebase Hosting" (vous utilisez GitHub Pages)
6. Cliquez sur **"Enregistrer l'application"**
7. Copiez le bloc de configuration affiché (ressemble à ceci) :

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## Étape 5 — Configurer `index.html`

1. Ouvrez `index.html` dans un éditeur de texte
2. Trouvez la section `FIREBASE_CONFIG` (cherchez le commentaire `CONFIGURATION FIREBASE`)
3. Remplacez les valeurs vides par celles copiées à l'étape précédente :

```javascript
const FIREBASE_CONFIG = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    databaseURL:       "https://YOUR_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:         "YOUR_PROJECT",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};
```

4. Committez et poussez les modifications sur `main` → GitHub Actions déploiera automatiquement sur GitHub Pages.

---

## Fonctionnement de la synchronisation

| Scénario | Comportement |
|----------|-------------|
| Un utilisateur sauvegarde | Les données sont envoyées à Firebase ET au localStorage local |
| Un autre utilisateur a la page ouverte | Il reçoit la mise à jour en **temps réel** et le planning se rafraîchit automatiquement |
| Firebase est indisponible (réseau coupé) | L'app continue à fonctionner en mode local (localStorage) |
| Pas de configuration Firebase | L'app fonctionne uniquement en localStorage (comportement d'origine) |

### Indicateur de synchronisation (en-tête)

Un badge dans la barre d'en-tête indique l'état de la connexion :

| Badge | Signification |
|-------|--------------|
| ⏳ Connexion… | Connexion à Firebase en cours |
| 📡 Connecté | Connecté à Firebase, en attente de modifications |
| ✅ Synchronisé | Dernière sauvegarde synchronisée avec succès |
| 🔴 Hors ligne | Pas de connexion réseau |
| ⚠️ Erreur sync | Problème lors de la synchronisation |

---

## Utilisation de plusieurs plannings

Si vous souhaitez avoir plusieurs plannings indépendants dans le même projet Firebase, modifiez la variable `DB_PLANNING_PATH` dans `index.html` :

```javascript
// Exemple : un planning par équipe
const DB_PLANNING_PATH = 'planning_equipe_a';  // ou 'planning_equipe_b', etc.
```

---

## Limites du forfait gratuit Firebase (Spark)

Le forfait gratuit est largement suffisant pour un usage d'équipe :

| Ressource | Limite gratuite |
|-----------|----------------|
| Stockage | 1 GB |
| Transfert de données | 10 GB/mois |
| Connexions simultanées | 100 |
| Opérations par seconde | 1 écriture/s par chemin |

> Pour une équipe de 2 à 20 utilisateurs, le forfait gratuit ne sera jamais dépassé.

---

## Dépannage

### Les données ne se synchronisent pas

1. Vérifiez que `databaseURL` est correctement renseigné dans `FIREBASE_CONFIG`
2. Vérifiez les règles de sécurité dans la console Firebase
3. Ouvrez la console du navigateur (F12) pour voir les erreurs Firebase

### Erreur "Firebase: No Firebase App '[DEFAULT]' has been created"

- La configuration Firebase est invalide ou incomplète
- Vérifiez que tous les champs de `FIREBASE_CONFIG` sont renseignés

### Erreur "PERMISSION_DENIED" — Les utilisateurs peuvent voir mais pas sauvegarder

**Symptômes :**
- ✅ Les utilisateurs voient les modifications en temps réel
- ❌ Les utilisateurs ne peuvent pas sauvegarder leurs propres modifications
- Console web affiche : `PERMISSION_DENIED` ou `permission denied`
- Message toast : `⚠️ Sauvegarde locale OK — Firebase en lecture seule (vérifiez les permissions)`

**Causes possibles :**

1. **Mode test expiré** (30 jours après activation)
   - Firebase Realtime Database démarre en mode test avec accès ouvert pendant 30 jours
   - Après expiration, les règles passent automatiquement en mode restreint (lecture seule ou aucun accès)

2. **Règles de sécurité restrictives**
   - Les règles Firebase ont été modifiées pour interdire l'écriture
   - Les règles requièrent une authentification qui n'est pas implémentée

3. **Quotas Firebase dépassés** (rare en usage normal)
   - Le forfait gratuit a atteint ses limites

**Solutions :**

#### Option 1 : Mettre à jour les règles de sécurité (accès ouvert pour équipe interne)

1. Ouvrez [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez dans **Realtime Database** → onglet **Règles**
4. Remplacez par ces règles (accès ouvert en lecture/écriture) :

```json
{
  "rules": {
    "planning": {
      ".read": true,
      ".write": true
    }
  }
}
```

5. Cliquez sur **Publier**
6. Rechargez l'application web (F5) et testez la sauvegarde

> ⚠️ **Attention :** Ces règles permettent un accès public. Elles sont adaptées pour une équipe interne ou un usage privé. Ne les utilisez pas si votre application est publique.

#### Option 2 : Règles temporaires pour le développement (mode test prolongé)

Si vous êtes encore en phase de développement, vous pouvez prolonger le mode test :

```json
{
  "rules": {
    ".read": "now < 1735689600000",  // Remplacez par un timestamp futur (ex: +90 jours)
    ".write": "now < 1735689600000"
  }
}
```

Pour calculer un timestamp futur :
- Ouvrez la console du navigateur (F12)
- Tapez : `new Date('2026-12-31').getTime()` (remplacez la date)
- Copiez le nombre obtenu dans les règles

#### Option 3 : Implémenter Firebase Authentication (production sécurisée)

Pour une application en production avec contrôle d'accès :

1. Activez **Firebase Authentication** dans la console Firebase
2. Configurez un fournisseur d'authentification (Google, Email/Password, etc.)
3. Modifiez les règles pour autoriser uniquement les utilisateurs authentifiés :

```json
{
  "rules": {
    "planning": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

4. Ajoutez le code d'authentification dans `index.html` (voir [documentation Firebase Auth](https://firebase.google.com/docs/auth/web/start))

**Vérification après correction :**

1. Ouvrez la console du navigateur (F12) → onglet **Console**
2. Effectuez une modification dans le planning
3. Sauvegardez (Ctrl+S ou bouton "💾 Sauvegarder")
4. Vérifiez les messages dans la console :
   - ✅ Succès : `✅ [Firebase] Données synchronisées avec succès`
   - ❌ Échec : `🚫 [Firebase] PERMISSION REFUSÉE` (voir les détails dans la console)

**Diagnostic automatique :**

L'application affiche maintenant des messages détaillés dans la console web pour diagnostiquer les problèmes de permissions Firebase. En cas d'erreur PERMISSION_DENIED, vous verrez :
- Le code d'erreur exact
- Les causes possibles
- L'URL directe vers les règles Firebase de votre projet
- Les actions recommandées
