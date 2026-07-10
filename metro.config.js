const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ExcelJS usa Node.js internals; apuntar al build de browser para Metro
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  exceljs: require.resolve('exceljs/dist/exceljs.min.js'),
};

module.exports = config;
