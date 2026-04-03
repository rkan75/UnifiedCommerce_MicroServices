module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    // Legal/marketing copy uses quotes and apostrophes; escaping hurts readability.
    "react/no-unescaped-entities": "off",
  },
};