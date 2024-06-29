import * as webpack from 'webpack';

import { join } from 'path';

import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';

import { withToolWebpackConfig } from '@shinkai_protocol/shinkai-tools-bundler';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  const toolWebpackConfig = withToolWebpackConfig({
    entry: join(__dirname, 'src/index.ts'),
    outputPath: join(
      __dirname,
      '../../dist/apps/shinkai-tool-web3-eth-balance',
    ),
    tsConfigFile: 'apps/shinkai-tool-web3-eth-balance/tsconfig.app.json',
  });
  const additionalWebpackConfig = {
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: join(__dirname, 'tsconfig.app.json'),
        }),
      ],
      fallback: {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        TextEncoder: require.resolve('text-encoding-utf-8'),
      },
    },
    plugins: [
      ...(config.plugins || []),
      ...(toolWebpackConfig.plugins || []),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
        TextEncoder: ['text-encoding-utf-8', 'TextEncoder'],
      }) as any,
    ],
  };
  const mergedConfig = merge(
    merge(config, toolWebpackConfig),
    additionalWebpackConfig,
  );
  return mergedConfig;
});
