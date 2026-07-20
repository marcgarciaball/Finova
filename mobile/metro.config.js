const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Monorepo support (npm workspaces): watch the whole workspace so Metro
// picks up changes in ../packages/domain, and look for modules in both
// mobile/node_modules and the repo-root node_modules where npm hoists
// shared/workspace packages (react-native, expo, @finova/domain, ...).
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
