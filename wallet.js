'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var cryptoIoUtils = require('crypto-io-utils');
var cryptoStore = require('crypto-store');
var crypto = require('crypto');
var secp256k1 = require('secp256k1');
var bs58 = require('bs58');

const createPrivateKey = () => {
  const key = crypto.randomBytes(32);
  const ok = secp256k1.privateKeyVerify(key);
  if (!ok) {
    return createPrivateKey();
  }
  return key;
};
const createPublicKey = privateKey => {
  if (!privateKey) {
    privateKey = createPrivateKey();
  }
  const key = secp256k1.publicKeyCreate(privateKey);
  const ok = secp256k1.publicKeyVerify(key);
  if (!ok) {
    return createPublicKey();
  }
  return key;
};
const generateKeyPair = () => new Promise(resolve => {
  const keys = {
    private: '',
    public: ''
  };keys.private = createPrivateKey();
  keys.public = bs58.encode(createPublicKey(keys.private));
  keys.private = keys.private.toString('hex');
  resolve(keys);
});
const buffer = (value, enc = 'hex') => {
  return Buffer.from(value, enc);
};
const signHash = (privateKey, hash) => {
  return secp256k1.sign(buffer(hash), buffer(privateKey)).signature.toString('base64');
};
const verifySignature = (address, signature, hash) => {
  return secp256k1.verify(buffer(hash), buffer(signature), bs58.decode(address));
};

class CryptoWallet extends cryptoStore.StoreHandler {
  constructor(keys, secret) {
    super('hex');
    this.secret = secret;
    this.private = keys.private;
    this.public = keys.public;
  }
  get _jsonWallet() {
    return JSON.stringify({
      private: this.private,
      public: this.public
    });
  }
  lock(secret) {
    return cryptoIoUtils.encrypt(this._jsonWallet, secret).then(cipher => this._cipher = cipher);
  }
  unlock(secret) {
    return cryptoIoUtils.decrypt(this._cipher, secret).then(data => JSON.parse(data));
  }
}

exports.CryptoWallet = CryptoWallet;
exports.createPrivateKey = createPrivateKey;
exports.createPublicKey = createPublicKey;
exports.generateKeyPair = generateKeyPair;
exports.buffer = buffer;
exports.signHash = signHash;
exports.verifySignature = verifySignature;
//# sourceMappingURL=wallet.js.map
