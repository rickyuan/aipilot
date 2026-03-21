/**
 * Metro configuration for DeskPilot Mobile.
 *
 * Configures Metro to resolve workspace packages in the monorepo.
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Ensure shared package types are resolved
    extraNodeModules: {
      '@deskpilot/shared': path.resolve(monorepoRoot, 'packages/shared'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
