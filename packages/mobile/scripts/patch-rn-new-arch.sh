#!/bin/sh
# Patch react-native to allow disabling New Architecture via ENV var.
# trtc-react-native 3.2.4 uses the old RCT bridge and is incompatible with
# RN 0.84 bridgeless mode. Run after every `pnpm install`.
#
# Patches applied:
#   1. new_architecture.rb: new_arch_enabled reads ENV instead of hardcoded true
#   2. react_native_pods.rb: ||= so Podfile ENV='0' is preserved; respects new_arch_enabled param

set -e

RN_ARCH_FILE="node_modules/react-native/scripts/cocoapods/new_architecture.rb"
RN_PODS_FILE="node_modules/react-native/scripts/react_native_pods.rb"

# Patch 1: make new_arch_enabled respect ENV["RCT_NEW_ARCH_ENABLED"]
if grep -q '        return true' "$RN_ARCH_FILE"; then
  sed -i '' 's/        return true/        return ENV["RCT_NEW_ARCH_ENABLED"] != "0"/' "$RN_ARCH_FILE"
  echo "✓ Patched new_architecture.rb: new_arch_enabled reads ENV"
else
  echo "• new_architecture.rb already patched or changed — skipping"
fi

# Patch 2: use ||= so a pre-set ENV='0' in Podfile is preserved
if grep -q 'ENV\["RCT_NEW_ARCH_ENABLED"\] = "1"' "$RN_PODS_FILE"; then
  sed -i '' 's/ENV\["RCT_NEW_ARCH_ENABLED"\] = "1"/ENV["RCT_NEW_ARCH_ENABLED"] ||= "1"/' "$RN_PODS_FILE"
  echo "✓ Patched react_native_pods.rb: uses ||= to preserve existing ENV"
else
  echo "• react_native_pods.rb (||= patch) already patched or changed — skipping"
fi

# Patch 3: pass new_arch_enabled param instead of hardcoded true in install_modules_dependencies
if grep -q 'NewArchitectureHelper.install_modules_dependencies(spec, true,' "$RN_PODS_FILE"; then
  sed -i '' 's/NewArchitectureHelper.install_modules_dependencies(spec, true,/NewArchitectureHelper.install_modules_dependencies(spec, new_arch_enabled,/' "$RN_PODS_FILE"
  echo "✓ Patched react_native_pods.rb: install_modules_dependencies respects new_arch_enabled"
else
  echo "• react_native_pods.rb (new_arch param) already patched or changed — skipping"
fi

echo "Done. Run 'pod install' in ios/ to apply."
