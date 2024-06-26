const { composePlugins, withNx } = require('@nx/webpack');
const _ = require('lodash');

module.exports = composePlugins(
  withNx(),
  (config, { options, context }) => {
    return _.merge(config, {
      target: 'es6',
      output: {
        library: {
          type: 'var',
          name: 'ShinkaiToolsBuilder',
        },
        chunkFormat: 'module',
      },
      optimization: {
        minimize: true,
      },
      mode: 'production',
    });
  }
);
