# Checklist de Déploiement

## ✅ Pré-déploiement

- [ ] Node.js version 14+ installé sur le serveur cible
- [ ] Accès SSH/terminal au serveur
- [ ] Port 3000 disponible (ou autre port configuré)
- [ ] Sauvegarde des données localStorage existantes (Export JSON si applicable)

## 📦 Installation

- [ ] Cloner le repository sur le serveur
  ```bash
  git clone <url-du-repo>
  cd H_DEV
  ```

- [ ] Installer les dépendances
  ```bash
  npm install
  ```

- [ ] Initialiser la base de données
  ```bash
  npm run init-db
  ```

- [ ] Vérifier que `planning.db` a été créé
  ```bash
  ls -lh planning.db
  ```

## 🔧 Configuration

- [ ] Définir le port si différent de 3000
  ```bash
  export PORT=8080  # ou autre
  ```

- [ ] Configurer les variables d'environnement si nécessaire
  ```bash
  # Créer un fichier .env si besoin
  echo "PORT=3000" > .env
  ```

## 🚀 Démarrage

- [ ] Tester le démarrage manuel
  ```bash
  npm start
  ```

- [ ] Vérifier l'accès local
  ```bash
  curl http://localhost:3000/api/health
  ```

- [ ] Accéder à l'interface web
  - Ouvrir http://localhost:3000 dans le navigateur

## 🔒 Sécurité

- [ ] Configurer un reverse proxy (nginx/Apache)
  - Exemple nginx :
    ```nginx
    server {
        listen 80;
        server_name planning.votredomaine.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

- [ ] Installer un certificat SSL (Let's Encrypt)
  ```bash
  sudo certbot --nginx -d planning.votredomaine.com
  ```

- [ ] Configurer le firewall
  ```bash
  # Autoriser HTTP/HTTPS
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  ```

- [ ] Restreindre CORS si nécessaire (modifier server.js)

- [ ] Ajouter l'authentification si accès public (à implémenter)

## 🔄 Persistance et Process Management

- [ ] Installer PM2 pour gérer le processus
  ```bash
  npm install -g pm2
  ```

- [ ] Démarrer avec PM2
  ```bash
  pm2 start server.js --name planning-gantt
  pm2 save
  pm2 startup
  ```

- [ ] Vérifier que PM2 redémarre automatiquement
  ```bash
  pm2 list
  ```

## 💾 Backups

- [ ] Créer un dossier de backups
  ```bash
  mkdir -p backups
  ```

- [ ] Configurer une tâche cron pour backup quotidien
  ```bash
  crontab -e
  # Ajouter :
  0 2 * * * cp /chemin/vers/H_DEV/planning.db /chemin/vers/H_DEV/backups/planning-$(date +\%Y\%m\%d).db
  ```

- [ ] Tester le backup manuel
  ```bash
  cp planning.db backups/planning-test.db
  ```

- [ ] Configurer la rotation des backups (garder 30 jours)
  ```bash
  # Dans crontab :
  0 3 * * * find /chemin/vers/backups -name "planning-*.db" -mtime +30 -delete
  ```

## 📊 Monitoring

- [ ] Configurer les logs
  ```bash
  pm2 logs planning-gantt
  ```

- [ ] Monitorer les ressources
  ```bash
  pm2 monit
  ```

- [ ] Configurer des alertes (optionnel)

## ✅ Tests Post-déploiement

- [ ] Accéder à l'URL publique
- [ ] Créer une nouvelle tâche
- [ ] Vérifier que la tâche est sauvegardée (rafraîchir la page)
- [ ] Tester l'export JSON
- [ ] Tester l'import JSON
- [ ] Vérifier depuis un autre appareil/réseau
- [ ] Tester les performances avec plusieurs utilisateurs

## 🔍 Vérifications de Santé

- [ ] API health check
  ```bash
  curl https://votre-domaine.com/api/health
  ```

- [ ] Vérifier la taille de la base
  ```bash
  ls -lh planning.db
  ```

- [ ] Vérifier l'utilisation mémoire de Node.js
  ```bash
  pm2 monit
  # ou
  top -p $(pgrep node)
  ```

- [ ] Vérifier les logs d'erreurs
  ```bash
  pm2 logs planning-gantt --err
  ```

## 📝 Documentation pour l'Équipe

- [ ] Partager l'URL d'accès
- [ ] Partager les credentials si authentification ajoutée
- [ ] Documenter le processus de backup/restore
- [ ] Créer un guide utilisateur si nécessaire

## 🚨 Plan de Récupération

- [ ] Documenter la procédure de restauration depuis backup
  ```bash
  # Arrêter le serveur
  pm2 stop planning-gantt

  # Restaurer la DB
  cp backups/planning-YYYYMMDD.db planning.db

  # Redémarrer
  pm2 start planning-gantt
  ```

- [ ] Tester la restauration une fois

- [ ] Définir un RTO (Recovery Time Objective)

- [ ] Définir un RPO (Recovery Point Objective)

## 🎯 Optimisations (Optionnel)

- [ ] Activer la compression gzip (nginx)
- [ ] Configurer le cache HTTP (nginx)
- [ ] Optimiser les requêtes API si lenteur
- [ ] Monitorer et optimiser SQLite si nécessaire

## ✔️ Déploiement Terminé

Date de déploiement : _______________

Déployé par : _______________

URL de production : _______________

Notes spécifiques :

_______________________________________________

_______________________________________________

_______________________________________________
