# Configurar Mapbox para tracking en vivo

Esta guía aplica a `lm_market_api`, `lm_market_web` y `lm_market_mobile`.

## 1. Cuenta y facturación

1. Crea una cuenta en [Mapbox](https://account.mapbox.com/).
2. Habilita facturación y define alertas de uso (Maps + Directions).

## 2. Tokens (mínimos y separados)

Genera tokens distintos:

| Token | Uso | Dónde |
| --- | --- | --- |
| Público `pk...` Flutter | Renderizar mapas en la app | `--dart-define=MAPBOX_ACCESS_TOKEN` |
| Público `pk...` Web | Renderizar mapas en Vite | `VITE_MAPBOX_ACCESS_TOKEN` |
| Token servidor | Directions/ETA | `MAPBOX_ACCESS_TOKEN` en API `.env` |
| Secreto `DOWNLOADS:READ` | Descargar SDK nativo Android/iOS | Gradle / `.netrc` / secretos CI (nunca en Git) |

Restringe los tokens públicos por URL/package/bundle id.

## 3. API

```bash
cp .env_template .env
```

Completa:

```env
MAPBOX_ACCESS_TOKEN=tu_token_servidor
TRACKING_LOCATION_INTERVAL_SECONDS=5
TRACKING_STALE_AFTER_SECONDS=45
TRACKING_MAX_ACCURACY_METERS=100
TRACKING_ROUTE_REFRESH_SECONDS=60
TRACKING_ROUTE_REFRESH_DISTANCE_METERS=150
```

Aplica schema:

```bash
npm run runMigration && npm run updateDB
npm run build && npm start
```

## 4. Web

```bash
cp .env_template .env
```

```env
VITE_MAPBOX_ACCESS_TOKEN=pk.tu_token_publico_web
VITE_API_URL=http://localhost:3000
```

```bash
npm run dev
```

## 5. Flutter

```bash
flutter run \
  --dart-define=API_BASE=http://10.0.2.2:3000 \
  --dart-define=MAPBOX_ACCESS_TOKEN=pk.tu_token_publico_mobile
```

Para Android/iOS builds, pasa los mismos `--dart-define`.

Permisos de ubicación (reparto en segundo plano):

- Android: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` (ya en `AndroidManifest.xml`). En Android 10+ el usuario debe conceder “Permitir todo el tiempo” / background tras el permiso while-in-use.
- iOS: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` y `UIBackgroundModes=location` (ya en `Info.plist`). La app pide upgrade a Always al iniciar reparto.

### Token de descarga nativo (si el SDK lo exige)

- Android: `~/.gradle/gradle.properties` → `MAPBOX_DOWNLOADS_TOKEN=sk...`
- iOS: `~/.netrc` con `api.mapbox.com` y el token secreto

## 6. Prueba end-to-end

1. Cliente crea pedido con pin de destino (checkout móvil o web).
2. Admin asigna repartidor.
3. Repartidor inicia reparto en la app (pide GPS y transmite).
4. Cliente ve mapa en Mis compras (móvil/web).
5. Admin ve mapa en Órdenes.
6. Al entregar o cancelar, el mapa desaparece y se deja de transmitir.

## 7. Costos

- Cada apertura de mapa consume Map loads / MAUs.
- Directions se llama desde la API como máximo cada ~60 s o tras movimiento significativo, no por cada ping GPS.
- Revisa el dashboard de Mapbox tras las primeras pruebas reales.
