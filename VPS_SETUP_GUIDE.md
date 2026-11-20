# 🚀 Complete Zero-to-Production VPS Deployment Guide
### For Swiss Knife Hub (`my-swiss-knife`)

This guide walks you through hardening a Linux VPS (Ubuntu 22.04 or 24.04 LTS), pointing your domain name, configuring automatic OS security patches and a firewall, generating cryptographic secrets, securing HTTPS via Let's Encrypt (Nginx or Caddy), and enforcing GDPR-safe log retention.

---

## 📋 Overview of What You Need
1. **A Linux VPS** (Ubuntu 22.04 / 24.04 LTS with at least 1–2 vCPU and 2 GB RAM recommended).
2. **VPS Public IPv4 Address** (e.g. `203.0.113.10`).
3. **A Registered Domain Name** (e.g. `example.com` or `hub.example.com`).

---

## 🌐 Phase 1: Point Your Domain to the VPS (DNS)

In your domain registrar's DNS dashboard (Cloudflare, Namecheap, Porkbun, Route53, etc.), create `A` records pointing to your VPS IPv4 address:

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_VPS_IP` | Automatic / 300s |
| **A** | `www` | `YOUR_VPS_IP` | Automatic / 300s |

> *Note: If deploying on a subdomain (e.g. `hub.example.com`), create a single `A` record with Host `hub` pointing to `YOUR_VPS_IP`, and remove `www.yourdomain.com` from your Nginx/Caddy config.*

Verify DNS resolution locally before proceeding:
```bash
nslookup yourdomain.com
```

---

## 🛡️ Phase 2: Server Hardening, Swap, Firewall & Unattended Updates

### 1. SSH into your VPS & create a non-root admin user (Recommended)
```bash
ssh root@YOUR_VPS_IP

# Create a dedicated sudo user and copy your SSH authorized_keys
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```
Reconnect as `ssh deploy@YOUR_VPS_IP` for day-to-day administration.

### 2. Update OS packages & enable Unattended Security Upgrades
Keep the Linux kernel, OpenSSL, Docker, and Nginx patched automatically against new CVEs:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Configure 2 GB Swap Memory (Prevents OOM During Multi-App Vite Builds)
Compiling all **9 Vite sub-applications** (TypeScript, React 19, Three.js, PixiJS) inside Docker can peak above 1.5 GB RAM on small VPS plans. Add 2 GB of swap if none is active:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. Enable UFW Firewall with SSH Rate Limiting
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit OpenSSH        # Rate-limits SSH brute-force attempts
sudo ufw allow 80/tcp         # HTTP (ACME challenges + redirect to HTTPS)
sudo ufw allow 443/tcp        # HTTPS
sudo ufw --force enable
sudo ufw status verbose
```
> **Important Docker + UFW Security Note:** Docker manipulates `iptables` directly and would bypass UFW if port `3000` were bound to `0.0.0.0`. Our `docker-compose.yml` binds `127.0.0.1:3000:3000` (`BIND_HOST=127.0.0.1`) by default so port `3000` is **only** reachable locally by Nginx/Caddy on the VPS and never exposed directly to the internet.

---

## 📦 Phase 3: Install Docker, Nginx & Certbot

```bash
# 1. Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release git

# 2. Add Docker's official GPG key & repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker Engine, Compose plugin, Nginx, and Certbot
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin nginx certbot python3-certbot-nginx

# 4. Enable services & allow your admin user to run docker
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
sudo usermod -aG docker "$USER"
```
*(Log out and back in once so the `docker` group membership takes effect, then verify with `docker compose version`).*

---

## 📂 Phase 4: Deploy Code & Generate Production Secrets

### 1. Prepare application directory
```bash
sudo mkdir -p /var/www/swiss-knife
sudo chown -R "$USER:$USER" /var/www/swiss-knife
cd /var/www/swiss-knife
```

### 2. Transfer the project files

