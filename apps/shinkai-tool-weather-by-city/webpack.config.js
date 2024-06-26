const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

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
        configFile: 'apps/shinkai-tool-weather-by-city/tsconfig.json',
      })],
    },
    output: {
      path: path.join(__dirname, '../../dist/apps/shinkai-tool-weather-by-city'),
      filename: "index.js",
      library: {
        type: "var",
        name: "tool",
      },
      chunkFormat: 'commonjs',
    },
    optimization: {
      minimize: false,
    },
    mode: 'production',
  });
});
