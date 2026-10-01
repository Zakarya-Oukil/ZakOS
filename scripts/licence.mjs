#!/usr/bin/env node
// Seller tool for Zak OS licence keys. Not shipped to customers.
//
//   node scripts/licence.mjs keygen                      create licence/public.pem (ship it) and ~/.zak-os-licence/private.pem (keep it secret)
//   node scripts/licence.mjs issue --plan pro --name "Acme Ltd" [--email a@b.c] [--days 365]
//
// Anyone holding the private key can mint keys.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const PUB = path.join(root, 'licence', 'public.pem');
// The private key lives in your home folder, outside the project, so it can never be committed or browsed by the app.
const PRIV = path.join(os.homedir(), '.zak-os-licence', 'private.pem');
const [cmd, ...rest] = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

if (cmd === 'keygen') {
  if (fs.existsSync(PRIV)) {
    console.error('A private key already exists. Delete ~/.zak-os-licence/ by hand if you really want a new pair (old keys stop working).');
    process.exit(1);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(PUB), { recursive: true });
  fs.mkdirSync(path.dirname(PRIV), { recursive: true });
  fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log('Wrote licence/public.pem (commit this) and ~/.zak-os-licence/private.pem (back it up, never share it).');
} else if (cmd === 'issue') {
  if (!fs.existsSync(PRIV)) {
    console.error('No private key. Run: node scripts/licence.mjs keygen');
    process.exit(1);
  }
  const plan = arg('plan', 'pro');
  if (!['pro', 'team'].includes(plan)) {
    console.error('--plan must be pro or team');
    process.exit(1);
  }
  const name = arg('name');
  if (!name) {
    console.error('--name is required (who the licence is for)');
    process.exit(1);
  }
  const days = Number(arg('days', '0'));
  const payload = { plan, licensee: name, email: arg('email'), issued: Date.now(), expires: days > 0 ? Date.now() + days * 86_400_000 : null };
  const body = Buffer.from(JSON.stringify(payload));
  const sig = crypto.sign(null, body, crypto.createPrivateKey(fs.readFileSync(PRIV, 'utf8')));
  console.log(`ZAKOS1.${body.toString('base64url')}.${sig.toString('base64url')}`);
} else {
  console.log('Usage: node scripts/licence.mjs keygen | issue --plan pro|team --name "Licensee" [--email x] [--days N]');
}
