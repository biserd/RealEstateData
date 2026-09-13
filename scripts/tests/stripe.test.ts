import assert from 'node:assert/strict';
import test from 'node:test';
import { StripeService } from '../../server/stripeService';
import { getUncachableStripeClient } from '../../server/stripeClient';
import { PUBLIC_SUBSCRIPTION_PRODUCTS, SUBSCRIPTION_PLANS } from '../../shared/subscriptionPlans';

test('subscription validation works without credentials and rejects unlisted prices', async () => {
  delete process.env.STRIPE_SECRET_KEY;
  const service = new StripeService();
  for (const product of PUBLIC_SUBSCRIPTION_PRODUCTS) {
    for (const price of product.prices) {
      assert.deepEqual(await service.isValidSubscriptionPrice(price.id), {valid:true,tier:product.metadata.tier});
    }
  }
  for (const id of ['', 'price_foreign_account', 'price_retired']) {
    assert.deepEqual(await service.isValidSubscriptionPrice(id), {valid:false,tier:null});
  }
});

test('guest and member checkout send the selected recurring price and preserve the trial', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture';
  const stripe = await getUncachableStripeClient();
  const original = stripe.checkout.sessions.create;
  const requests: any[] = [];
  stripe.checkout.sessions.create = (async (params: any) => {
    requests.push(params);
    return {id:'cs_fixture',url:'https://checkout.stripe.com/fixture'};
  }) as any;
  try {
    const service = new StripeService();
    await service.createGuestCheckoutSession(SUBSCRIPTION_PLANS.premium.prices.year.id, 'https://example.com/success','https://example.com/cancel');
    await service.createCheckoutSession('cus_fixture', SUBSCRIPTION_PLANS.pro.prices.month.id, 'https://example.com/success','https://example.com/cancel');
    assert.equal(requests[0].line_items[0].price, SUBSCRIPTION_PLANS.premium.prices.year.id);
    assert.equal(requests[1].line_items[0].price, SUBSCRIPTION_PLANS.pro.prices.month.id);
    assert.equal(requests[1].customer, 'cus_fixture');
    for (const request of requests) {
      assert.equal(request.mode, 'subscription');
      assert.equal(request.subscription_data.trial_period_days, 14);
      assert.equal(request.line_items[0].quantity, 1);
      assert.equal(request.line_items[0].price_data, undefined);
    }
  } finally {
    stripe.checkout.sessions.create = original;
    delete process.env.STRIPE_SECRET_KEY;
  }
});
