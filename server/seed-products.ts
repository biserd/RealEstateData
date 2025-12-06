import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Checking for existing products...');
  
  const existingProducts = await stripe.products.search({ query: "active:'true'" });
  const proProduct = existingProducts.data.find(p => p.name === 'Pro Plan');
  
  if (proProduct) {
    console.log('Pro Plan already exists:', proProduct.id);
    const prices = await stripe.prices.list({ product: proProduct.id, active: true });
    console.log('Existing prices:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount })));
    return;
  }

  console.log('Creating Pro Plan product...');
  
  const product = await stripe.products.create({
    name: 'Pro Plan',
    description: 'Full access to Realtors Dashboard with unlimited searches, AI assistant, Deal Memo generator, exports, and alerts.',
    metadata: {
      tier: 'pro',
      features: 'unlimited_searches,ai_assistant,deal_memo,exports,alerts,unlimited_watchlists',
    },
  });

  console.log('Created product:', product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 2900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'monthly',
    },
  });

  console.log('Created monthly price:', monthlyPrice.id, '- $29/month');

  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 29000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      plan: 'yearly',
    },
  });

  console.log('Created yearly price:', yearlyPrice.id, '- $290/year (save $58)');

  console.log('\nProducts created successfully!');
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('Yearly Price ID:', yearlyPrice.id);
  console.log('\nWebhooks will automatically sync these to the database.');
}

createProducts().catch(console.error);
