import { getUncachableStripeClient } from '../server/stripeClient';
async function main() {
  const stripe = await getUncachableStripeClient();
  const acct = await stripe.accounts.retrieve();
  console.log('Account ID:', acct.id);
  console.log('Email:', acct.email);
  console.log('Country:', acct.country);
  console.log('Display name:', acct.settings?.dashboard?.display_name);
  const products = await stripe.products.list({ active: true, limit: 100 });
  console.log('\nActive products in this account (' + products.data.length + '):');
  for (const p of products.data) console.log('  -', p.name, p.id);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
