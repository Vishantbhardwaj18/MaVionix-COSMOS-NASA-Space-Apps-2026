import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
<<<<<<< HEAD
  {
    rules: {
      // Pages here load data in effects and reset view state when the field changes. That is the
      // "synchronise with an external system" case the rule's own docs allow, so it is switched off.
      "react-hooks/set-state-in-effect": "off",
      // Thumbnails are tiny base64 PNGs generated per request; next/image cannot optimise them.
      "@next/next/no-img-element": "off",
    },
  },
=======
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
