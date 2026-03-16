# Configuration GitHub Pages

Ce document explique comment finaliser le déploiement de l'application sur GitHub Pages.

## Étape 1 : Rendre le dépôt public (si nécessaire)

Pour utiliser GitHub Pages gratuitement, le dépôt doit être public.

1. Allez sur https://github.com/Nilujien/H_DEV
2. Cliquez sur **Settings** (Paramètres)
3. Faites défiler jusqu'à la section **Danger Zone**
4. Cliquez sur **Change repository visibility**
5. Sélectionnez **Make public**
6. Confirmez en tapant le nom du dépôt : `Nilujien/H_DEV`

## Étape 2 : Activer GitHub Pages

1. Dans **Settings**, allez dans la section **Pages** (menu de gauche)
2. Sous **Source**, sélectionnez **GitHub Actions**
3. Le workflow `.github/workflows/deploy.yml` sera automatiquement détecté

## Étape 3 : Déclencher le déploiement

Le déploiement peut être déclenché de deux façons :

### Option A : Push sur la branche main

Lorsque cette branche sera mergée dans `main`, le workflow se déclenchera automatiquement.

### Option B : Déclenchement manuel

1. Allez dans l'onglet **Actions**
2. Sélectionnez le workflow **Deploy to GitHub Pages**
3. Cliquez sur **Run workflow**
4. Sélectionnez la branche `main`
5. Cliquez sur **Run workflow**

## Étape 4 : Vérifier le déploiement

1. Une fois le workflow terminé (icône verte ✅), votre application sera disponible
2. L'URL sera : **https://nilujien.github.io/H_DEV/**
3. Vous pouvez trouver l'URL exacte dans **Settings > Pages**

## Notes importantes

- Le déploiement prend généralement 1-2 minutes
- Chaque push sur `main` déclenchera un nouveau déploiement automatique
- L'application utilise localStorage, donc toutes les données sont stockées dans le navigateur
- Pas besoin de serveur backend : tout fonctionne en statique

## Dépannage

### Le workflow échoue

- Vérifiez que vous avez bien activé GitHub Pages dans Settings > Pages
- Vérifiez que le workflow a les bonnes permissions (elles sont configurées dans deploy.yml)

### La page affiche une erreur 404

- Attendez quelques minutes après le premier déploiement
- Videz le cache de votre navigateur
- Vérifiez que le déploiement est bien terminé dans l'onglet Actions

### Les données ne se sauvegardent pas

- Vérifiez que localStorage est activé dans votre navigateur
- Vérifiez que vous n'êtes pas en mode navigation privée
- Consultez la console JavaScript pour voir les erreurs éventuelles
