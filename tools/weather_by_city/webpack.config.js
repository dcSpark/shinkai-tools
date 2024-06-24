const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  target: 'es6',
  externals: [], // removes node_modules from your final bundle
  entry: './src/index.ts', // make sure this matches the main root of your code 
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
    plugins: [new TsconfigPathsPlugin({/* options: see below */})],
  },
  output: {
    path: path.join(__dirname, 'dist'), // this can be any path and directory you want
    filename: "index.js",
    library: {
      type: "var",
      name: "tool",
    },
    chunkFormat: 'commonjs',
  },
  optimization: {
    minimize: false, // enabling this reduces file size and readability
  },
  mode: 'production',
};
