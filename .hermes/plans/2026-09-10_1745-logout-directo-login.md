# Plan: Logout → ir directo al frame de Login (eliminar la «limpiada de datos» sin navegación)

**Goal:** Al pulsar «Cerrar sesión» en Perfil, la app debe aterrizar **inmediatamente** en la pantalla de login (frame Serie AX), sin la fase intermedia donde la pantalla se queda ahí «con los datos borrados».

## Current context / assumptions (verificado leyendo el código hoy)

**Qué pasa hoy — secuencia técnica real del logout:**
1. Tap «Cerrar sesión» → `await signOut()` (`src/features/auth/services/auth.service.ts:27`) → llamada de red a Supabase.
2. Supabase emite el evento `SIGNED_OUT` → `auth-context.tsx:31-33` hace `setSession(null)`.
3. `RootNavigator` (`src/app/_layout.tsx:27-31`): `!session` → desmonta el Stack autenticado y monta el Stack de login/register.
4. En paralelo, `PreferencesProvider.checkPreferences` (`preferences-context.tsx:63-69`) ve `user=null` → `setUserPreferences(null)` + `setHasPreferences(false)`.

**El síntoma «solo quita datos»:** mientras el paso 1 (red) tarda, y/o si el render del swap (paso 3) llega tarde, el usuario permanece en la pantalla de Perfil con sus preferencias ya borradas (paso 4 corre antes que el swap visual) → «limpió los datos pero no me llevó al login». La navegación actual depende de un render condicional indirecto; no hay navegación explícita en el handler.

**Supuestos:**
- El swap por `session=null` FUNCIONA (evidencia: dumps de UI previos mostraron login tras sesión nula) — el problema es timing/determinismo, no lógica rota.
- El repo no tiene framework de tests (no hay test runner en package.json) → verificación por tsc/lint + e2e con uiautomator (misma práctica de los planes anteriores de este repo).

## Architecture / proposed approach

Navégalo explícitamente: el handler del botón hace `await signOut()` y luego `router.dismissAll()` + `router.replace('/login')`. Así la transición al login es directa y determinista (el swap del contexto queda como segunda red de seguridad, DRY: se reutiliza el servicio y el stack de login existentes — cero código nuevo de auth).

---

## Step-by-step tasks

### Task 1: Navegación explícita post-logout (el fix)

**Files:** Modify `src/features/preferences/screens/preferences.tsx` (handler del botón «Cerrar sesión», añadido en el commit anterior; líneas ~88-96).

**Step 1 — Reemplazar el handler actual:**
```tsx
<TouchableOpacity
    style={styles.buttonLogout}
    onPress={async () => {
        // 1) cerrar sesión en Supabase (el contexto hará el swap del árbol)
        await signOut();
        // 2) navegación explícita al login: determinista, sin esperar el
        //    re-render del swap ni la limpiada visual de preferencias.
        router.dismissAll();
        router.replace('/login');
    }}
>
    <ThemedText type="default" style={styles.buttonLogoutText}>
        Cerrar sesión
    </ThemedText>
</TouchableOpacity>
```
(El import de `signOut` ya existe en el archivo — no tocar.)

**Step 2 — Verificación estática:**
```bash
cd "D:\Andre\Documents\Hermes Desktop\Desarrollo de Aplicaciones Móviles_II_2026\Chaski-oficial"
npx tsc --noEmit
```
Esperado: sin output (exit 0). Luego `npm run lint` → `LINT_EXIT=0`.

### Task 2: Verificación e2e (demo real en el AVD)

Prerrequisito: app corriendo (`npx expo start --android`) y sesión activa (usuario logueado).

**Step 1 — Recargar el bundle** (el Metro del usuario ya aplica hot-reload; si no, `r` en su terminal o force-stop + reabrir).

**Step 2 — Ejecutar el flujo con taps reales (uiautomator, patrón ya usado en esta sesión):**
1. Tab Perfil → tap «Cerrar sesión».
2. Esperar ≤3 s y dumpear UI:
```bash
adb exec-out uiautomator dump /dev/tty 2>/dev/null | grep -o 'text="INICIAR SESIÓN"'
```
Esperado: aparece `INICIAR SESIÓN` (login Serie AX visible). Si aparece la pantalla de Perfil con datos vacíos por >3 s, el fix no funcionó.

**Step 3 — Probar el reingreso:** loguearse de nuevo → esperado Home «HOLA, EXPLORADOR» (confirma que el swap inverso sigue intacto).

**Step 4 — Confirmar 0 warnings GO_BACK en la misma sesión:**
```bash
adb logcat -d -t 300 -s ReactNativeJS:* | grep -c "GO_BACK"
```
Esperado: `0`.

### Task 3: Commit

```bash
git add -A && git commit -m "fix: logout navega directo al login (dismissAll + replace), sin flash de datos borrados"
git log --oneline -1
```
Esperado: 1 commit nuevo encima de `3c6985b`.

---

## Tests / validation

- TDD honesto: el repo no tiene test runner; la validación es estática (tsc/lint, Task 1) + e2e con taps reales y grep de logcat (Task 2) — misma estrategia de los planes previos de este proyecto. Agregar Jest solo para esto sería YAGNI.
- Escenario cubierto: logout desde Perfil → login ≤3 s → re-login OK → 0 GO_BACK.

## Risks / tradeoffs / open questions

- **Carrera replace vs swap:** `replace('/login')` corre en el Stack autenticado; un instante después el swap lo desmonta. Ambos caminos terminan en login; si expo-router llegara a quejarse (warning en consola), la alternativa es solo `dismissAll()` y confiar en el swap — se decide con el logcat del Task 2.
- **Estado sobreviviente al logout (pregunta abierta, YAGNI):** el plan activo y el historial viven en AsyncStorage y NO se borran al cerrar sesión. Correcto para demo (un solo usuario), pero si el docente pregunta por multiusuario, la limpieza de `PlansContext` al logout es el siguiente cambio. Fuera de alcance aquí.
- **El «Volver» de Perfil** (back seguro del commit anterior) no se toca: sigue sirviendo para el route `/preferences`.
