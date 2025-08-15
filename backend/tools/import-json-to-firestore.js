const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
	const backendDir = path.resolve(__dirname, '..');
	const files = fs.readdirSync(backendDir).filter(f => /^crawler-data-.*\.json$/.test(f));
	if (files.length === 0) {
		console.log('No crawler-data-*.json files found. Nothing to import.');
		return;
	}

	// Init Firebase Admin
	const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(backendDir, 'sa-key.json');
	if (!fs.existsSync(creds)) {
		throw new Error(`Service account not found: ${creds}`);
	}
	admin.initializeApp({ credential: admin.credential.cert(require(creds)) });
	const db = admin.firestore();

	let total = 0;
	for (const file of files) {
		const full = path.join(backendDir, file);
		console.log(`Reading ${full}`);
		const arr = JSON.parse(fs.readFileSync(full, 'utf8'));
		const valid = arr.filter(x => x && x.url && x.name && (x.price !== undefined) && x.store);
		console.log(`  ${valid.length}/${arr.length} valid items`);

		const batchSize = 500;
		for (let i = 0; i < valid.length; i += batchSize) {
			const batch = db.batch();
			const chunk = valid.slice(i, i + batchSize);
			chunk.forEach(item => {
				const id = encodeURIComponent(`${item.store}|${item.url}`);
				const ref = db.collection('prices').doc(id);
				batch.set(ref, {
					url: item.url,
					name: item.name,
					price: Number(item.price) || 0,
					store: item.store,
					updated: Date.now(),
					crawled: new Date().toISOString()
				}, { merge: true });
			});
			await batch.commit();
			console.log(`  committed ${chunk.length}`);
			total += chunk.length;
		}
	}

	console.log(`Imported ${total} items.`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
}); 