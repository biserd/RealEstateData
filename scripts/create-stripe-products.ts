import Stripe from 'stripe';

async function createStripeProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.error('ERROR: STRIPE_SECRET_KEY environment variable is not set');
    console.log('');
    console.log('To use this script:');
    console.log('1. Get your Stripe Secret Key from https://dashboard.stripe.com/apikeys');
    console.log('2. Run: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-stripe-products.ts');
    console.log('');
    console.log('For TEST mode, use your test key (sk_test_xxx)');
    console.log('For LIVE mode, use your live key (sk_live_xxx)');
    process.exit(1);
  }

  const isLiveKey = secretKey.startsWith('sk_live_');
  console.log(`\n🔑 Using ${isLiveKey ? 'LIVE' : 'TEST'} Stripe key\n`);

  const stripe = new Stripe(secretKey);

  try {
    console.log('Creating Pro Plan product...');
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Full access to Realtors Dashboard with unlimited searches, AI assistant, Deal Memo generator, exports, and alerts.',
      metadata: {
        tier: 'pro',
        features: 'unlimited_searches,ai_assistant,deal_memo,exports,alerts,unlimited_watchlists'
      }
    });
    console.log(`✅ Pro Plan created: ${proProduct.id}`);

    console.log('Creating Pro Plan monthly price ($29/month)...');
    const proMonthly = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2900,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan: 'monthly' }
    });
    console.log(`✅ Pro monthly price: ${proMonthly.id}`);

    console.log('Creating Pro Plan yearly price ($290/year)...');
    const proYearly = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 29000,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { plan: 'yearly' }
    });
    console.log(`✅ Pro yearly price: ${proYearly.id}`);

    console.log('\nCreating Premium Plan product...');
    const premiumProduct = await stripe.products.create({
      name: 'Premium Plan',
      description: 'Everything in Pro plus: Watchlist alerts, daily/weekly digests, portfolio view, branded client reports, bulk exports (CSV + batch PDFs), higher API quota (100k/day, 50 rps), and priority support.',
      metadata: {
        tier: 'premium',
        features: 'pro_features,alerts,digests,portfolio,branded_reports,bulk_exports,higher_api_quota,priority_support'
      }
    });
    console.log(`✅ Premium Plan created: ${premiumProduct.id}`);

    console.log('Creating Premium Plan monthly price ($79/month)...');
    const premiumMonthly = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 7900,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan: 'monthly', tier: 'premium' }
    });
    console.log(`✅ Premium monthly price: ${premiumMonthly.id}`);

    console.log('Creating Premium Plan yearly price ($790/year)...');
    const premiumYearly = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 79000,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { plan: 'yearly', tier: 'premium' }
    });
    console.log(`✅ Premium yearly price: ${premiumYearly.id}`);

    console.log('\n========================================');
    console.log('🎉 All Stripe products created successfully!');
    console.log('========================================\n');
    console.log('Pro Plan:');
    console.log(`  Product ID: ${proProduct.id}`);
    console.log(`  Monthly Price ID: ${proMonthly.id}`);
    console.log(`  Yearly Price ID: ${proYearly.id}`);
    console.log('\nPremium Plan:');
    console.log(`  Product ID: ${premiumProduct.id}`);
    console.log(`  Monthly Price ID: ${premiumMonthly.id}`);
    console.log(`  Yearly Price ID: ${premiumYearly.id}`);
    console.log('\n✅ Products will sync automatically when your app restarts.');
    console.log('   Or you can trigger a manual sync by redeploying.\n');

  } catch (error: any) {
    console.error('❌ Error creating products:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.log('\nMake sure your STRIPE_SECRET_KEY is valid.');
    }
    process.exit(1);
  }
}

createStripeProducts();
