// Configuración de ambiente via variables de entorno (Vercel/local)
// EXPO_PUBLIC_* se expone al cliente en builds de Expo web

export const KEYCLOAK_URL      = process.env.EXPO_PUBLIC_KEYCLOAK_URL      || "http://62.171.160.238:8095";
export const KEYCLOAK_REALM    = process.env.EXPO_PUBLIC_KEYCLOAK_REALM    || "proyecto-h-dev";
export const REACT_APP_API_URL = process.env.EXPO_PUBLIC_API_URL           || "http://localhost:8080";
export const IMAGE_SERVER_URL  = process.env.EXPO_PUBLIC_IMAGE_URL         || "http://62.171.160.238:3030";

// Cloudflare R2 — URL pública para ver comprobantes
export const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || "https://pub-7e31005d201d4d34894758b2b1d00d9a.r2.dev";

// Endpoint de token Keycloak (OpenID Connect directo)
export const API_KEYCLOAK_ADAPTER_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect`;

