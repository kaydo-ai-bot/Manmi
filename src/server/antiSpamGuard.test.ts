import {
  formatUptimeDHM,
  checkAntiSpamCommand,
  isUserOptedOut,
  addOptOutUser,
  removeOptOutUser,
  getAllOptOutList,
  isDuplicateEventOrMessage,
  isBotSelfReplyOrEcho,
  tripCircuitBreaker,
  isCircuitBreakerActive,
  getBotMetrics,
  recordMessageSent,
  recordMessageFailed,
  recordMessageBlocked,
  recordErrorDetected,
} from './antiBanGuard';

console.log('🧪 [TEST SUITE] Démarrage des tests Anti-Spam & Fiabilité KAYDO BOT...');

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTests() {
  // Test 1: Uptime Formatter (Jour / Heure / Minute)
  console.log('\n--- Test 1: Formatage Uptime en Jour / Heure / Minute ---');
  const dhm = formatUptimeDHM(90060); // 1 day, 1 hour, 1 minute
  assert(dhm.includes('1 Jour') && dhm.includes('1 Heure') && dhm.includes('1 Minute'), 'Uptime formatte en Jour/Heure/Minute');

  // Test 2: Echo & Infinite Loop Detection
  console.log('\n--- Test 2: Détection Anti-Écho & Boucles Infinies ---');
  assert(isBotSelfReplyOrEcho('╭─❖━━━ ᴄᴏᴍᴍᴀɴᴅᴇ ━━━❖\n┇✦┋. Pong'), 'Détecte les signatures de réponse du bot');
  assert(isBotSelfReplyOrEcho('≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿'), 'Détecte le nom d\'en-tête du bot');
  assert(!isBotSelfReplyOrEcho('.ping'), 'Ne bloque pas une commande utilisateur valide');

  // Test 3: Duplicate Event & Message Replay Protection
  console.log('\n--- Test 3: Déduplication des Événements ---');
  const testMsgId = `test-dup-${Date.now()}`;
  assert(!isDuplicateEventOrMessage(testMsgId), 'Première occurrence acceptée');
  assert(isDuplicateEventOrMessage(testMsgId), 'Seconde occurrence identique immédiatement bloquée');

  // Test 4: Persistent Opt-Out / Désinscription Protection
  console.log('\n--- Test 4: Protection des Numéros & Liste de Désinscription ---');
  const testPhone = '50999998888';
  removeOptOutUser(testPhone); // Cleanup if exists
  assert(!isUserOptedOut(testPhone), 'Numéro non désinscrit au départ');
  
  const added = addOptOutUser(testPhone, 'Test unitaire');
  assert(added === true, 'Ajout à la liste de désinscription réussi');
  assert(isUserOptedOut(testPhone), 'Le numéro est désormais reconnu comme désinscrit');
  assert(isUserOptedOut(`${testPhone}@s.whatsapp.net`), 'Détecte aussi avec le suffixe @s.whatsapp.net');

  const removed = removeOptOutUser(testPhone);
  assert(removed === true, 'Retrait de la liste de désinscription réussi');
  assert(!isUserOptedOut(testPhone), 'Le numéro n\'est plus désinscrit');

  // Test 5: Command Rate Limiting & Cooldown
  console.log('\n--- Test 5: Limitation Intelligente des Commandes & Cadence ---');
  const userJid = '50912345678@s.whatsapp.net';
  const chatJid = '123456789-987654@g.us';
  
  const check1 = checkAntiSpamCommand(userJid, chatJid);
  assert(check1.allowed === true, 'Première commande autorisée');
  
  const check2 = checkAntiSpamCommand(userJid, chatJid);
  assert(check2.allowed === false, 'Deuxième commande immédiate rejetée par le cooldown utilisateur');

  // Test 6: Circuit Breaker Trigger & Cooldown
  console.log('\n--- Test 6: Circuit Breaker de Sécurité (Protection 429/403) ---');
  tripCircuitBreaker(2000, 'Test de restriction simulée');
  assert(isCircuitBreakerActive() === true, 'Circuit breaker actif après déclenchement');

  // Test 7: Metrics Aggregator
  console.log('\n--- Test 7: Agrégateur de Statistiques Réelles ---');
  recordMessageSent();
  recordMessageFailed('Simulation erreur');
  recordMessageBlocked('Test spam block');
  recordErrorDetected('Test error', 'SECURITY');
  
  const metrics = getBotMetrics(2);
  assert(metrics.messagesSent >= 1, 'messagesSent comptabilisé');
  assert(metrics.messagesFailed >= 1, 'messagesFailed comptabilisé');
  assert(metrics.messagesBlocked >= 1, 'messagesBlocked comptabilisé');
  assert(metrics.errorsDetected >= 1, 'errorsDetected comptabilisé');
  assert(metrics.activeSessions === 2, 'Nombre de sessions actives correctement reporté');

  console.log(`\n🎉 [RÉSULTAT TEST SUITE] Tous les tests ont réussi : ${passed}/${total} validés !`);
}

runTests().catch((e) => {
  console.error('❌ Échec critique test suite:', e);
  process.exit(1);
});
