import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';

module.exports = composePlugins(
  withNx(),
  (config, { options, context }) => {
    return merge(config, {
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
