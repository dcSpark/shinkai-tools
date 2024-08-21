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
      "executor": "nx:run-commands",
      "defaultConfiguration": "production",
      "options": {
        "command": "npx ts-node scripts/tool-bundler.ts --entry ./apps/shinkai-tool-<%= name %>/src/index.ts --outputFolder ./dist/apps/shinkai-tool-<%= name %>"
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
