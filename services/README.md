# Backend Services

Hanya **2 service** (+ frontend):

| Service | Port | Env | Fungsi |
|---------|------|-----|--------|
| **app-service** | `8000` | `services/app-service/.env` | REST API + proxy ke monitoring |
| **monitoring-service** | `3001` | `services/monitoring-service/.env` | MQTT, sensor-data, alerts, **Socket.IO** |

## Frontend env

```bash
cd frontend && cp .env.example .env
```

```
VITE_API_URL=http://localhost:8000
VITE_MONITORING_URL=http://localhost:3001
```

## Start

```bash
# Terminal 1
cd services/app-service && cp .env.example .env && npm start

# Terminal 2
cd services/monitoring-service && cp .env.example .env && npm start

# Terminal 3
cd frontend && npm run dev
```

Service lama (gateway, realtime, user, dll.) ada di `_archive/`.

Setup database: [`../database/README.md`](../database/README.md)
