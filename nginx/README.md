# Nginx configuration

`ssl-nginx.conf` is the **only** nginx config for this project. It runs on the
host (not in a container) and terminates TLS for `ccms.pixelspot.in`, then
reverse-proxies to the `backend` and `frontend` Docker containers on their
loopback-bound ports (`127.0.0.1:5000` and `127.0.0.1:8080` respectively — see
`docker-compose.production.yml`).

Previously this directory had five overlapping, partially-stale configs
(`nginx.conf` + `conf.d/default.conf` for a containerized nginx service that
was never actually wired up, `nginx.production.conf` referenced only by a dead
code path in the deploy scripts, and `nginx.host.conf` pointing at ports no
running container used). They were removed to eliminate the risk of a fix
landing in a file that isn't the one actually serving traffic. If you need a
fully containerized nginx + certbot setup instead of host nginx, design and
test that as a deliberate change — don't resurrect the old files.

## Deploying a config change

```bash
sudo cp nginx/ssl-nginx.conf /etc/nginx/sites-available/ccms.conf
sudo nginx -t   # validate before reloading
sudo systemctl reload nginx
```

`ssl_dhparam /etc/nginx/dhparam.pem;` must exist on the host once:

```bash
sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048
```
