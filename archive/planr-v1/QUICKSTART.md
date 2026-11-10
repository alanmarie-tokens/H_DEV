# Guide de Démarrage Rapide

## Installation en 3 étapes

### 1. Installer les dépendances
```bash
npm install
```

### 2. Initialiser la base de données
```bash
npm run init-db
```

### 3. Démarrer l'application
```bash
npm start
```

L'application est maintenant accessible sur **http://localhost:3000**

---

## Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur |
| `npm run dev` | Démarre en mode développement |
| `npm run init-db` | (Ré)initialise la base de données |

---

## Fichiers Importants

| Fichier | Description |
|---------|-------------|
| `index.html` | Interface utilisateur (Gantt) |
| `server.js` | Serveur backend avec API |
| `planning.db` | Base de données SQLite (créée après init-db) |
| `package.json` | Configuration et dépendances |
| `scripts/init-db.js` | Script d'initialisation de la DB |

---

## API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/planning` | GET | Récupère les données |
| `/api/planning` | POST | Sauvegarde les données |
| `/api/planning/export` | GET | Exporte en JSON |
| `/api/health` | GET | Vérifie l'état du serveur |

---

## Accès Web sans Rendre le Repo Public

### Option 1 : Hébergement Cloud (Recommandé)
- **Render.com** - Gratuit pour démarrer, supporte repos privés
- **Railway.app** - Simple, supporte repos privés
- **Fly.io** - Gratuit tier, flexible

### Option 2 : Tunnel Local (Test/Demo)
```bash
# Installer ngrok
npm install -g ngrok

# Dans un terminal
npm start

# Dans un autre terminal
ngrok http 3000
```

### Option 3 : VPS Personnel
Déployez sur votre serveur avec nginx/Apache en reverse proxy.

---

## Dépannage Rapide

### Le serveur ne démarre pas
```bash
# Vérifier si le port 3000 est libre
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Ou utiliser un autre port
PORT=8080 npm start
```

### Base de données vide
```bash
# Réinitialiser la base
npm run init-db
```

### Erreur de compilation better-sqlite3
```bash
# Réinstaller avec compilation
npm rebuild better-sqlite3

# Ou tout réinstaller
rm -rf node_modules
npm install
```

---

## Support

📖 Documentation complète : Voir `README.md`
📋 Détails d'implémentation : Voir `IMPLEMENTATION_SUMMARY.md`
🐛 Problèmes : Créer une issue GitHub
