const crypto = require('crypto');
const password = 'comfortcare_demo_2026';
const salt = crypto.randomBytes(16);
crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64*1024*1024 }, (err, key) => {
  const hash = `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
  console.log(hash);
});
