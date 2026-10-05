import { BotCommand } from '../types';

export const COMMAND_CATEGORIES = [
  { id: 'all', name: 'Toutes', icon: 'Sparkles', count: 289 },
  { id: 'main', name: '🏠 Main', icon: 'Home', count: 23 },
  { id: 'moderation', name: '🛡️ Moderation', icon: 'Shield', count: 22 },
  { id: 'owner', name: '👑 Owner', icon: 'Crown', count: 14 },
  { id: 'media', name: '🎵 Media', icon: 'Music', count: 9 },
  { id: 'fun', name: '😂 Fun', icon: 'Smile', count: 13 },
  { id: 'anime', name: '👾 Anime', icon: 'Ghost', count: 9 },
  { id: 'textmaker', name: '🖋️ Textmaker', icon: 'PenTool', count: 18 },
] as const;

export const BOT_COMMANDS: BotCommand[] = [
  // MAIN - Incluant nouvelles commandes exclusives
  { name: 'vv', prefix: '.', category: 'main', description: 'Extrait et renvoie le média à vue unique (photo/vidéo) directement dans la discussion actuelle (contact ou groupe).', usage: '.vv [répondre à un média vue unique]', example: '.vv' },
  { name: 'vv2', prefix: '.', category: 'main', description: 'Extrait et envoie le média à vue unique discrètement sur le contact personnel de l\'utilisateur (en privé).', usage: '.vv2 [répondre à un média vue unique]', example: '.vv2' },
  { name: 'autolike', prefix: '.', category: 'main', description: 'Like et réagit automatiquement aux statuts WhatsApp de tous vos contacts à l\'instant même de publication avec l\'émoji voulu.', usage: '.autolike <emoji>', example: '.autolike ❤️' },
  { name: 'online', prefix: '.', category: 'main', description: 'Maintient la présence "En ligne" (Always Online) 24/7. Dès qu\'un contact vous écrit, il voit que vous êtes en ligne même si vous êtes déconnecté.', usage: '.online on/off', example: '.online on' },
  { name: 'autorecording', prefix: '.', category: 'main', description: 'Affiche en direct "En train d\'enregistrer un message vocal..." dès qu\'un contact vous envoie un message.', usage: '.autorecording on/off', example: '.autorecording on' },
  { name: 'autotyping', prefix: '.', category: 'main', description: 'Affiche en direct "En train d\'écrire..." (durée à jamais permanent) dès qu\'un contact vous envoie un message.', usage: '.autotyping on/off ou .autotyping=', example: '.autotyping=' },
  { name: 'getpp', prefix: '.', category: 'main', description: 'Télécharge la photo de profil d\'un contact WhatsApp ciblé.', usage: '.getpp [@tag / numéro]' },
  { name: 'groupinfo', prefix: '.', category: 'main', description: 'Donne les statistiques détaillées du groupe WhatsApp en cours.', usage: '.groupinfo' },
  { name: 'groupstats', prefix: '.', category: 'main', description: 'Rapport complet d\'activité et membres les plus actifs.', usage: '.groupstats' },
  { name: 'list', prefix: '.', category: 'main', description: 'Affiche la liste récapitulative des modules actifs du bot.', usage: '.list' },
  { name: 'menu', prefix: '.', category: 'main', description: 'Affiche le menu complet interactif avec toutes les sections.', usage: '.menu' },
  { name: 'owner', prefix: '.', category: 'main', description: 'Envoie le contact WhatsApp officiel (+509 3597 5863) du propriétaire 𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶.', usage: '.owner' },
  { name: 'ping', prefix: '.', category: 'main', description: 'Teste la vitesse de réaction et la latence du serveur en millisecondes.', usage: '.ping' },
  { name: 'qr', prefix: '.', category: 'main', description: 'Convertit n\'importe quel texte ou lien web en QR Code scannable.', usage: '.qr <texte ou URL>' },
  { name: 'simage', prefix: '.', category: 'main', description: 'Convertit un autocollant (sticker) en image standard téléchargeable.', usage: '.simage [répondre au sticker]' },
  { name: 'sticker', prefix: '.', category: 'main', description: 'Transforme n\'importe quelle photo ou vidéo courte en sticker WhatsApp.', usage: '.sticker [avec image]' },
  { name: 'take', prefix: '.', category: 'main', description: 'Modifie le nom de pack et l\'auteur d\'un sticker personnalisé.', usage: '.take <packname> | <author>' },
  { name: 'uptime', prefix: '.', category: 'main', description: 'Affiche le temps de fonctionnement ininterrompu du bot.', usage: '.uptime' },

  // MODERATION (21)
  { name: 'antigroupmention', prefix: '.', category: 'moderation', description: 'Bloque et sanctionne les mentions massives non autorisées.', usage: '.antigroupmention on/off', adminOnly: true },
  { name: 'antilink', prefix: '.', category: 'moderation', description: 'Supprime automatiquement les liens WhatsApp et expulse les spammeurs.', usage: '.antilink on/off', adminOnly: true },
  { name: 'antimessage', prefix: '.', category: 'moderation', description: 'Supprime automatiquement TOUS les messages (liens, stickers, textes, médias) envoyés dans le groupe.', usage: '.antimessage on/off ou .antimessage=', adminOnly: true },
  { name: 'antisticker', prefix: '.', category: 'moderation', description: 'Supprime automatiquement tous les stickers envoyés par les membres dans le groupe.', usage: '.antisticker on/off ou .antisticker=', adminOnly: true },
  { name: 'antitag', prefix: '.', category: 'moderation', description: 'Protection contre le tag intempestif des membres du groupe.', usage: '.antitag on/off', adminOnly: true },
  { name: 'autosticker', prefix: '.', category: 'moderation', description: 'Convertit automatiquement chaque image reçue en sticker.', usage: '.autosticker on/off', adminOnly: true },
  { name: 'clean', prefix: '.', category: 'moderation', description: 'Nettoie les messages de spam et les traces de commandes.', usage: '.clean <nombre>', adminOnly: true },
  { name: 'delete', prefix: '.', category: 'moderation', description: 'Supprime immédiatement le message ciblé pour tout le monde.', usage: '.delete [répondre]', adminOnly: true },
  { name: 'demote', prefix: '.', category: 'moderation', description: 'Rétrograde un administrateur en simple membre.', usage: '.demote @membre', adminOnly: true },
  { name: 'goodbye', prefix: '.', category: 'moderation', description: 'Active ou désactive le message d\'adieu automatique.', usage: '.goodbye on/off', adminOnly: true },
  { name: 'grouplink', prefix: '.', category: 'moderation', description: 'Récupère le lien d\'invitation officiel du groupe.', usage: '.grouplink', adminOnly: true },
  { name: 'groupstatus', prefix: '.', category: 'moderation', description: 'Affiche le statut de toutes les protections activées.', usage: '.groupstatus' },
  { name: 'hidetag', prefix: '.', category: 'moderation', description: 'Envoie un message en taguant discrètement tous les membres.', usage: '.hidetag <annonce>', adminOnly: true },
  { name: 'kick', prefix: '.', category: 'moderation', description: 'Expulse un membre indésirable du groupe WhatsApp.', usage: '.kick @membre', adminOnly: true },
  { name: 'kickall', prefix: '.', category: 'moderation', description: 'Expulse d\'un seul coup tous les membres non-administrateurs du groupe avec protection cadence.', usage: '.kickall', example: '.kickall', adminOnly: true },
  { name: 'mute', prefix: '.', category: 'moderation', description: 'Ferme le groupe: seuls les administrateurs peuvent envoyer des messages.', usage: '.mute', adminOnly: true },
  { name: 'promote', prefix: '.', category: 'moderation', description: 'Nomme un membre au statut d\'administrateur du groupe.', usage: '.promote @membre', adminOnly: true },
  { name: 'resetwarn', prefix: '.', category: 'moderation', description: 'Remet à zéro tous les avertissements d\'un membre.', usage: '.resetwarn @membre', adminOnly: true },
  { name: 'setgoodbye', prefix: '.', category: 'moderation', description: 'Personnalise le message affiché lors du départ d\'un membre.', usage: '.setgoodbye <texte>', adminOnly: true },
  { name: 'setwelcome', prefix: '.', category: 'moderation', description: 'Configure le message de bienvenue avec tags dynamiques.', usage: '.setwelcome <texte>', adminOnly: true },
  { name: 'tagall', prefix: '.', category: 'moderation', description: 'Mentionne tous les membres du groupe avec une annonce.', usage: '.tagall <message>', adminOnly: true },
  { name: 'unmute', prefix: '.', category: 'moderation', description: 'Rouvre le groupe: tous les membres peuvent écrire à nouveau.', usage: '.unmute', adminOnly: true },
  { name: 'warn', prefix: '.', category: 'moderation', description: 'Donne un avertissement (3 avertissements = expulsion automatique).', usage: '.warn @membre', adminOnly: true },
  { name: 'welcome', prefix: '.', category: 'moderation', description: 'Active ou désactive l\'accueil automatique des nouveaux arrivants.', usage: '.welcome on/off', adminOnly: true },

  // OWNER (15)
  { name: 'anticall', prefix: '.', category: 'owner', description: 'Refuse et bloque automatiquement les appels WhatsApp entrants.', usage: '.anticall on/off', ownerOnly: true },
  { name: 'antidelete', prefix: '.', category: 'owner', description: 'Active ou désactive la protection anti-suppression des messages et statuts.', usage: '.antidelete on/off', ownerOnly: true },
  { name: 'autoreact', prefix: '.', category: 'owner', description: 'Réagit avec des émojis automatiques sur certains messages.', usage: '.autoreact on/off', ownerOnly: true },
  { name: 'block', prefix: '.', category: 'owner', description: 'Bloque un numéro WhatsApp directement depuis le bot.', usage: '.block @contact', ownerOnly: true },
  { name: 'broadcast', prefix: '.', category: 'owner', description: 'Diffuse un message d\'annonce à tous les groupes où est présent le bot.', usage: '.broadcast <message>', ownerOnly: true },
  { name: 'mode', prefix: '.', category: 'owner', description: 'Bascule le bot en mode Public ou Privé (seul l\'owner peut commander).', usage: '.mode public/private', ownerOnly: true },
  { name: 'newcommand', prefix: '.', category: 'owner', description: 'Crée une nouvelle commande personnalisée pour votre bot.', usage: '.newcommand <nom> | <réponse>', ownerOnly: true },
  { name: 'setbotpp', prefix: '.', category: 'owner', description: 'Met à jour la photo de profil du bot (isolé pour votre session).', usage: '.setbotpp [répondre à une image]', ownerOnly: true },
  { name: 'mycommands', prefix: '.', category: 'owner', description: 'Liste toutes vos commandes personnalisées créées.', usage: '.mycommands', ownerOnly: true },
  { name: 'setprefix', prefix: '.', category: 'owner', description: 'Modifie le préfixe de commande (par défaut .)', usage: '.setprefix <symbole>', ownerOnly: true },
  { name: 'unblock', prefix: '.', category: 'owner', description: 'Débloque un utilisateur WhatsApp préalablement banni.', usage: '.unblock @contact', ownerOnly: true },

  // MEDIA (9)
  { name: 'facebook', prefix: '.', category: 'media', description: 'Télécharge une vidéo Facebook HD à partir d\'un lien public.', usage: '.facebook <URL>' },
  { name: 'igs', prefix: '.', category: 'media', description: 'Télécharge une Story Instagram publique sans filigrane.', usage: '.igs <username>' },
  { name: 'igsc', prefix: '.', category: 'media', description: 'Télécharge le son ou la musique d\'un Reel Instagram.', usage: '.igsc <URL>' },
  { name: 'instagram', prefix: '.', category: 'media', description: 'Télécharge les photos et vidéos d\'un post Instagram.', usage: '.instagram <URL>' },
  { name: 'lyrics', prefix: '.', category: 'media', description: 'Recherche les paroles complètes synchronisées d\'une chanson.', usage: '.lyrics <titre - artiste>' },
  { name: 'pinterest', prefix: '.', category: 'media', description: 'Recherche et extrait des photos d\'inspiration haute résolution.', usage: '.pinterest <mots-clés>' },
  { name: 'song', prefix: '.', category: 'media', description: 'Recherche et télécharge une piste audio MP3 YouTube haute qualité.', usage: '.song <nom du morceau>' },
  { name: 'tiktok', prefix: '.', category: 'media', description: 'Télécharge une vidéo TikTok sans filigrane (No Watermark).', usage: '.tiktok <URL>' },
  { name: 'ytvideo', prefix: '.', category: 'media', description: 'Télécharge une vidéo YouTube MP4 en 720p ou 1080p.', usage: '.ytvideo <URL ou titre>' },

  // FUN (13)
  { name: 'bomb', prefix: '.', category: 'fun', description: 'Mini-jeu de désamorçage de bombe avec choix sous tension.', usage: '.bomb' },
  { name: 'compliment', prefix: '.', category: 'fun', description: 'Génère un compliment chaleureux pour un ami ou vous-même.', usage: '.compliment [@tag]' },
  { name: 'dare', prefix: '.', category: 'fun', description: 'Génère un défi action pour animer les soirées de groupe.', usage: '.dare' },
  { name: 'flirt', prefix: '.', category: 'fun', description: 'Phrase d\'accroche et disquette de séduction percutante.', usage: '.flirt' },
  { name: 'gayrate', prefix: '.', category: 'fun', description: 'Jauge humoristique aléatoire de pourcentage.', usage: '.gayrate [@tag]' },
  { name: 'insult', prefix: '.', category: 'fun', description: 'Génère un clash humoristique gentillet pour taquiner un ami.', usage: '.insult [@tag]' },
  { name: 'joke', prefix: '.', category: 'fun', description: 'Raconte une blague hilarante.', usage: '.joke' },
  { name: 'meme', prefix: '.', category: 'fun', description: 'Envoie un mème internet populaire et tendance.', usage: '.meme' },
  { name: 'memesearch', prefix: '.', category: 'fun', description: 'Recherche un mème par mot-clé thématique.', usage: '.memesearch <sujet>' },
  { name: 'pies', prefix: '.', category: 'fun', description: 'Jeu amusant de la tarte au visage virtuelle.', usage: '.pies [@tag]' },
  { name: 'ship', prefix: '.', category: 'fun', description: 'Calcule le taux de compatibilité amoureuse entre deux personnes.', usage: '.ship @user1 @user2' },
  { name: 'tictactoe', prefix: '.', category: 'fun', description: 'Lance une partie de Morpion interactive directement dans le chat.', usage: '.tictactoe [@ami]' },
  { name: 'truth', prefix: '.', category: 'fun', description: 'Vérité du jeu Action ou Vérité (Truth or Dare).', usage: '.truth' },

  // ANIME (9)
  { name: 'hneko', prefix: '.', category: 'anime', description: 'Image animée neko stylisée.', usage: '.hneko' },
  { name: 'hwaifu', prefix: '.', category: 'anime', description: 'Illustration waifu manga.', usage: '.hwaifu' },
  { name: 'konachan', prefix: '.', category: 'anime', description: 'Fonds d\'écran anime haute résolution tirés de Konachan.', usage: '.konachan <tag>' },
  { name: 'loli', prefix: '.', category: 'anime', description: 'Illustration mignonne chibi anime.', usage: '.loli' },
  { name: 'megumin', prefix: '.', category: 'anime', description: 'Image exclusive du personnage Megumin (Konosuba).', usage: '.megumin' },
  { name: 'milf', prefix: '.', category: 'anime', description: 'Image anime stylisée thématique mature.', usage: '.milf' },
  { name: 'neko', prefix: '.', category: 'anime', description: 'Personnage manga avec des oreilles et queue de chat.', usage: '.neko' },
  { name: 'random', prefix: '.', category: 'anime', description: 'Image anime aléatoire tirée d\'une base de plus de 50 000 visuels.', usage: '.random' },
  { name: 'waifu', prefix: '.', category: 'anime', description: 'Génère une image waifu anime esthétique.', usage: '.waifu' },

  // TEXTMAKER (18)
  { name: '1917', prefix: '.', category: 'textmaker', description: 'Effet textuel cinématique style affiche de guerre 1917.', usage: '.1917 <texte>' },
  { name: 'arena', prefix: '.', category: 'textmaker', description: 'Effet de logo gladiateur arène de combat épique.', usage: '.arena <texte>' },
  { name: 'blackpink', prefix: '.', category: 'textmaker', description: 'Typographie rose et noir style groupe K-Pop Blackpink.', usage: '.blackpink <texte>' },
  { name: 'devil', prefix: '.', category: 'textmaker', description: 'Logo diabolique avec cornes et effets de flammes sombres.', usage: '.devil <texte>' },
  { name: 'fire', prefix: '.', category: 'textmaker', description: 'Texte embrasé avec flammes réalistes et étincelles.', usage: '.fire <texte>' },
  { name: 'glitch', prefix: '.', category: 'textmaker', description: 'Effet cybernétique glitch RVB décalé futuriste.', usage: '.glitch <texte>' },
  { name: 'hacker', prefix: '.', category: 'textmaker', description: 'Écran de terminal hacker vert émeraude matrix.', usage: '.hacker <texte>' },
  { name: 'ice', prefix: '.', category: 'textmaker', description: 'Lettres sculptées dans de la glace givrée arctique.', usage: '.ice <texte>' },
  { name: 'impressive', prefix: '.', category: 'textmaker', description: 'Typographie 3D luxueuse argent et or poli.', usage: '.impressive <texte>' },
  { name: 'leaves', prefix: '.', category: 'textmaker', description: 'Texte végétal organique orné de feuilles de forêt.', usage: '.leaves <texte>' },
  { name: 'light', prefix: '.', category: 'textmaker', description: 'Effet de faisceau lumineux néon brillant et reflets.', usage: '.light <texte>' },
  { name: 'matrix', prefix: '.', category: 'textmaker', description: 'Pluie de code vert numérique Matrix avec votre nom.', usage: '.matrix <texte>' },
  { name: 'metallic', prefix: '.', category: 'textmaker', description: 'Finition métal brossé chromé industriel.', usage: '.metallic <texte>' },
  { name: 'neon', prefix: '.', category: 'textmaker', description: 'Enseigne néon lumineuse cyberpunk de nuit.', usage: '.neon <texte>' },
  { name: 'purple', prefix: '.', category: 'textmaker', description: 'Dégradé violet néon synthwave rétro 80s.', usage: '.purple <texte>' },
  { name: 'sand', prefix: '.', category: 'textmaker', description: 'Texte tracé dans le sable doré d\'une plage désertique.', usage: '.sand <texte>' },
  { name: 'snow', prefix: '.', category: 'textmaker', description: 'Lettres enneigées avec flocons tombants d\'hiver.', usage: '.snow <texte>' },
  { name: 'thunder', prefix: '.', category: 'textmaker', description: 'Éclairs bleutés foudroyants traversant votre texte.', usage: '.thunder <texte>' },
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    timestamp: '2026-09-06 13:20:14',
    type: 'SYSTEM_INFO' as const,
    level: 'info' as const,
    title: 'Serveur KAYDO BOT Initialisé',
    message: 'Passerelle WhatsApp Web multi-device active sur le port 3000. Protocol Signal v3 prêt.',
    read: false,
  },
  {
    id: 'notif-2',
    timestamp: '2026-09-06 13:22:05',
    type: 'AUTH_ALERT' as const,
    level: 'success' as const,
    title: 'Système de Sécurité Chiffré Actif',
    message: 'Chiffrement de bout en bout (E2EE) synchronisé. Surveillance des clés de session démarrée pour KAYDO BOT.',
    read: false,
  },
  {
    id: 'notif-3',
    timestamp: '2026-09-06 13:25:40',
    type: 'PAIRING_REQUEST' as const,
    level: 'warning' as const,
    title: 'Demande de Jumelage Détectée',
    message: 'Module de génération de code officiel en attente de numéro WhatsApp pour liaison sécurisée.',
    read: false,
  }
];

export const BOT_HEADER_ASCII = `*╭─━━━━━━━━━━━━━━━⊷❖*
*┇*🔹╭───────────────╮
┋🔹┋. ʙᴏᴛ ɴᴀᴍᴇ: ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿
┋🔹┋. ᴄᴏᴍᴍᴀɴᴅs: 300+
┋🔹┋. ᴏᴡɴᴇʀ: ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & ≛⃝🥷🏿 𝐒𝐇𝐀𝐊𝐀 ≛⃝🥷🏿
┋🔹┋. ᴘʟᴀᴛғᴏʀᴍ: Railway / Linux
┋🔹┋. ᴍᴏᴅᴇ: ᴘʀɪᴠᴇ́ 🔒 / ᴘᴜʙʟɪᴄ 🟢
*┇🔹╰───────────────╯*
*╰━━━━━━━━━━━━━━━━━❖*`;

export const BOT_FOOTER_ASCII = `*╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ®2026 © CREATED FOR ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & ≛⃝🥷🏿 𝐒𝐇𝐀𝐊𝐀 ≛⃝🥷🏿
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*`;
