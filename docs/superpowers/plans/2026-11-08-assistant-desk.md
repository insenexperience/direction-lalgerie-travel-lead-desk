# Plan d’intégration de l’assistant Travel Lead Desk

> Pour l’implémentation, suivre les tâches dans l’ordre avec la compétence `superpowers:executing-plans`.

**Objectif** · Donner à l’équipe un assistant flottant capable de lire un dossier et de préparer les actions usuelles depuis le Desk.

**Architecture** · Monter la bulle dans le shell authentifié. Partager le panneau de connexion avec Réglages. Les actions serveur appliquent les droits de l’opérateur avant d’appeler Claude et réutilisent les actions métier du Desk pour les opérations confirmées.

**Périmètre V1** · Claude lit les faits utiles du dossier courant et aide à la qualification. Il peut demander au Desk de préparer un brouillon voyageur ou un brief agence. Le Desk compose le message à partir de ses modèles et le soumet à validation. OpenAI reste une intégration ultérieure.

## Contraintes

- Par défaut, l’assistant est désactivé. Le Desk reste utilisable quand aucun fournisseur n’est configuré, quand la connexion échoue ou quand le fournisseur est indisponible.
- La bulle et Réglages donnent accès au même état et au même panneau. Un administrateur peut tester un fournisseur configuré côté serveur, l’activer ou le désactiver. Les opérateurs peuvent voir l’état et utiliser l’assistant actif dans les limites de leurs droits.
- Les clés restent dans les secrets serveur. La connexion dans l’interface sélectionne et teste un fournisseur déjà configuré. Elle ne demande pas de clé dans la conversation.
- Le dossier courant est l’unique contexte automatique. Le serveur relit les faits autorisés et ne transmet au fournisseur que les éléments nécessaires au tour. Les coordonnées, les notes internes et les autres dossiers ne font pas partie du contexte par défaut.
- Une réponse du modèle peut suggérer une modification, préparer un brouillon ou ouvrir le composeur. Toute écriture exige une validation de l’opérateur. L’envoi demeure dans le composeur existant, avec relecture du destinataire et du contenu.
- Une sélection d’envies ou une suggestion du modèle n’est pas un fait confirmé. Le brief pour chiffrage reste soumis aux contrôles existants. Aucun démarchage automatique d’agence.

## 1. Connexion optionnelle et interface

**Fichiers** · `src/components/bo3/shell.tsx`, `src/app/(dashboard)/settings/page.tsx`, nouveau `src/components/assistant/assistant-connection.tsx`, nouvelle action serveur dans `src/app/(dashboard)/settings/assistant-actions.ts` et migration Supabase dédiée.

- [ ] Définir un état partagé `disabled | unconfigured | connected | unavailable` avec fournisseur et date du dernier test. Persister uniquement l’activation et le fournisseur, avec contrôle administrateur côté serveur.
- [ ] Brancher le panneau partagé sur la bulle et dans Réglages. Hors connexion, afficher un état discret et la configuration à l’ouverture, sans charger de modèle.
- [ ] Vérifier clavier, fermeture avec Échap, restitution du focus et accès au Desk pendant une panne. Vérifier qu’un non-administrateur ne peut pas modifier la configuration via l’action serveur.

## 2. Conversation et contexte

**Fichiers** · `src/app/(dashboard)/settings/assistant-actions.ts`, `src/lib/assistant/claude.ts`, `src/lib/assistant/lead-context.ts` et la session de `src/lib/supabase/server.ts`.

- [ ] Connecter l’API Messages de Claude côté serveur, avec une opération de test de connexion et une réponse structurée limitée aux types de brouillons du Desk.
- [ ] Authentifier chaque tour, contrôler l’accès au dossier avec les droits de la session, borner la taille des messages et gérer les délais et erreurs fournisseur. Afficher clairement la référence du dossier utilisé.
- [ ] Vérifier qu’une référence forgée ou un changement de dossier ne permet pas de récupérer des données d’un autre dossier. Vérifier que l’assistant désactivé n’appelle pas le fournisseur.

## 3. Actions métier

**Fichiers** · `src/app/(dashboard)/settings/assistant-actions.ts`, `src/app/(dashboard)/leads/email-actions.ts`, `src/lib/lead-qualification-completeness.ts`, `src/components/bo3/fiche.tsx` et `src/components/leads/lead-email-composer.tsx`.

- [ ] Limiter la liste d’actions à résumer la demande, lister les points à qualifier, préparer un brouillon voyageur et ouvrir le parcours du brief agence.
- [ ] Présenter la proposition avant application, avec dossier, type de message, destinataire et aperçu. Revalider le dossier, le destinataire et la version du brouillon au moment de l’enregistrement. Réutiliser `saveLeadEmailDraft` pour les brouillons et les contrôles existants dans le parcours agence.
- [ ] Garder l’envoi dans l’action manuelle `sendLeadEmailDraft` du composeur. Tester le rejet des actions hors liste, d’un brouillon obsolète et d’un brief pour chiffrage incomplet. Vérifier que les opérations confirmées suivent le journal métier existant.

## Activation sur un environnement

Appliquer `20261108120000_desk_assistant_settings.sql`, renseigner `ANTHROPIC_API_KEY` côté serveur et redéployer. `DESK_CLAUDE_MODEL` permet de choisir le modèle. Renseigner `ANTHROPIC_WORKSPACE_ID` si la clé Anthropic requiert un espace de travail explicite.

Un administrateur ouvre ensuite **Réglages → Assistant du Desk** ou la bulle **Assistant**, puis choisit **Tester et activer Claude**. Le test utilise un message technique sans dossier. Une fois Claude connecté, ouvrir une fiche pour lui poser une question ou demander un brouillon. Pour un brief agence, qualifier le dossier et préparer la consultation dans **Brief & agences** avant d’ouvrir le brouillon dans la bulle.