#### Method A: Clone via Git (Recommended)
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git .
```

#### Method B: Upload clean source archive from your local machine
Avoid copying local `node_modules`, `dist`, `.env`, or `data` folders over SSH. From your local project directory:
```bash
tar --exclude='node_modules' --exclude='*/node_modules' --exclude='dist' --exclude='*/dist' --exclude='.git' --exclude='.env' --exclude='data' -czf swiss-knife.tar.gz .
scp swiss-knife.tar.gz deploy@YOUR_VPS_IP:/var/www/swiss-knife/
```
Then on the VPS:
```bash
cd /var/www/swiss-knife && tar -xzf swiss-knife.tar.gz && rm swiss-knife.tar.gz
```

### 3. Create `.env` & Generate a Strong `SECURITY_SECRET` (Crucial!)
`SECURITY_SECRET` protects encrypted session cookies (`astra_session`), security clearance tokens (`z340_clearance`), and anti-cheat HMAC signatures. **Never use default/placeholder secrets in production.**

```bash
cd /var/www/swiss-knife
cp .env.example .env
chmod 600 .env

# Generate a cryptographically random 256-bit (64-hex-char) secret and inject it into .env:
SECRET="$(openssl rand -hex 32)"
sed -i "s|^SECURITY_SECRET=.*|SECURITY_SECRET=${SECRET}|" .env

# Set your real domain name:
sed -i "s|^DOMAIN=.*|DOMAIN=yourdomain.com|" .env
```
*(Cross-platform alternative if `openssl` is unavailable: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).*

Verify `.env` contains your domain and 64-character `SECURITY_SECRET` (with `chmod 600` permissions):
```bash
ls -l .env
```

---

## 🚢 Phase 5: Build & Run the Hardened Container

```bash
cd /var/www/swiss-knife
docker compose up -d --build
```
What happens automatically:
- **Stage 1 (`build`)** installs production root dependencies and compiles all 9 Vite sub-apps (`neon-orbit`, `star_locator`, `chem-lab`, `chill-hub`, `shape-wars`, `sonic-soccer`, `nond_ex`, `alien-echo`, `pirate-fishing`), verifying every `dist/index.html`.
- **Stage 2 (`production`)** runs under `tini` as non-root `node` (`UID 1000:1000`), with a read-only root filesystem, `cap_drop: [ALL]`, `no-new-privileges:true`, bounded container logs (`3 x 10MB`), and a persistent `hub_data` Docker volume mounted at `/app/data`.

> *Note on Bind Mounts:* `docker-compose.yml` uses the named volume `hub_data:/app/data`, which automatically preserves `node:node` (`1000:1000`) ownership. If you ever switch `volumes:` to `./data:/app/data`, run `mkdir -p data && sudo chown -R 1000:1000 data` first so non-root DB writes succeed.

### Verify container health:
```bash
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```
Expected response:
```json
{"status":"healthy","uptime":...}
```

---

## 🔒 Phase 6: Configure Reverse Proxy & Free HTTPS (Nginx or Caddy)

### Option A: Nginx + Let's Encrypt (Certbot)

1. **Request your Let's Encrypt TLS certificate first** (using the running default Nginx vhost on port 80):
   ```bash
   sudo certbot certonly --nginx -d YOUR_ACTUAL_DOMAIN.COM -d www.YOUR_ACTUAL_DOMAIN.COM
   ```
   *(If deploying on a single subdomain without `www`, pass only `-d hub.YOUR_ACTUAL_DOMAIN.COM` and remove the `www.` server block in `/etc/nginx/sites-available/swiss-knife`).*

2. **Install the hardened `nginx.conf.example` vhost**:
   ```bash
   sudo cp /var/www/swiss-knife/nginx.conf.example /etc/nginx/sites-available/swiss-knife
   sudo sed -i 's/yourdomain.com/YOUR_ACTUAL_DOMAIN.COM/g' /etc/nginx/sites-available/swiss-knife
   sudo ln -sf /etc/nginx/sites-available/swiss-knife /etc/nginx/sites-enabled/swiss-knife
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **Add a Certbot post-renewal reload hook & test auto-renewal**:
   ```bash
   echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null
   sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
   sudo certbot renew --dry-run
   ```

