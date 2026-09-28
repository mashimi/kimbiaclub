import { defineConfig, type MobilewrightConfig } from 'mobilewright';

/**
 * Mobilewright Configuration for Mobile Next (https://mobilenext.ai/docs)
 * Controls local device testing via MobileCLI & Cloud device testing via Mobile Next Cloud.
 */
const config: MobilewrightConfig = {
  platform: (process.env['MOBILE_PLATFORM'] as 'android' | 'ios') || 'android',
  app: process.env['APK_PATH'] || './mobile/build/app/outputs/flutter-apk/app-release.apk',
  timeout: 60000,
};

if (process.env['MOBILENEXT_API_KEY']) {
  config.driver = {
    type: 'mobilenext',
    apiKey: process.env['MOBILENEXT_API_KEY'],
    testResult: {
      name: 'Kimbia TZ Mobile App & SDK E2E Suite',
      tags: ['android', 'ci', 'release'],
      environment: process.env['NODE_ENV'] || 'production',
    },
  };
}

export default defineConfig(config);
