export const PLAY_PACKAGE_NAME = 'com.tormozz48dev.techtok';

export const TESTERS_GROUP_EMAIL = 'testers@techtokapp.eu';

export const playServiceAccountKey = new sst.Secret('PlayServiceAccountKey', '');

export const billingEnvironment = {
  PLAY_PACKAGE_NAME,
  PLAY_SERVICE_ACCOUNT_KEY: playServiceAccountKey.value,
};
