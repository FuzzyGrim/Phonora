const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const prettier = require("eslint-plugin-prettier");

const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  // Extend Expo and Prettier configs
  ...compat.extends("expo", "prettier"),

  {
    plugins: {
      prettier,
    },

    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
    },

    ignores: ["/dist/*"],
  },
];
