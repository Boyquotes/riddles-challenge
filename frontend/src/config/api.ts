// Configuration des points d'accès API
const getBaseUrl = () => {
  // En production, utiliser l'URL du serveur déployé
  if (typeof window !== 'undefined') {
    // Récupérer l'hôte actuel (pour le déploiement)
    const currentHost = window.location.hostname;
    
    // Si nous sommes sur localhost, utiliser localhost:3001
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    
    // Sinon, utiliser l'adresse IP du serveur
    return `http://${currentHost}:3001`;
  }
  
  // Fallback pour SSR
  return 'http://localhost:3001';
};

// Configuration pour les connexions HTTP et WebSocket
export const API_CONFIG = {
  httpUrl: `${getBaseUrl()}/graphql`,
  wsUrl: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001/graphql`,
  socketUrl: getBaseUrl(),
};

export default API_CONFIG;
