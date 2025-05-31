const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const prettierPlugin = require("eslint-plugin-prettier");
const reactPlugin = require("eslint-plugin-react");
const reactNativePlugin = require("eslint-plugin-react-native");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist', 'node_modules', 'eslint.config.mjs'],
    plugins: {
      react: reactPlugin,
      'react-native': reactNativePlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactNativePlugin.configs.all.rules,
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  }
]);
