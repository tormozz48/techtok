module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // @material/material-color-utilities ships ESM-only. jest-expo's own default
  // transformIgnorePatterns (jest-expo/jest-preset.js) already allows-lists
  // `.pnpm` so its virtual-store segment doesn't get ignored, but pnpm's nested
  // `node_modules/.pnpm/<pkg>/node_modules/<pkg>` layout means the *inner*
  // node_modules/@material segment still needs its own allow-list entry, or
  // that second path segment falls through to "ignored" and Jest never
  // transforms its ESM `export` syntax. Mirrors jest-expo's default verbatim
  // plus `@material`.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@material))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
