import * as path from 'path';
import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';
import { withToolWebpackConfig } from '@shinkai_protocol/shinkai-tools-bundler';
import webpack from 'webpack';

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  return merge(
    config,
    withToolWebpackConfig({
      entry: path.join(__dirname, 'src/index.ts'),
      outputPath: path.join(__dirname, '../../dist/apps/shinkai-tool-internet-search-perplexity'),
      tsConfigFile: path.join(__dirname, 'tsconfig.app.json'),
    }),
    {
      resolve: {
        fallback: {
          os: require.resolve('os-browserify/browser'),
          tty: require.resolve('tty-browserify'),
          util: require.resolve('util/'),
        },
      },
      plugins: [
        new webpack.ProvidePlugin({
          process: 'process/browser',
        }),
      ],
    }
  );
});
