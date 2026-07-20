# Push notifications (API) — configuración

La guía completa (Firebase Console, Android, iOS/APNs, checklist de producto) está en el repo mobile:

`lm_market_mobile/docs/PUSH_NOTIFICATIONS_SETUP.md`

## Qué hace esta API

Tras confirmar un pedido, cada cambio de status del **cliente** dispara:

1. Fila en tabla `Notification`
2. Socket `notification:new` (app abierta → notificación local)
3. FCM push (app en background / cerrada)

Al **asignar** o **cancelar/desasignar** un reparto, lo mismo para el **delivery driver** (`DELIVERY_ASSIGNED` / `DELIVERY_CANCELLED`), con `route=/reparto`.

## Variables `.env`

| Variable | Uso |
|----------|-----|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo del service account (una línea). Preferido en deploy. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta absoluta al `.json` del service account. Preferido en local. |

Solo necesitas **una**. Generar en Firebase → Project settings → Service accounts → Generate new private key.

**Secreto:** no subir ese JSON a git.

Sin estas variables, FCM hace no-op; Socket.IO e inbox HTTP siguen.

## Endpoints

- `PUT /api/auth/push-token` — `{ token, platform: "android"|"ios" }`
- `DELETE /api/auth/push-token` — `{ token }`

## DB

```bash
npm run runMigration   # Prisma: tabla PushDevice
npm run updateDB       # higiene idempotente v16
```

## Código clave

- `src/libs/fcm/index.ts`
- `src/services/pushDeviceService.ts`
- `src/services/orderService.ts` → `notifyOrderStatusChange`, `notifyDeliveryAssigned`, `notifyDeliveryCancelled`
