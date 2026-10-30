# Deploying AcademiaX to a single VM

These are notes for running the same Docker Compose stack on one Linux VM (e.g. an Ubuntu 24.04 VM with 4 vCPU / 8 GB RAM on any cloud). Nothing here has been deployed; it is the plan the problem statement asks for.

## 1. Size and prerequisites

| Item | Recommendation |
|---|---|
| VM | 4 vCPU, 8 GB RAM, 30 GB disk (10 JVMs at ~300–400 MB each, plus MySQL) |
| OS | Ubuntu 24.04 LTS |
| Software | Docker Engine 27+ and the Compose plugin (`sudo apt install docker.io docker-compose-v2`) |
| Firewall | Allow 22 (SSH) and 80/443 only. Keep 3307, 8080–8093 and 8761 closed to the internet. |

## 2. Get the code and configure

```bash
git clone <your-repo-url> academiax && cd academiax
cp .env.example .env
nano .env        # set a strong JWT_SECRET (openssl rand -base64 48), DB_PASSWORD, ADMIN_* values
```

Set `CORS_ALLOWED_ORIGINS` to the public origin of the frontend, e.g. `https://academiax.example.edu`.

The browser calls the gateway directly, so the frontend must be built with the public gateway URL:

```bash
# in docker-compose.yml, under frontend.build.args
VITE_API_URL: https://academiax.example.edu/api
```

## 3. Put a reverse proxy in front (TLS)

Expose only a reverse proxy. A minimal Caddy setup (automatic HTTPS):

```caddyfile
academiax.example.edu {
    handle_path /api/* {
        reverse_proxy localhost:8080
    }
    reverse_proxy localhost:5173
}
```

With this, publish only ports 80/443 and remove the host `ports:` mappings for MySQL, Eureka and the services in `docker-compose.yml` (keep `8080` and `5173` bound to `127.0.0.1`, e.g. `'127.0.0.1:8080:8080'`).

## 4. Start and verify

```bash
docker compose up -d --build
docker compose ps                 # every service "healthy"
curl -s localhost:8080/courses/whoami   # run a few times: instanceId alternates between the two course instances
```

The first start seeds 1 admin, 3 instructors, 10 students, 12 courses and demo enrollments (through the real saga) automatically.

## 5. Operations

| Task | Command |
|---|---|
| Logs for one service | `docker compose logs -f enrollment-service-1` |
| Follow one request | `docker compose logs | grep <X-Correlation-Id>` (every service logs the id) |
| Restart one instance (no downtime) | `docker compose restart course-service-2` |
| Back up MySQL | `docker compose exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases' > backup.sql` |
| Update | `git pull && docker compose up -d --build` |

## 6. Production hardening still to do

- Replace the simulated card form with a real payment provider (and never store card data).
- Move secrets from `.env` into the cloud's secret manager.
- Use a managed MySQL with automated backups instead of the container.
- Turn Eureka self-preservation back on and relax the 5 s lease timings (they are tuned for the live demo).
- Ship logs to a central store (Loki/ELK) keyed by `X-Correlation-Id`.
