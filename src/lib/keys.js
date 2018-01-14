import { randomBytes } from 'crypto';
import { privateKeyVerify, publicKeyVerify, publicKeyCreate, verify, sign } from 'secp256k1';
import { encode, decode } from 'bs58';

export const createPrivateKey = () => {
  const key = randomBytes(32);
  const ok = privateKeyVerify(key);
  if (!ok) { // TODO: is this even needed?
    return createPrivateKey();
  }
  return key;
}

/**
 * @param {string} privateKey the privateKey to create the publickey from
 */
export const createPublicKey = privateKey => {
  if (!privateKey) {
    privateKey = createPrivateKey();
  }
  const key = publicKeyCreate(privateKey);
  const ok = publicKeyVerify(key);
  if (!ok) { // TODO: is this even needed?
    return createPublicKey();
  }
  return key;
}

export const generateKeyPair = () => new Promise(resolve => {
  // define keys
  const keys = {
    private: '',
    public: ''
  }
  // create a privateKey
  keys.private = createPrivateKey();
  // create a public key with the privateKey & encode with bs58
  keys.public = encode(createPublicKey(keys.private));
  // convert to 'hex' string
  keys.private = keys.private.toString('hex');
  // resolve private & public keys
  resolve(keys);
});

export const buffer = (value, enc = 'hex') => {
  return Buffer.from(value, enc);
}

export const signHash = (privateKey, hash) => {
  return sign(buffer(hash), buffer(privateKey)).signature.toString('base64');
}

export const verifySignature = (address, signature, hash) => {
  return verify(buffer(hash), buffer(signature), decode(address));
}
