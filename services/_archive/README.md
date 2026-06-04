# Archive

Service lama — **jangan dijalankan** paralel dengan arsitektur baru.

| Folder | Digantikan oleh |
|--------|-----------------|
| `user-service`, `screenhouse-service` | `app-service` |
| `data-service`, `alert-service` | `monitoring-service` |
| `api-gateway` | proxy di `app-service` |
| `realtime-service` | Socket.IO di `monitoring-service` |
