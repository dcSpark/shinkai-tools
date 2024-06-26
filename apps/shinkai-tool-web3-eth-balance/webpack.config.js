const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const { composePlugins, withNx } = require('@nx/webpack');
const _ = require('lodash');

module.exports = composePlugins(
  withNx(),
  (config, { options, context }) => {
    return _.merge(config, {
    target: 'es6',
    externals: [],
    entry: path.join(__dirname, './src/index.ts'),
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      plugins: [new TsconfigPathsPlugin({
        configFile: 'apps/shinkai-tool-web3-eth-balance/tsconfig.json',
      })],
      fallback: {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"),
        "TextEncoder": require.resolve("text-encoding-utf-8"),
    },
    },
    output: {
      path: path.join(__dirname, '../../dist/apps/shinkai-tool-web3-eth-balance'),
      filename: "index.js",
      library: {
        type: "var",
        name: "tool",
      },
      chunkFormat: 'commonjs',
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
            TextEncoder: ['text-encoding-utf-8', 'TextEncoder'],
        }),
    ],
    optimization: {
      minimize: false,
    },
    mode: 'production',
  });
});
