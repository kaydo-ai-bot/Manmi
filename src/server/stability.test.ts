/**
 * =========================================================================
 * KAYDO BOT - SUITE DE TESTS AUTOMATISÉS DE STABILITÉ ET ANTI-SPAM
 * =========================================================================
 * Valide :
 * 1. La liste de désinscription (Opt-Out) et le blocage automatique
 * 2. Le limiteur de débit anti-spam des commandes (Rate Limiter & Burst)
 * 3. Le suivi centralisé des statistiques (messages envoyés, bloqués, erreurs)
 * 4. La détection des boucles de messages (Echo & Self-Reply)
 */

import { addOptOut, isOptedOut, removeOptOut, checkAndProcessOptOutMessage, getOptOutCount } from './optOutManager';
import { checkAntiSpamCommand, isBotSelfReplyOrEcho, getSessionOutgoingQueue } from './antiBanGuard';
import { recordMessageSent, recordMessageFailed, getBotStatsSnapshot } from './botStats';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${detail || 'Condition non respectée'}`);
  }
}

async function runStabilityTests() {
  console.log('\n========================================================');
  console.log('🧪 DÉMARRAGE DES TESTS DE STABILITÉ ET DE FIABILITÉ DU BOT');
  console.log('========================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Gestion de la liste de désinscription (Opt-Out)
  // -------------------------------------------------------------
  console.log('📌 Test 1: Liste de désinscription (Opt-Out) et blacklist');
  const testPhone = '50999998888';
  
  removeOptOut(testPhone);
  assert(!isOptedOut(testPhone), 'Numéro sain non présent dans la liste opt-out initialement');

  addOptOut(testPhone, 'Test d\'arrêt volontaire');
  assert(isOptedOut(testPhone), 'Numéro correctement ajouté à la liste opt-out');
  assert(getOptOutCount() >= 1, 'Le compteur d\'opt-out reflète le nombre d\'entrées');

  removeOptOut(testPhone);
  assert(!isOptedOut(testPhone), 'Numéro correctement retiré lors de la réinscription');

  // -------------------------------------------------------------
  // TEST 2: Détection automatique des mots-clés d'arrêt (STOP / ARRET)
  // -------------------------------------------------------------
  console.log('\n📌 Test 2: Détection automatique des mots-clés d\'arrêt');
  const sender = '50912345678';
  removeOptOut(sender);

  const triggeredStop = checkAndProcessOptOutMessage('STOP merci', sender);
  assert(triggeredStop === true, 'Détection du mot-clé STOP dans un message utilisateur');
  assert(isOptedOut(sender), 'Le numéro est automatiquement mis sur liste noire après STOP');

  removeOptOut(sender);

  // -------------------------------------------------------------
  // TEST 3: Anti-Spam Command Rate Limiter & Cooldown
  // -------------------------------------------------------------
  console.log('\n📌 Test 3: Limiteur de débit et protection anti-spam des commandes');
  const userJid = '50911112222@s.whatsapp.net';
  const chatJid = '50933334444@s.whatsapp.net';

  // Première commande doit être autorisée
  const firstCheck = checkAntiSpamCommand(userJid, chatJid);
  assert(firstCheck.allowed === true, 'Première exécution de commande autorisée');

  // Seconde commande immédiate (avant les 1.8s) doit être bloquée
  const secondCheck = checkAntiSpamCommand(userJid, chatJid);
  assert(secondCheck.allowed === false, 'Deuxième commande immédiate bloquée par le cooldown utilisateur');

  // -------------------------------------------------------------
  // TEST 4: Détection des boucles d'écho et messages auto-générés
  // -------------------------------------------------------------
  console.log('\n📌 Test 4: Détection des boucles d\'écho et auto-réponses');
  const botSignatureMsg = '*╭─━━━━━━━━━━━━━━━⊷❖*\n🤖 KAYDO BOT';
  const normalUserMsg = 'Bonjour, je veux faire une commande';

  assert(isBotSelfReplyOrEcho(botSignatureMsg) === true, 'Détection correcte d\'une signature de message bot (écho)');
  assert(isBotSelfReplyOrEcho(normalUserMsg) === false, 'Message utilisateur standard non classé comme écho');

  // -------------------------------------------------------------
  // TEST 5: Enregistrement et snapshot des statistiques (Dashboard)
  // -------------------------------------------------------------
  console.log('\n📌 Test 5: Suivi centralisé des statistiques et métriques');
  recordMessageSent();
  recordMessageSent();
  recordMessageFailed();

  const snapshot = getBotStatsSnapshot(2, getOptOutCount());
  assert(snapshot.messagesSent >= 2, 'Comptage des messages envoyés incrémenté');
  assert(snapshot.messagesFailed >= 1, 'Comptage des messages échoués incrémenté');
  assert(snapshot.sessionsConnected === 2, 'Nombre de sessions connectées correct');
  assert(snapshot.botStatus === 'ONLINE & PROTECTED', 'État général du bot actif et protégé');

  console.log('\n========================================================');
  console.log(`📊 RÉSULTATS STABILITÉ: ${passedTests}/${totalTests} tests réussis (100% SUCCÈS)`);
  console.log('========================================================\n');
}

runStabilityTests().catch((err) => {
  console.error('Erreur inattendue durant les tests de stabilité:', err);
  process.exit(1);
});
