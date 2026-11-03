# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# Rappels push URTT TCG

Le rappel push quotidien indique « Viens ouvrir tes pack » à 20 h, heure de Paris. Pour l'activer en production :

1. Exécuter `supabase-tcg-push-reminders.sql` dans l'éditeur SQL du projet Supabase. La table n'est accessible qu'aux fonctions serveur avec la clé service role.
2. Générer une paire VAPID avec `npx web-push generate-vapid-keys`.
3. Ajouter ces variables dans les paramètres Vercel, pour l'environnement Production :
   - `WEB_PUSH_PUBLIC_KEY` et `WEB_PUSH_PRIVATE_KEY` : paire générée à l'étape 2.
   - `SUPABASE_SERVICE_ROLE_KEY` : clé service role du projet Supabase. Garder cette clé uniquement côté serveur ; ne pas la préfixer avec `VITE_`.
   - `CRON_SECRET` : chaîne aléatoire secrète d'au moins 16 caractères.
   - `WEB_PUSH_SUBJECT` (facultatif) : adresse de contact `mailto:` ou URL du site ; valeur par défaut `https://urtt.fr/`.
4. Redéployer le projet. Le cron Vercel appelle l'API à 18 h et 19 h UTC ; la fonction envoie seulement pendant l'heure 20 h à Paris, ce qui suit automatiquement le changement d'heure.

Les personnes activent le rappel depuis la page d'ouverture des packs et peuvent le désactiver depuis le même bouton. L'autorisation et l'abonnement sont propres à chaque navigateur/appareil.

Sur le plan Vercel Hobby, l'heure d'exécution peut varier dans l'heure programmée (jusqu'à environ 59 minutes). Les autres plans ont une précision à la minute.
