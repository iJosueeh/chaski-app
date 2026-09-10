# Plan: GO_BACK en Perfil + Cerrar sesión accesible + aclaración del logo «S»

**Goal:** Eliminar el warning «The action GO_BACK was not handled», poner CERRAR SESIÓN dentro del tab Perfil, y hacer el avatar «S» de la Home el atajo a Perfil — manteniendo intacto el flujo de logout que ya funciona.

## Current context / assumptions (verificado en el repo hoy)

1. **GO_BACK — causa exacta:** `src/features/preferences/screens/preferences.tsx:75` → botón «Volver» hace `router.back()`. Ese componente ahora se renderiza DENTRO del tab `/(tabs)/perfil.tsx` (re-export). Al llegar ahí por **tab switch** (no por push), la pila está vacía → `GO_BACK` no tiene a dónde volver → warning. (Dev-only, no crashea, pero sale en LogBox y en la demo queda mal.)
2. **El logout YA funciona de fondo:** `signOut()` (`src/features/auth/services/auth.service.ts:27-31`) llama `supabase.auth.signOut()`; `auth-context` escucha `onAuthStateChange` y el `RootNavigator` (`src/app/_layout.tsx:27-31`) hace swap condicional: `!session` → renderiza el Stack con `login`/`register`. **No falta lógica de navegación post-logout: el swap del árbol es automático.** Lo que falta es **descubribilidad**: el único botón es «SALIR DEL BOLETO» al fondo de Home (index.tsx:336-343) y Perfil no tiene ninguno.
3. **El logo «S» NO es un error:** es el **avatar con la inicial del email** del usuario logueado (`initial = user?.email?.[0]?.toUpperCase() ?? 'A'`, index.tsx:37 — el correo de Andre empieza con S). Comportamiento correcto; el problema es que parece un logo muerto (no hace nada).
4. El botón de Perfil usa azul hardcodeado `#3c87f7` (preferences.tsx:136) — fuera de la paleta Serie AX.

## Architecture / approach

Tres cambios quirúrgicos, sin tocar navegación global: (1) back seguro con `router.canGoBack()` en el componente compartido de preferencias; (2) botón «CERRAR SESIÓN» en ese mismo componente (reutilizado por Perfil) que solo llama `signOut()` y confía en el swap automático del RootNavigator; (3) el avatar «S» de Home se vuelve `TouchableOpacity` → `/(tabs)/perfil`. DRY: nada de duplicar lógica de auth — el contexto ya la maneja.

---

## Tasks

### Task 1: Back seguro en Perfil/preferencias (mata el GO_BACK)

**Files:** Modify `src/features/preferences/screens/preferences.tsx` (footer, líneas 74-80).

**Step 1 — Verificar que `canGoBack` existe en la versión de expo-router instalada:**
```bash
grep -n "canGoBack" node_modules/expo-router/build/imperative-api.js | head -3
```
Esperado: export de `canGoBack` (expo-router v6/SDK 57 lo tiene). Si NO aparece, usar el fallback del paso 3.

**Step 2 — Reemplazar el botón Volver:**
```tsx
{/* dentro del footer, reemplaza el onPress actual */}
<TouchableOpacity
    style={styles.buttonGhost}
    onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)'); // llegó por tab: no hay pila, volver a Inicio
    }}
>
    <ThemedText type="default" style={styles.buttonGhostText}>Volver</ThemedText>
</TouchableOpacity>
```
Y en `styles` añadir (paleta Serie AX, NO azul):
```tsx
buttonGhost: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
},
buttonGhostText: { color: '#9C3E1B' }, // terracota (theme.primary — este archivo no usa useTheme para botones; si se prefiere, importar useTheme)
```

**Step 3 (solo si canGoBack no existe):** reemplazar el onPress por `router.replace('/(tabs)')` a secas. (Desde wizard nunca se llega a Perfil, así que replace es seguro aquí.)

**Step 4 — Verificar:**
```bash
npx tsc --noEmit && echo TSC_OK
```
Esperado: `TSC_OK` sin errores.

### Task 2: CERRAR SESIÓN dentro de Perfil

