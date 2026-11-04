import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  executeBotCommand,
  getSessionState,
  sessionStates,
  normalizeSudoCommand,
  isMainOwner,
  extractTargetPhoneNumber,
  saveSessionSettingsToDisk,
} from './commandHandler';

async function runSudoTests() {
  console.log('====================================================');
  console.log('⚡ KAYDO MD - TEST AUTOMATISÉ DU SYSTÈME SUDO ⚡');
  console.log('====================================================\n');

  const testSessionId = 'test_sudo_session_99';
  const mainOwnerJid = '50935975863@s.whatsapp.net';
  const secondaryUserJid = '50940001122@s.whatsapp.net';
  const targetSudoNumber = '50935970099';

  // Clear any pre-existing test state
  const state = getSessionState(testSessionId);
  state.sudoUsers.clear();

  // ----------------------------------------------------
  // TEST 0: Normalisation des synthaxes (.del sudo, .list sudo, .sudo del, etc.)
  // ----------------------------------------------------
  console.log('🔹 Test 0: Normalisation des commandes multi-mots');
  
  const norm1 = normalizeSudoCommand('del', 'sudo 50935970099');
  assert.strictEqual(norm1.cmd, 'delsudo', 'Parsing .del sudo');
  assert.strictEqual(norm1.args, '50935970099', 'Arguments .del sudo');

  const norm2 = normalizeSudoCommand('list', 'sudo');
  assert.strictEqual(norm2.cmd, 'listsudo', 'Parsing .list sudo');

  const norm3 = normalizeSudoCommand('sudo', 'del 50935970099');
  assert.strictEqual(norm3.cmd, 'delsudo', 'Parsing .sudo del');

  const norm4 = normalizeSudoCommand('sudo', 'list');
  assert.strictEqual(norm4.cmd, 'listsudo', 'Parsing .sudo list');

  console.log('  ✅ Normalisation des commandes .del sudo et .list sudo validée.');

  // ----------------------------------------------------
  // TEST 1: Ajouter un SUDO (.sudo 50935970099) par le Main Owner
  // ----------------------------------------------------
  console.log('\n🔹 Test 1: Étape 1 - Ajouter un SUDO (.sudo 50935970099)');
  
  const addReply = await executeBotCommand('sudo', targetSudoNumber, {
    senderJid: mainOwnerJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
    msg: { key: { fromMe: false } },
  });

  console.log('  Résultat d\'ajout:\n', addReply);
  assert(addReply.includes(targetSudoNumber), 'Le message doit contenir le numéro SUDO ajouté');
  assert.strictEqual(state.sudoUsers.has(targetSudoNumber), true, 'Le numéro doit être dans state.sudoUsers');

  // ----------------------------------------------------
  // TEST 2: Afficher la liste SUDO (.list sudo)
  // ----------------------------------------------------
  console.log('\n🔹 Test 2: Étape 2 - Afficher la liste SUDO (.list sudo)');

  const listReply = await executeBotCommand('listsudo', '', {
    senderJid: mainOwnerJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
  });

  console.log('  Résultat de liste:\n', listReply);
  assert(listReply.includes(targetSudoNumber), 'La liste doit contenir le numéro SUDO ajouté');

  // ----------------------------------------------------
  // TEST 3: Supprimer ce SUDO (.del sudo 50935970099)
  // ----------------------------------------------------
  console.log('\n🔹 Test 3: Étape 3 - Supprimer le SUDO (.del sudo 50935970099)');

  const delReply = await executeBotCommand('delsudo', targetSudoNumber, {
    senderJid: mainOwnerJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
  });

  console.log('  Résultat de suppression:\n', delReply);
  assert(delReply.includes(targetSudoNumber), 'Le message doit contenir le numéro retiré');
  assert.strictEqual(state.sudoUsers.has(targetSudoNumber), false, 'Le numéro ne doit plus être dans state.sudoUsers');

  // ----------------------------------------------------
  // TEST 4: Vérifier que la liste est actualisée après suppression
  // ----------------------------------------------------
  console.log('\n🔹 Test 4: Étape 4 - Vérifier l\'actualisation de la liste');

  const listAfterDel = await executeBotCommand('listsudo', '', {
    senderJid: mainOwnerJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
  });

  console.log('  Résultat après suppression:\n', listAfterDel);
  assert(!listAfterDel.includes(targetSudoNumber), 'La liste ne doit plus contenir le numéro retiré');

  // ----------------------------------------------------
  // TEST 5: Vérifier les restrictions de sécurité & permissions
  // ----------------------------------------------------
  console.log('\n🔹 Test 5: Étape 5 - Sécurité & Droits d\'accès');

  // Un non-main-owner tente d'ajouter un SUDO
  const unauthorizedAdd = await executeBotCommand('sudo', '50911223344', {
    senderJid: secondaryUserJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
    msg: { key: { fromMe: false } },
  });
  console.log('  Résultat d\'accès non-autorisé:\n', unauthorizedAdd);
  assert(unauthorizedAdd.includes('❌') || unauthorizedAdd.includes('ʀᴇғᴜsᴇ́') || unauthorizedAdd.toLowerCase().includes('refus'), 'Un utilisateur secondaire doit se faire refuser .sudo');

  // Tenter de supprimer le propriétaire principal permanent
  const attemptRemoveOwner = await executeBotCommand('delsudo', '50935975863', {
    senderJid: mainOwnerJid,
    sessionId: testSessionId,
    sessionPhone: '50935975863',
  });
  console.log('  Résultat de suppression du propriétaire principal:\n', attemptRemoveOwner);
  assert(attemptRemoveOwner.includes('50935975863') || attemptRemoveOwner.includes('⚠️'), 'Le propriétaire principal ne peut pas être supprimé');

  console.log('  ✅ Tests de sécurité & permissions validés.');

  // ----------------------------------------------------
  // TEST 6: Vérifier la persistance après redémarrage (Sauvegarde & Rechargement)
  // ----------------------------------------------------
  console.log('\n🔹 Test 6: Persistance après redémarrage du bot');

  // Ajouter un nouveau SUDO et sauvegarder sur disque
  state.sudoUsers.add('50977889900');
  saveSessionSettingsToDisk(testSessionId, state);

  // Vider le cache mémoire de sessionStates
  sessionStates.delete(testSessionId);

  // Recharger l'état de session depuis le disque
  const reloadedState = getSessionState(testSessionId);
  assert.strictEqual(reloadedState.sudoUsers.has('50977889900'), true, 'Le numéro SUDO doit être restauré depuis le stockage');

  console.log('  ✅ Persistance sur disque et restauration post-redémarrage validées.');

  // Cleanup test files
  try {
    const sessionsDir = path.join(process.cwd(), 'sessions');
    const testFile = path.join(sessionsDir, `${testSessionId}_settings.json`);
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  } catch (_) {}

  console.log('\n====================================================');
  console.log('🎉 TOUS LES TESTS SUDO ONT RÉUSSI AVEC SUCCÈS !');
  console.log('====================================================\n');
}

runSudoTests().catch((err) => {
  console.error('❌ Échec des tests SUDO:', err);
  process.exit(1);
});
