const path = require('path')
const webpack = require('webpack')
const glob = require('glob')

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    app: './index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'refine-sibmei.js',
    publicPath: '/',
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'src')
  },
  module: {
    rules: [
      {
        test: /\.js$/i,
        exclude: [/node_modules/],
        use: [{
            loader: 'babel-loader',
            options: { presets: ['env'] },
        }],
      },
      {
        test: /\.(sass|scss)$/i,
        use: [
            {loader: 'style-loader'},
            {loader: 'css-loader'},
            {
                loader: 'sass-loader',
                options: {
                    includePaths: glob.sync('node_modules').map((d) => path.join(__dirname, d))
                }
            },
        ]
      }
    ],
  }
}