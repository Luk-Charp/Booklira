# Règles Firestore à ajouter — Fonctionnalité "Amis"

Ce fichier n'est **pas** un fichier de code de l'app : c'est ce qu'il faut
ajouter dans **Firebase Console → Firestore Database → Règles** (ou dans ton
fichier `firestore.rules` si tu le déploies via la CLI).

Adapte ces blocs à tes règles existantes (notamment celles déjà en place
pour la collection `books`) — ne remplace pas tout le fichier, insère ces
blocs à l'intérieur de ton `match /databases/{database}/documents { ... }`.

```
    // =========================================================
    // PROFILS PUBLICS (utilisés pour la recherche d'amis)
    // =========================================================
    match /users/{userId} {
      // Tout utilisateur connecté peut lire un profil public
      // (nécessaire pour la recherche par pseudo et l'affichage
      // des demandes/amis). Seul le propriétaire peut l'écrire.
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;

      // =========================================================
      // LISTE D'AMIS (sous-collection)
      // =========================================================
      match /friends/{friendId} {
        // Un utilisateur peut lire sa propre liste d'amis.
        allow read: if request.auth != null && request.auth.uid == userId;

        // Écriture autorisée si c'est le propriétaire de la liste,
        // OU si c'est l'ami en question qui accepte une demande /
        // crée le lien réciproque (nécessaire pour le batch
        // d'acceptation et le lien d'invitation).
        allow write: if request.auth != null &&
          (request.auth.uid == userId || request.auth.uid == friendId);
      }
    }

    // =========================================================
    // DEMANDES D'AMI
    // =========================================================
    match /friendRequests/{requestId} {
      // On peut lire une demande si on est l'expéditeur ou le
      // destinataire.
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.from ||
         request.auth.uid == resource.data.to);

      // Créer une demande : seulement en tant qu'expéditeur.
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.from;

      // Supprimer une demande (refus, annulation, ou acceptation
      // qui la retire) : expéditeur ou destinataire.
      allow delete: if request.auth != null &&
        (request.auth.uid == resource.data.from ||
         request.auth.uid == resource.data.to);
    }
```

## Pour la collection `books` : lecture par les amis

Tes règles actuelles sur `books` autorisent sans doute uniquement le
propriétaire (`resource.data.userId == request.auth.uid`) à lire ses
propres livres. Pour permettre à un ami de voir les livres marqués comme
« lu » (si l'utilisateur a activé "Mes livres lus" dans ses réglages de
confidentialité), ajoute une clause `allow read` supplémentaire, par
exemple :

```
    match /books/{bookId} {
      allow read: if request.auth != null && (
        // Le propriétaire peut toujours tout lire
        resource.data.userId == request.auth.uid ||

        // Un ami peut lire un livre marqué "lu" si le propriétaire
        // a autorisé le partage de sa bibliothèque
        (
          resource.data.statut == "lu" &&
          exists(/databases/$(database)/documents/users/$(request.auth.uid)/friends/$(resource.data.userId)) &&
          get(/databases/$(database)/documents/users/$(resource.data.userId)).data.visibilite.livres == true
        )
      );

      // Garde tes règles d'écriture existantes (propriétaire uniquement)
      allow write: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
```

⚠️ Le champ `note` (étoiles) reste dans le même document que le livre : la
règle ci-dessus ne peut pas masquer un champ précis à l'intérieur d'un
document. C'est donc **le composant `FriendProfile.jsx`** qui, côté
affichage, masque la note si `visibilite.notes` est `false` — la donnée
brute reste techniquement lisible par un ami une fois qu'il a accès au
livre. Si tu veux une vraie séparation au niveau des règles, il faudrait
déplacer `note` dans un sous-document distinct (ex. `books/{id}/prive/note`)
avec ses propres règles — dis-moi si tu veux qu'on fasse ce refactor.
