import * as path from 'path';
import * as webpack from 'webpack';
import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';
import { withToolWebpackConfig } from '@shinkai_protocol/shinkai-tools-bundler';

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  return merge(
    config,
    withToolWebpackConfig({
      entry: path.join(__dirname, 'src/index.ts'),
      outputPath: path.join(
        __dirname,
        '../../dist/apps/shinkai-tool-internet-search-perplexity',
      ),
      tsConfigFile: path.join(__dirname, 'tsconfig.app.json'),
    }),
    {
      resolve: {
        fallback: {
          os: require.resolve('os-browserify/browser'),
          tty: require.resolve('tty-browserify'),
          util: require.resolve('util/'),
          process: require.resolve('process/browser'),
        },
      },
      plugins: [
        new webpack.ProvidePlugin({
          process: 'process/browser',
        }),
        // Add IgnorePlugin to ignore dynamic requires
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/.*$/,
          contextRegExp: /merge-deep\/node_modules\/clone-deep/,
        }),
        // Optionally, you can use ContextReplacementPlugin
        new webpack.ContextReplacementPlugin(
          /merge-deep\/node_modules\/clone-deep/,
          (data: { dependencies: { critical?: boolean }[] }) => {
            delete data.dependencies[0].critical;
            return data;
          },
        ),
        // ContextReplacementPlugin for playwright-extra
        new webpack.ContextReplacementPlugin(
          /playwright-extra/,
          (data: { dependencies: { critical?: boolean }[] }) => {
            if (data.dependencies[0]) {
              delete data.dependencies[0].critical;
            }
            return data;
          },
        ),
        // ContextReplacementPlugin for tsconfig-paths
        new webpack.ContextReplacementPlugin(
          /tsconfig-paths/,
          (data: { dependencies: { critical?: boolean }[] }) => {
            if (data.dependencies[0]) {
              delete data.dependencies[0].critical;
            }
            return data;
          },
        ),
         // ContextReplacementPlugin for tsconfig-paths filesystem.js
         new webpack.ContextReplacementPlugin(
          /tsconfig-paths\/lib\/filesystem/,
          (data: { dependencies: { critical?: boolean }[] }) => {
            if (data.dependencies[0]) {
              delete data.dependencies[0].critical;
            }
            return data;
          },
        ),
        // ContextReplacementPlugin for tsconfig-paths specific files
        new webpack.ContextReplacementPlugin(
          /tsconfig-paths\/lib\/match-path-async/,
          (data: { dependencies: { critical?: boolean }[] }) => {
            if (data.dependencies[0]) {
              delete data.dependencies[0].critical;
            }
            return data;
          },
        ),
      ],
    },
  );
});
