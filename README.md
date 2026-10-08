# 👑 kaydo bot — Multi-Device WhatsApp & Telegram Bot (24/7)

Développé par **𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶**  
Architecture Cloud & Déploiement 24/7 (Railway / VPS)

---

## ⚡ Caractéristiques Principales
- 🌹 **Réaction Automatique :** Réagit instantanément avec l'emoji `🌹` à chaque commande reçue.
- 🖼️ **Photo Officielle Unique :** Envoi de l'avatar officiel Kaydo Bot avec les menus et commandes clés.
- 🔄 **Connexion Baileys Multi-Device 24/7 :** Reconnexion automatique instantanée (codes 515, gestion des déconnexions réseau), persistance PostgreSQL & fichiers locaux.
- 💬 **WhatsApp & Telegram Hybride :** Commandes WhatsApp (`.menu`, `.ping`, `.alive`, `.owner`, `.sticker`, etc.) et Telegram (`/start`, `/menu`, `/ping`, etc.).
- 🚀 **Prêt pour GitHub & Cloud :** Déployable en 1 clic sur VPS (PM2/Docker), Koyeb, Render, Railway, Heroku.

---

## 📦 Déploiement Rapide vers GitHub

Pour pousser votre projet sur GitHub :

```bash
# 1. Ajouter tous les fichiers
git add .

# 2. Créer le commit
git commit -m "feat: kaydo bot v4.5.0 official release 24/7"

# 3. Lier votre dépôt GitHub (remplacez par votre URL de dépôt)
git remote add origin https://github.com/VOTRE_NOM/kaydo-bot.git

# 4. Pousser vers GitHub
git branch -M main
git push -u origin main
```

---

## 🚀 Lancement 24/7 sur un Serveur (VPS / Cloud)

### Option 1 : Avec PM2 (Recommandé sur VPS)
```bash
# Installer PM2 si ce n'est pas fait
npm install -g pm2

# Compiler l'application
npm run build

# Démarrer le bot avec le superviseur PM2
pm2 start ecosystem.config.cjs

# Sauvegarder la persistance au redémarrage du serveur
pm2 save
pm2 startup
```

### Option 2 : Avec Docker
```bash
docker build -t kaydo-bot .
docker run -d --name kaydo-bot -p 3000:3000 -v $(pwd)/sessions:/app/sessions kaydo-bot
```

### Option 3 : En local / Node direct
```bash
npm install
npm run dev
```

---

## ⚙️ Variables d'Environnement (.env)

Créez un fichier `.env` à la racine (ou définissez ces variables sur votre hébergeur) :

```env
PORT=3000
NODE_ENV=production

# Telegram (Optionnel)
TELEGRAM_BOT_TOKEN=VOTRE_TOKEN_TELEGRAM_ICI

# Base de données PostgreSQL (Optionnel pour haute disponibilité multi-serveurs)
DATABASE_URL=
```

---

## 🌹 Commandes WhatsApp Rapides
- `.menu` : Affiche le menu complet officiel avec la photo de Kaydo Bot.
- `.ping` : Teste la vitesse instantanée (0.0s).
- `.alive` : Vérifie l'état opérationnel 24h/24 & 7j/7.
- `.owner` : Envoie la fiche contact officielle de 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶.
- `.sticker` : Transforme une photo en autocollant WhatsApp.
- `.mode public` / `.mode private` : Bascule entre mode public et privé.

® 2026 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶 — Tous droits réservés.
