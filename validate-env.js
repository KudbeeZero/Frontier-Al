const required = [
  'DATABASE_URL',
  'ALGORAND_ADMIN_MNEMONIC',
  'ALGORAND_ADMIN_ADDRESS',
  'SESSION_SECRET',
  'PUBLIC_BASE_URL',
  'ALGORAND_NETWORK'
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing secrets:', missing.join(', '));
  process.exit(1);
}

const net = process.env.ALGORAND_NETWORK;
if (net !== 'mainnet' && net !== 'testnet') {
  console.error('❌ ALGORAND_NETWORK must be mainnet or testnet, got:', net);
  process.exit(1);
}

console.log('✅ All secrets validated. Network:', net);
