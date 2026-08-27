import { loadKeypair } from './demo-common.js';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes: Uint8Array) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    result += alphabet[0];
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) result += alphabet[digits[index]];
  return result;
}

const regulator = loadKeypair('regulator');
console.log(`Regulator public key: ${regulator.publicKey.toBase58()}`);
console.log(`Phantom import private key: ${base58(regulator.secretKey)}`);
console.log('This is a Devnet/localnet demo key. Never send real SOL or production assets to it.');
