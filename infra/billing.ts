export const PLAY_PACKAGE_NAME = 'com.tormozz48dev.techtok';

export const PLAY_TESTING_TRACK = 'alpha';

export const playServiceAccountKey = new sst.Secret('PlayServiceAccountKey', '');

export const billingEnvironment = {
  PLAY_PACKAGE_NAME,
  PLAY_SERVICE_ACCOUNT_KEY: playServiceAccountKey.value,
  PLAY_TESTING_TRACK,
};
