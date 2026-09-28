import { test, expect } from 'mobilewright';

test.describe('Kimbia TZ Mobile App E2E Test Suite', () => {

  test('should launch Kimbia TZ mobile app and verify main UI elements', async ({ device }) => {
    // Launch the Kimbia TZ application
    await device.launchApp();

    // Verify top app bar title and branding
    const brandElement = await device.locator('text=KIMBIA TZ');
    await expect(brandElement).toBeVisible();

    // Verify presence of navigation items
    const leagueTab = await device.locator('text=League App');
    await expect(leagueTab).toBeVisible();

    const gpsTab = await device.locator('text=Native GPS');
    await expect(gpsTab).toBeVisible();

    const sdkTab = await device.locator('text=Mobile SDK');
    await expect(sdkTab).toBeVisible();
  });

  test('should navigate to Native GPS view and verify tracking controls', async ({ device }) => {
    // Tap on Native GPS tab
    await device.click('text=Native GPS');

    // Verify GPS Run Tracker header
    const trackerHeader = await device.locator('text=NATIVE GPS RUN TRACKER');
    await expect(trackerHeader).toBeVisible();

    // Verify START GPS RUN button
    const startButton = await device.locator('text=START GPS RUN');
    await expect(startButton).toBeVisible();
  });

  test('should navigate to Mobile SDK view and verify APK download link', async ({ device }) => {
    // Tap on Mobile SDK tab
    await device.click('text=Mobile SDK');

    // Verify SDK and APK download card
    const apkButton = await device.locator('text=Download Android APK (Direct Link)');
    await expect(apkButton).toBeVisible();
  });

});
