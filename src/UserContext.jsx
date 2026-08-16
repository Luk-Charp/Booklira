import { createContext, useContext } from "react";

/*
 * Contexte partagé pour l'utilisateur connecté.
 *
 * Sert surtout à pouvoir "rafraîchir" les infos du profil
 * (nom, photo) affichées dans le header (App.jsx) juste après
 * une modification faite depuis la page Profil, sans recharger
 * la page.
 */
export const UserContext = createContext({
  user: null,
  refreshUser: () => {},
});

export function useUser() {
  return useContext(UserContext);
}
