export const PLAY_PACKAGE_NAME = 'com.tormozz48dev.techtok';

export const playServiceAccountKey = new sst.Secret('PlayServiceAccountKey', '');

export const billingEnvironment = {
  PLAY_PACKAGE_NAME,
  PLAY_SERVICE_ACCOUNT_KEY: playServiceAccountKey.value,
};
