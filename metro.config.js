const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ignorar solo el archivo problemático específico
config.resolver.blockList = [
  /node_modules\/@expo\/metro-runtime\/src\/location\/install\.native\.ts$/,
];

module.exports = config;
