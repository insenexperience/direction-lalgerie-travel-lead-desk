# Raccordement Gmail du Travel Lead Desk

## Activation

1. Dans l’organisation Google Cloud `directionlalgerie.com`, créer le projet **Travel Lead Desk Gmail** et activer **Gmail API**. Configurer un écran de consentement Google Auth Platform pour une application **Interne** à l’organisation et demander uniquement `https://www.googleapis.com/auth/gmail.readonly`.
2. Créer un client OAuth **Application Web**. Pour l’autorisation initiale via [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/), ajouter `https://developers.google.com/oauthplayground` à ses URI de redirection. Dans le Playground, utiliser les identifiants de **ce client**, choisir l’accès hors ligne et autoriser le compte **contact@directionlalgerie.com**. Échanger le code d’autorisation pour obtenir le jeton de renouvellement. Voir [l’autorisation Gmail côté serveur](https://developers.google.com/workspace/gmail/api/auth/web-server).
3. Dans l’environnement Vercel Production du Desk, stocker `DESK_GMAIL_CLIENT_ID`, `DESK_GMAIL_CLIENT_SECRET` et `DESK_GMAIL_REFRESH_TOKEN` en variables serveur. Vérifier la présence du `CRON_SECRET` existant. Appliquer la migration `20261108130000_desk_gmail_inbox.sql`, définir `DESK_GMAIL_ENABLED=true` et déployer.
4. Dans **Réglages → Gmail du Desk**, vérifier « Synchronisation active ». Le premier passage fixe le point de départ dans Gmail. Après ce passage, utiliser un dossier de test et une réponse entrante d’un correspondant connu, portant une référence unique dans l’objet. Vérifier l’affichage dans le dossier et l’absence de doublon après deux passages.

## Périmètre

- La tâche Vercel appelle `GET /api/cron/gmail` toutes les cinq minutes et présente le secret du cron. Le worker confirme l’identité de la boîte à chaque exécution, utilise l’historique Gmail et ignore les messages envoyés, brouillons, indésirables, supprimés et réponses automatiques déclarées.
- Le rapprochement exige une seule référence dans l’objet (par exemple `DA-C2FE8DCE` ou `DA-2026-0021`), un seul dossier ouvert correspondant et une adresse reconnue dans le dossier. Pour l’agence, le Desk vérifie une consultation expédiée ou un e-mail agence déclaré envoyé. Un message sans référence, ambigu ou envoyé depuis une nouvelle adresse reste dans Gmail. Le premier démarrage fixe le début de la surveillance aux nouveaux messages.
- Le Desk conserve la référence Gmail, l’objet, l’expéditeur, la date, un extrait texte de 4 000 caractères maximum et les noms des pièces jointes. Un mail HTML seul peut être ouvert dans Gmail. La détection utilise des indices du nouveau texte ou du nom de fichier. Le contenu des pièces jointes reste dans Gmail. Le référent du dossier et les administrateurs peuvent lire les copies importées.
- Le classement **Proposition à vérifier** laisse la saisie du devis au parcours existant. Le worker utilise uniquement les droits de lecture Gmail et écrit dans le journal de réception du Desk.

## Reprise et arrêt

Le Desk mémorise le dernier lot traité et déduplique par ID de message Gmail. En cas d’échec, le prochain passage rejoue le lot. Si Google signale que le point de reprise est trop ancien, **Réglages** affiche l’erreur. Comparer la date du dernier succès avec Gmail, traiter la période manquante, puis faire réinitialiser le point de reprise par un administrateur de base. Le passage suivant démarrera au dernier état Gmail disponible. [Documentation Gmail sur l’historique et la reprise](https://developers.google.com/workspace/gmail/api/guides/sync).

Agent DA lit les e-mails rapprochés des dossiers accessibles à l’opérateur. Un administrateur peut aussi demander une recherche des e-mails entrants directement dans la boîte partagée, y compris les fils sans référence de dossier. Cette recherche utilise le même accès Gmail en lecture seule, renvoie jusqu’à huit extraits et fournit des liens vers les fils d’origine.

Pour suspendre la lecture, mettre `DESK_GMAIL_ENABLED=false` en production et redéployer. Pour retirer l’accès à la boîte, révoquer le consentement Google. Les messages importés restent consultables dans leurs dossiers jusqu’à suppression des copies dans la base.
