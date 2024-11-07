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
    "build": {
      "executor": "nx:run-commands",
      "defaultConfiguration": "production",
      "options": {
        "command": "deno task tool-bundler --entry ./apps/shinkai-tool-<%= name %>/src/index.ts --outputFolder ./dist/apps/shinkai-tool-<%= name %>"
      },
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "deno lint ./apps/shinkai-tool-<%= name %>/src/index.ts"
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "deno test --no-check --allow-all ./apps/shinkai-tool-<%= name %>/src/**/*.test.ts"
      }
    }
  }
}
