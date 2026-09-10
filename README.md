# Chaski — Boleto de Experiencias (Serie AX)

App móvil para planificar recorridos urbanos personalizados en Lima
Metropolitana. Desarrollada con React Native + Expo + Supabase (Grupo 3, UTP).

## Requisitos
- Node.js 20+ · npm 10+
- Expo Go instalado en un dispositivo Android físico o emulador (AVD)

## Instalación
1. `npm install`
2. Crear `.env` en la raíz con las credenciales del proyecto Supabase (pedirlas al equipo):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=<publishable-key>
   ```
3. Emulador: iniciar el AVD y luego `npx expo start --android`
   Dispositivo físico: escanear el QR con Expo Go (misma red Wi-Fi).

## Scripts
- `npm start` — Metro bundler
- `npm run lint` — ESLint (debe terminar sin errores)
- `npx tsc --noEmit` — chequeo de tipos (debe terminar sin errores)

## Flujo principal
Login → Inicio → CREAR MI PLAN (wizard 5 pasos: ubicación/mapa, tiempo,
presupuesto, intereses, movilidad) → Buscando → Resultados (hasta 3 planes)
→ Detalle → Elegir plan → Plan activo (marcar paradas) → Completado → Historial.
