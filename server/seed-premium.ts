import { getUncachableStripeClient } from './stripeClient';

async function createPremiumProduct() {
  const stripe = await getUncachableStripeClient();

  console.log('Checking for existing Premium Plan...');
  
  const existingProducts = await stripe.products.search({ query: "active:'true'" });
  const premiumProduct = existingProducts.data.find(p => p.name === 'Premium Plan');
  
  if (premiumProduct) {
    console.log('Premium Plan already exists:', premiumProduct.id);
    const prices = await stripe.prices.list({ product: premiumProduct.id, active: true });
    console.log('Existing prices:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount, interval: p.recurring?.interval })));
    return;
  }

  console.log('Creating Premium Plan product...');
  
  const product = await stripe.products.create({
    name: 'Premium Plan',
    description: 'Everything in Pro plus: Watchlist alerts, daily/weekly digests, portfolio view, branded client reports, bulk exports (CSV + batch PDFs), higher API quota (100k/day, 50 rps), and priority support.',
    metadata: {
      tier: 'premium',
      features: 'pro_features,alerts,digests,portfolio,branded_reports,bulk_exports,higher_api_quota,priority_support',
    },
  });

  console.log('Created product:', product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 7900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'monthly',
      tier: 'premium',
    },
  });

  console.log('Created monthly price:', monthlyPrice.id, '- $79/month');

  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 79000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      plan: 'yearly',
      tier: 'premium',
    },
  });

  console.log('Created yearly price:', yearlyPrice.id, '- $790/year (save $158)');

  console.log('\n=== Premium Plan Created Successfully! ===');
  console.log('Product ID:', product.id);
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('Yearly Price ID:', yearlyPrice.id);
  console.log('\nWebhooks will automatically sync these to the database.');
}

createPremiumProduct().catch(console.error);
