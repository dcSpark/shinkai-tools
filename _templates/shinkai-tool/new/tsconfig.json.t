---
to: apps/shinkai-tool-<%= name %>/tsconfig.json
---
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {

  },
  "include": [
    "./src/**/*.ts",
    "webpack.config.ts"
  ],
}
