# 🚀 Complete Zero-to-Production VPS Deployment Guide
### For Swiss Knife Hub (`my-swiss-knife`)

This guide walks you through setting up a brand-new Linux VPS (Ubuntu 22.04 or 24.04 LTS) from scratch, pointing your domain name, securing it with free SSL (HTTPS), and deploying the containerized Swiss Knife Hub.

---

## 📋 Overview of What You Need
1. **A VPS** (Ubuntu 22.04 / 24.04 from DigitalOcean, Hetzner, Linode, AWS EC2, or Vultr).
2. **VPS Public IPv4 Address** (e.g. `123.45.67.89`).
3. **A Domain Name** (e.g. `example.com` or `hub.example.com`).

---

## 🌐 Phase 1: Point Your Domain to the VPS (DNS)

Before configuring the server, point your domain to your VPS IP address in your domain registrar's DNS manager (Cloudflare, Namecheap, GoDaddy, Porkbun, etc.):

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_VPS_IP` | Automatic (or 300s) |
| **A** | `www` | `YOUR_VPS_IP` | Automatic (or 300s) |

> *If using a subdomain like `hub.yourdomain.com`, set Host to `hub` and Target to `YOUR_VPS_IP`.*

Verify DNS has propagated (run in PowerShell on your local machine):
```powershell
nslookup yourdomain.com
```
When it returns your VPS IP address, you are ready to proceed.

---

## 💻 Phase 2: First-Time Server Login & Hardening

### 1. SSH into your VPS
From your terminal or PowerShell:
```bash
ssh root@YOUR_VPS_IP
```

### 2. Update Linux packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Setup Swap Memory (Crucial Step!)
The Swiss Knife Hub compiles **9 separate Vite frontend applications** during the build. If your server has 1GB or 2GB RAM, the build will trigger Linux's Out-Of-Memory (OOM) killer without swap. Run these commands to add 2GB of virtual swap memory:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. Enable UFW Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

## 📦 Phase 3: Install Docker, Nginx & Certbot

Run this block to install the official modern Docker engine, Docker Compose plugin, Nginx, and Certbot:

```bash
# 1. Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release git

# 2. Add Docker's official GPG key & repo
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker & Nginx & Certbot
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin nginx certbot python3-certbot-nginx

# 4. Enable services
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
```

Verify Docker works:
```bash
docker --version
docker compose version
```

---

## 📂 Phase 4: Put Your Code onto the Server

### 1. Create directory
```bash
sudo mkdir -p /var/www/swiss-knife
sudo chown -R $USER:$USER /var/www/swiss-knife
cd /var/www/swiss-knife
```

### 2. Transfer your code

#### Method A: Clone via Git (Recommended)
If your repository is on GitHub / GitLab:
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git .
```

#### Method B: Upload directly from your local computer
Run this command from **PowerShell on your Windows machine**:
```powershell
scp -r c:\Users\mamut\Desktop\data\my_app\* root@YOUR_VPS_IP:/var/www/swiss-knife/
```

### 3. Create your production `.env` file on the VPS
Inside `/var/www/swiss-knife`:
```bash
cp .env.example .env
nano .env
```
Set your actual domain name:
```env
PORT=3000
NODE_ENV=production
DOMAIN=yourdomain.com
```
*(Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit nano).*

---

## 🚢 Phase 5: Build & Run the App with Docker

Start the containerized app in the background:
```bash
cd /var/www/swiss-knife
docker compose up -d --build
```
*(The initial build will install dependencies and compile all 9 sub-apps. This can take 2–4 minutes).*

### Verify the container is running:
```bash
docker compose ps
```
You should see `swiss-knife-hub` running with status `healthy` or `Up`.

Test local communication:
```bash
curl http://localhost:3000/health
```
It should return:
```json
{"status":"healthy","uptime":...}
```

---

## 🌐 Phase 6: Configure Nginx as Reverse Proxy

Nginx will receive traffic from the internet on ports 80/443 and securely proxy it to your Docker container on port 3000.

### 1. Copy the prepared Nginx configuration
```bash
sudo cp /var/www/swiss-knife/nginx.conf.example /etc/nginx/sites-available/swiss-knife
```

### 2. Replace the placeholder domain with your real domain
Run this single command (replace `yourdomain.com` with your actual domain):
```bash
sudo sed -i 's/yourdomain.com/YOUR_ACTUAL_DOMAIN.COM/g' /etc/nginx/sites-available/swiss-knife
```

### 3. Enable the site and disable default Nginx welcome page
```bash
sudo ln -s /etc/nginx/sites-available/swiss-knife /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 4. Test and reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 Phase 7: Secure with Free SSL Certificate (HTTPS)

Run Certbot to request a free Let's Encrypt SSL certificate and configure HTTPS:

```bash
sudo certbot --nginx -d YOUR_ACTUAL_DOMAIN.COM -d www.YOUR_ACTUAL_DOMAIN.COM
```
*(If you only configured a root domain or subdomain, only pass the `-d` flags for the names that exist).*

Follow the prompts:
- Enter your email address.
- Agree to terms (`Y`).
- Choose whether to share your email (`N` or `Y`).

Certbot will automatically install the certificate, enable SSL, and redirect HTTP to HTTPS.

### Test auto-renewal:
Certbot sets up automatic renewal. Test it with:
```bash
sudo certbot renew --dry-run
```

---

## 🎉 Phase 8: Verify Your App Online!

Open your browser and visit:
```text
https://YOUR_ACTUAL_DOMAIN.COM/
```

You can also test the direct routes:
- `https://YOUR_ACTUAL_DOMAIN.COM/chill-hub/`
- `https://YOUR_ACTUAL_DOMAIN.COM/neon-orbit/`
- `https://YOUR_ACTUAL_DOMAIN.COM/star-locator/`
- `https://YOUR_ACTUAL_DOMAIN.COM/chem-lab/`
- `https://YOUR_ACTUAL_DOMAIN.COM/shape-wars/`
- `https://YOUR_ACTUAL_DOMAIN.COM/sonic-soccer/`
- `https://YOUR_ACTUAL_DOMAIN.COM/nond_ex/`
- `https://YOUR_ACTUAL_DOMAIN.COM/alien-echo/`
- `https://YOUR_ACTUAL_DOMAIN.COM/pirate-fishing/`
- `https://YOUR_ACTUAL_DOMAIN.COM/health`

---

## 🔄 Routine Maintenance & Updates

Whenever you make changes to the code in the future, redeploying takes just 2 commands:

```bash
cd /var/www/swiss-knife
git pull
docker compose up -d --build
```
Docker will recompile the modified sub-apps and hot-swap the container with zero downtime for Nginx.

### Useful Server Inspection Commands
| Task | Command |
| :--- | :--- |
| View live app logs | `docker compose logs -f` |
| Restart the app container | `docker compose restart` |
| View server RAM usage | `free -h` |
| View disk usage | `df -h` |
| Check Nginx status | `sudo systemctl status nginx` |