### Option B: Caddy (Automatic HTTPS Alternative)
If you prefer Caddy instead of Nginx + Certbot (stop/disable `nginx` first so ports 80/443 are free):
```bash
sudo cp /var/www/swiss-knife/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/yourdomain.com/YOUR_ACTUAL_DOMAIN.COM/g' /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 🧹 Phase 7: GDPR Log-Retention Minimization & Privacy Hygiene

To protect visitor privacy and comply with data-minimization principles:
- **Application DB (`hub_db.json`)**: Stores zero raw visitor IP addresses; users can delete their own account and scores at any time from the Dashboard.
- **Nginx & Caddy Access Logs**: Both `nginx.conf.example` and `Caddyfile.example` mask visitor IP addresses before writing logs to disk (`/24` IPv4 / `/48` IPv6).
- **Container Logs**: Capped at `3 x 10MB` in `docker-compose.yml`.

On Ubuntu, shorten Nginx log retention from the default 14–52 weeks down to **7 days** by updating `/etc/logrotate.d/nginx`:
```bash
sudo sed -i 's/rotate [0-9]\+/rotate 7/' /etc/logrotate.d/nginx
sudo sed -i 's/weekly/daily/' /etc/logrotate.d/nginx
sudo logrotate -d /etc/logrotate.d/nginx
```

---

## 🎉 Phase 8: Verify Your App Online

1. Visit `https://YOUR_ACTUAL_DOMAIN.COM/` to open the Launchpad Dashboard and complete the Security Gateway challenge (or sign in).
2. Check `https://YOUR_ACTUAL_DOMAIN.COM/health` (`200 OK` JSON health summary).
3. Verify all 9 sub-applications launch from the Dashboard:
   - `/neon-orbit/`
   - `/star-locator/` *(served from `star_locator/dist`)*
   - `/chem-lab/`
   - `/chill-hub/`
   - `/shape-wars/`
   - `/sonic-soccer/`
   - `/nond_ex/`
   - `/alien-echo/`
   - `/pirate-fishing/`

> *Note:* Visiting any of the 9 sub-app URLs directly in a fresh private window **without** an active `z340_clearance` or `astra_session` cookie will intentionally return `302 Found` redirecting to `/?verify=required&app=...&redirect=...` — this confirms the Security Gateway is working.

---

## 🔄 Routine Maintenance, Dependency Audits & Backups

### Redeploying Code Updates (Docker)
```bash
cd /var/www/swiss-knife
git pull
docker compose up -d --build
```

### Auditing & Patching Dependencies (`npm audit` / `npm update`)
Periodically pull fresh base images and patch npm dependencies:
```bash
cd /var/www/swiss-knife

# Option 1 (Bare-metal / updating lockfiles prior to commit):
./deploy.sh --upgrade-deps --build-only

# Option 2 (Rebuild Docker image pulling latest patched node:22-alpine packages):
docker compose build --pull --no-cache
docker compose up -d
```
*(If running bare-metal with PM2 instead of Docker, run `./deploy.sh` or `./deploy.sh --upgrade-deps`, and install log rotation once via `pm2 install pm2-logrotate && pm2 set pm2-logrotate:retain 7`).*

### Backing Up the Persistent Database Volume
```bash
docker run --rm \
  -v swiss-knife_hub_data:/data:ro \
  -v "$(pwd)":/backup \
  alpine tar -czf /backup/hub-db-backup-$(date +%F).tar.gz -C /data .
```

### Useful Inspection Commands
| Task | Command |
| :--- | :--- |
| View live container logs | `docker compose logs -f --tail=100` |
| Check container health & status | `docker compose ps` |
| Audit root npm dependencies | `npm audit --omit=dev` |
| Check firewall rules | `sudo ufw status verbose` |
| Check Nginx config & status | `sudo nginx -t && sudo systemctl status nginx` |
