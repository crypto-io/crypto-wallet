// import
import { encrypt, decrypt } from 'crypto-io-utils';
import { StoreHandler } from 'crypto-store';
import bitcoin from 'bitcoinjs-lib';
import randomBytes from 'randombytes';
import bs58 from 'bs58';
// declare
const { ECPair } = bitcoin;
const { encode, decode } = bs58;

// TODO: networks belongs in core package...
const networks = {
  // main network
  cryptocoin: {
    messagePrefix: `\u0019Cryptocoin Signed Message:`,
    pubKeyHash: 121,
    scriptHash: 127,
    wif: 244,
    bip32: { public: 33108450, private: 33107450 }
  },
  // testnet
  olivia: {
    messagePrefix: `\u0019Olivia Signed Message:`,
    pubKeyHash: 115,
    scriptHash: 126,
    wif: 245,
    bip32: { public: 33108400, private: 33107350 }
  }
}

export class CryptoWallet extends StoreHandler {
  constructor(keys = {}, secret = null) {
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

  /**
   * @return {object} {wif, address}
   */
  _updateKeyPair(keyPair) {
    this.wif = keyPair.toWIF(); // private key in wif format
    this.address = keyPair.getAddress(); // public key
    return { wif: this.wif, address: this.address }
  }

  _createRandomAddress() {
    const keyPair = ECPair.makeRandom({
      network: networks['olivia'], // Hardcoded for now
      rng: () => Buffer.from(randomBytes(32))
    });

    return this._updateKeyPair(keyPair);
  }

  _createAddressFromHash(hash) {
    if (!hash) {
      return console.warn(`SHA256 hash required`);
    }
    const big = bigi.fromBuffer(hash);
    const keyPair = new ECPair(big);

    return this._updateKeyPair(keyPair);
  }

  /**
   * Create a new address
   * Returns a random address when hash is undefined.
   *
   * @param {*} hash SHA256 hash to generate an address from.
   */
  new(hash) {
    if (hash) {
      return this._createAddressFromHash(hash);
    }
    return this._createRandomAddress();
  }

  /**
   * Get the address using the wif (wallet import format)
   *
   * @param {*} wif The wif address to generate the public key from.
   *
   * **The wif is also set for generating the private key when sending coins.**
   */
  import(wif) {
    this.wif = wif;
    this.address = ECPair.fromWIF(wif, networks['olivia']).getAddress();
  }

  /**
   * Send coins to given address
   *
   * @param {*} address The address to send the coins to.
   *
   * Will move to other module probably.
   */
  send() {
    if (!this.private && this.wif) {
      this.private = decode(this.wif).toString('hex'); // decode the wif with base58
    } else if (this.private && this.public) {
      // TODO: finish ...
    } else {
      throw new Error('Invalid wallet: you should check you address and private key')
    }
    // createTransaction
  }
}
