const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const apiTarget = process.env.FRONTEND_API_TARGET || 'http://localhost:3000';

module.exports = {
  mode: 'development',
  entry: './app/static/js/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: false
            }
          }
        ],
        include: path.resolve(__dirname, 'app/static/css')
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      __API_BASE_URL__: JSON.stringify(process.env.API_BASE_URL || ''),
    }),
    new HtmlWebpackPlugin({
      template: './app/static/index.html',
      filename: 'index.html',
    }),
  ],
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/',
      },
      {
        directory: path.join(__dirname, 'app/static'),
        publicPath: '/static',
        staticOptions: {
          index: false,
        },
      }
    ],
    port: 8888,
    host: '0.0.0.0',
    historyApiFallback: {
      disableDotRule: true,
      index: '/index.html',
      rewrites: [
        { from: /^\/.*$/, to: '/index.html' }
      ]
    },
    hot: true,
    compress: true,
    allowedHosts: 'all',
    proxy: [
      {
        context: ['/api', '/verify', '/resend', '/complete_registration', '/get_posts', '/create_post'],
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      {
        context: (pathname, req) => {
          if (['/register', '/login', '/forgot-password', '/reset-password'].some((p) => pathname.startsWith(p))) {
            return req.method !== 'GET';
          }
          return false;
        },
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      }
    ],
  },
  devtool: 'eval-source-map',
  resolve: {
    extensions: ['.js', '.jsx'],
  }
};
