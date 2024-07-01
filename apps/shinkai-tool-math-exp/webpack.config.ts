import * as path from 'path';

import { composePlugins, withNx } from '@nx/webpack';
import { merge } from 'lodash';

import { withToolWebpackConfig } from '@shinkai_protocol/shinkai-tools-bundler';

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  return merge(
    config,
    withToolWebpackConfig({
      entry: path.join(__dirname, 'src/index.ts'),
      outputPath: path.join(__dirname, '../../dist/apps/shinkai-tool-math-exp'),
      tsConfigFile: path.join(__dirname, 'tsconfig.app.json'),
    }),
  );
});
