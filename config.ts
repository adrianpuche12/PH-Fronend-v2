let currentHost = 'localhost';
let currentPort = '';

if (typeof window !== 'undefined' && window.location) {
    currentHost = window.location.hostname;
    currentPort = window.location.port;
}

let keycloakUrl: string;
let keycloakRealm: string;
let apiUrl: string;
let imageUrl: string;

if (currentHost === '62.171.160.238') {
    keycloakUrl = 'http://62.171.160.238:8095';
    imageUrl    = 'http://62.171.160.238:3030';

    if (currentPort === '8103') {
        // Frontend DEV en servidor
        keycloakRealm = 'proyecto-h-dev';
        apiUrl        = 'http://62.171.160.238:8101';
    } else {
        // Frontend PROD en servidor (:8102)
        keycloakRealm = 'proyecto-h-prod';
        apiUrl        = 'http://62.171.160.238:8100';
    }
} else {
    // Desarrollo local → Keycloak remoto, backend local
    keycloakUrl   = 'http://62.171.160.238:8095';
    keycloakRealm = 'proyecto-h-dev';
    apiUrl        = 'http://localhost:8080';
    imageUrl      = 'http://62.171.160.238:3030';
}

export const KEYCLOAK_URL      = keycloakUrl;
export const KEYCLOAK_REALM    = keycloakRealm;
export const REACT_APP_API_URL = apiUrl;
export const IMAGE_SERVER_URL  = imageUrl;

// Endpoint de token Keycloak (OpenID Connect directo)
export const API_KEYCLOAK_ADAPTER_URL = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect`;

if (typeof window !== 'undefined') {
    console.log('Config:', { keycloakUrl, keycloakRealm, apiUrl });
}
