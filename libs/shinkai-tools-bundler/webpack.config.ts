import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { join } from 'path';

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  return merge(config, {
    target: 'node',
    optimization: {
      minimize: true,
    },
    mode: 'production',
    resolve: {
      extensions: ['.ts'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: join(__dirname, 'tsconfig.json'),
        }),
      ],
    },
  });
});
