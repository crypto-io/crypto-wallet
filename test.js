const test = require('tape');
const { CryptoWallet, generateKeyPair } = require('./wallet.js');

test('CryptoWallet & generateKeyPair', tape => {
  tape.plan(3);
  const wallet = new CryptoWallet({private: 'secret', public: 'public'})
  generateKeyPair().then(pair => {
    const wallet = new CryptoWallet(pair);
    tape.equal(wallet.private, pair.private, 'keys generated');
    wallet.lock('secret').then(() => {
      tape.pass('wallet locked')
      wallet.unlock('secret').then(data => {
        tape.deepEqual(pair, data, 'wallet unlocked');
      });
    });
  })
});
