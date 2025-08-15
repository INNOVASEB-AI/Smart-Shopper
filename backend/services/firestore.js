const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
	if (initialized) return;
	try {
		// Prefer explicit GOOGLE_APPLICATION_CREDENTIALS, else try local sa-key.json
		const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '..', 'sa-key.json');
		if (fs.existsSync(credsPath)) {
			const serviceAccount = require(credsPath);
			admin.initializeApp({
				credential: admin.credential.cert(serviceAccount)
			});
		} else {
			// Fallback to default credentials (e.g., on Cloud environments)
			admin.initializeApp();
		}
		initialized = true;
	} catch (err) {
		console.error('Failed to initialize Firebase Admin:', err.message);
		throw err;
	}
}

async function searchPrices({ query, retailer, limit = 300 }) {
	initFirebase();
	const db = admin.firestore();

	// Build base query. We can't do substring contains efficiently in Firestore,
	// so fetch the latest documents and filter in memory.
	let ref = db.collection('prices').orderBy('updated', 'desc').limit(limit);
	if (retailer) {
		ref = ref.where('store', '==', retailer);
	}

	const snap = await ref.get();
	const q = (query || '').toLowerCase();
	const results = [];
	snap.forEach(doc => {
		const d = doc.data();
		const name = (d.name || '').toString();
		if (!q || name.toLowerCase().includes(q)) {
			results.push({
				id: doc.id,
				name,
				price: d.price,
				store: d.store,
				retailer: d.store,
				url: d.url
			});
		}
	});

	return results;
}

module.exports = { searchPrices }; 