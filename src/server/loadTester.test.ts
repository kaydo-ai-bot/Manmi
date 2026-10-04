import { runMultiSessionLoadTest } from './loadTester';

async function main() {
  console.log('====================================================');
  console.log('⚡ KAYDO BOT V1 - MULTI-SESSION LOAD TEST HARNESS');
  console.log('====================================================\n');

  const testCounts = [1, 10, 25, 50, 100];

  for (const count of testCounts) {
    console.log(`\n--- Test de charge : ${count} session(s) concurrente(s) ---`);
    const metrics = await runMultiSessionLoadTest(count);
    console.log(`Résultats (${count} sessions):`, JSON.stringify(metrics, null, 2));

    if (!metrics.concurrencySuccess) {
      console.error(`❌ Échec du test pour ${count} sessions.`);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('✅ TOUS LES TESTS DE CHARGE (1 à 100 SESSIONS) ONT RÉUSSI !');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
