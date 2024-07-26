---
to: apps/shinkai-tool-<%= name %>/jest.config.ts
---

/* eslint-disable */
export default {
  displayName: '@shinkai_protocol/shinkai-tool-<%= name %>',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/apps/shinkai-tool-<%= name %>',
};