**Files:** Modify `src/features/preferences/screens/preferences.tsx` (mismo footer, debajo del Volver).

**Step 1 — Añadir el botón logout (usa el servicio existente, DRY):**
```tsx
import { signOut } from '@/features/auth/services/auth.service';
// ...dentro del footer, después del botón Volver:
<TouchableOpacity
    style={styles.buttonLogout}
    onPress={async () => {
        await signOut();
        // El RootNavigator (_layout.tsx:27-31) hace swap solo: session=null → Stack de login.
    }}
>
    <ThemedText type="default" style={styles.buttonLogoutText}>Cerrar sesión</ThemedText>
</TouchableOpacity>
```
Estilos (carmín Serie AX):
```tsx
buttonLogout: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#B71C1C', // theme.carmine
},
buttonLogoutText: { color: '#FFFDF9' }, // theme.surface
```

**Step 2 — Verificación estática:**
```bash
npx tsc --noEmit && npm run lint && echo OK
```

**Step 3 — Verificación e2e (emulador con la app corriendo):**
1. Tab **Perfil** → tap «Cerrar sesión».
2. Esperado: aparece la pantalla de login (swap automático). Verificar con:
```bash
adb exec-out uiautomator dump /dev/tty 2>/dev/null | grep -o 'text="INICIAR SESIÓN\?[^\"]*"'
```
3. Volver a loguearse → debe aterrizar en la app con tabs (hasPreferences ya está true).
4. Confirmar que NO aparece el warning:
```bash
adb logcat -d -t 200 -s ReactNativeJS:* | grep -c "GO_BACK"
```
Esperado: `0`.

### Task 3: Avatar «S» → atajo a Perfil

**Files:** Modify `src/app/(tabs)/index.tsx` (bloque del avatar en el topBar, buscar `styles.avatar` / `avatarInitial`).

**Step 1 — Envolver el avatar en TouchableOpacity (si ya hay un Touchable, solo añadir onPress):**
```tsx
<TouchableOpacity
  activeOpacity={0.7}
  onPress={() => router.push('/(tabs)/perfil')}
  accessibilityLabel="Abrir perfil"
>
  <View style={[styles.avatar, { borderColor: theme.brand }]}>
    <Text style={[styles.avatarInitial, { color: theme.brand }]}>{initial}</Text>
  </View>
</TouchableOpacity>
```
**Step 2 — Verificar:** `npx tsc --noEmit && npm run lint` → OK; en el emulador, tap sobre la «S» → abre Perfil.

### Task 4: Commit

```bash
git add -A && git commit -m "fix: GO_BACK en Perfil (back seguro), Cerrar sesión en Perfil, avatar S atajo a Perfil"
git log --oneline -1
```
Esperado: 1 commit nuevo encima de `3c6985b`.

---

## Tests / validation (resumen del ciclo)

- TSC+lint 0 tras cada Task (comandos arriba).
- e2e por uiautomator (Task 2 Step 3 y Task 3 Step 2) — la app ya está corriendo en el AVD ChaskiPhone; si el puerto 8081 está ocupado por un Metro residual, primero `netstat -ano | findstr ":8081"` + `Stop-Process -Id <pid> -Force` y relanzar `npx expo start --android`.
- Prueba negativa clave: el warning GO_BACK no vuelve a aparecer en logcat después de: Perfil → Volver (via tab) → Perfil → Cerrar sesión.

## Risks / tradeoffs / open questions

- **`router.canGoBack()`**: verificado contra node_modules en Task 1 Step 1; fallback ya definido. Riesgo bajo.
- **¿Limpiar WizardContext/plan activo al hacer logout?** El plan activo vive en AsyncStorage y sobrevive al logout. DECISIÓN: no tocarlo en este plan (YAGNI) — se re-plantea si el docente pregunta por sesión multiusuario. Queda como pregunta abierta.
- **El `preferences` route del Stack autenticado (no-tab)** queda registrado en `_layout.tsx`; si nadie lo usa tras este cambio, NO se borra (posible uso futuro) — solo se corrige su back.
- El botón «Volver» dentro de un tab es redundante con el tab bar; se conserva porque el mismo componente sirve para el route `/preferences` (push). No rompe nada.
