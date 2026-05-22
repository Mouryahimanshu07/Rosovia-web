import { test, expect } from '@playwright/test';

test.describe('E2E Buyer Checkout: inventory locking and purchase flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Bypass authentication by seeding session cookie directly
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: 'mock-valid-buyer-jwt',
        domain: 'localhost',
        path: '/',
        expires: Date.now() / 1000 + 3600,
      }
    ]);
  });

  test('should lock inventory on checkout step and purchase successfully', async ({ page }) => {
    // 1. Navigate to high-demand listing
    await page.goto('/listings/limited-creator-pass');
    await expect(page.locator('h1')).toContainText('Limited Creator Pass');

    // 2. Click checkout (triggers reservation in DB)
    const checkoutButton = page.locator('button:has-text("Book Now")');
    await checkoutButton.click();

    // 3. Confirm reservation status in the UI
    await expect(page.locator('.inventory-status')).toContainText('Reserved for 10:00 minutes');

    // 4. Try booking a second time in a new window (should show out-of-stock / reserved)
    const secondBrowserContext = await page.context().browser()?.newContext();
    const secondPage = await secondBrowserContext!.newPage();
    await secondPage.goto('http://localhost:3000/listings/limited-creator-pass');
    await expect(secondPage.locator('.stock-warning')).toContainText('Item is currently reserved by another customer');
    await secondPage.close();

    // 5. Simulate filling out payment form and Razorpay success trigger
    await page.locator('button:has-text("Proceed to Payment")').click();
    
    // Simulate server webhook call to localhost callback
    const webhookUrl = 'http://localhost:3000/api/webhooks/razorpay';
    const response = await page.request.post(webhookUrl, {
      headers: {
        'x-razorpay-signature': 'valid-mock-signature',
      },
      data: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_e2e_successful_99',
              order_id: 'order_e2e_provider_1',
              status: 'captured',
              amount: 15000,
              currency: 'INR'
            }
          }
        }
      }
    });

    expect(response.ok()).toBe(true);

    // 6. Verify order confirmation is shown in buyer panel
    await page.goto('/dashboard/buyer/orders');
    await expect(page.locator('.order-status-badge')).toContainText('Paid');
  });
});
