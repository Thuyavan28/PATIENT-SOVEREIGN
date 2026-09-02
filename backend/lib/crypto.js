import crypto from 'node:crypto';

/**
 * Generates an RSA-2048 keypair
 * SPKI public key PEM, PKCS8 private key PEM
 */
export function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * Encrypt private key with AES-256-CBC using SHA-256(pin) as key
 * Returns format: "ivHex:ciphertextHex"
 */
export function encryptPrivateKey(privateKeyPem, pin) {
  const key = crypto.createHash('sha256').update(String(pin)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(privateKeyPem, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

/**
 * Decrypt private key with AES-256-CBC using SHA-256(pin) as key
 */
export function decryptPrivateKey(encryptedPem, pin) {
  if (!encryptedPem || !encryptedPem.includes(':')) {
    throw new Error('Invalid encrypted private key format');
  }
  const [ivHex, enc] = encryptedPem.split(':');
  const key = crypto.createHash('sha256').update(String(pin)).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

/**
 * Sign data string with RSA-SHA256 and PSS padding, returning hex signature
 */
export function signData(data, privateKeyPem) {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(dataStr);
  return sign.sign(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
    'hex'
  );
}

/**
 * Verify RSA-SHA256 PSS hex signature against public key PEM
 */
export function verifySignature(data, signatureHex, publicKeyPem) {
  try {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(dataStr);
    return verify.verify(
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
      signatureHex,
      'hex'
    );
  } catch (err) {
    console.error('Crypto verification error:', err);
    return false;
  }
}

/**
 * SHA-256 hash of canonical JSON of object (sorted keys)
 */
export function hashContent(obj) {
  if (typeof obj === 'string') {
    return crypto.createHash('sha256').update(obj).digest('hex');
  }
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Build blockchain-style prescription chain hash: SHA-256(prevHash + contentHash)
 */
export function buildChainHash(prevHash, contentHash) {
  return crypto.createHash('sha256').update(String(prevHash || '0') + String(contentHash)).digest('hex');
}

/**
 * Build tamper-evident audit hash: SHA-256(prevHash + action + actorId + timestamp)
 */
export function buildAuditHash(prevHash, action, actorId, timestamp) {
  return crypto.createHash('sha256')
    .update(String(prevHash || '0') + String(action) + String(actorId) + String(timestamp))
    .digest('hex');
}

/**
 * Generate 6-char uppercase alphanumeric share code (patients only)
 */
export function generateShareCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}
