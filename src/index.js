import { encrypt, decrypt } from 'crypto-io-utils';
import { StoreHandler, Store } from 'crypto-store';
export * from './lib/keys.js';

export class CryptoWallet extends StoreHandler {
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
    })
  }

  lock(secret) {
    return encrypt(this._jsonWallet, secret)
      .then(cipher => this._cipher = cipher);
  }

  unlock(secret) {
    return decrypt(this._cipher, secret).then(data => JSON.parse(data));
  }
}
