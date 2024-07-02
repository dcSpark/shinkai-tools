---
to: apps/shinkai-tool-<%= name %>/project.json
---
{
  "name": "@shinkai_protocol/shinkai-tool-<%= name %>",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/shinkai-tool-<%= name %>/src",
  "projectType": "library",
  "tags": ["tool"],
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "compiler": "tsc",
        "outputPath": "dist/apps/shinkai-tool-<%= name %>",
        "main": "apps/shinkai-tool-<%= name %>/src/index.ts",
        "tsConfig": "apps/shinkai-tool-<%= name %>/tsconfig.app.json",
        "webpackConfig": "apps/shinkai-tool-<%= name %>/webpack.config.ts"
      },
      "configurations": {
        "development": {},
        "production": {}
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": [
          "apps/shinkai-tool-<%= name %>/**/*.ts",
          "apps/shinkai-tool-<%= name %>/package.json"
        ]
      }
    }
  }
}
