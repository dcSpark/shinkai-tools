#!/bin/bash

export NODE_API_IP="0.0.0.0"
export NODE_IP="0.0.0.0"
export NODE_API_PORT="9550"
export NODE_WS_PORT="9551"
export NODE_PORT="9552"
export NODE_HTTPS_PORT="9553"
export IDENTITY_SECRET_KEY="df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119"
export ENCRYPTION_SECRET_KEY="d83f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81159"
export PING_INTERVAL_SECS="0"
export GLOBAL_IDENTITY_NAME="@@localhost.arb-sep-shinkai"
export RUST_LOG=debug,error,info
export STARTING_NUM_QR_PROFILES="1"
export STARTING_NUM_QR_DEVICES="1"
export FIRST_DEVICE_NEEDS_REGISTRATION_CODE="false"
export LOG_SIMPLE="true"
export NO_SECRET_FILE="true"
export PROXY_IDENTITY="@@relayer_pub_01.arb-sep-shinkai"
export SHINKAI_TOOLS_RUNNER_DENO_BINARY_PATH="./shinkai-tools-runner-resources/deno"
export SHINKAI_TOOLS_RUNNER_UV_BINARY_PATH="./shinkai-tools-runner-resources/uv"
export SHINKAI_VERSION="0.9.5"
export SKIP_IMPORT_FROM_DIRECTORY="true"

# Add these lines to enable all log options
export LOG_ALL=1

if [ "$USE_DOCKER" = "true" ]; then
  # Run shinkai-node Docker container with environment variables
  docker run \
    -e NODE_API_IP \
    -e NODE_IP \
    -e NODE_API_PORT \
    -e NODE_WS_PORT \
    -e NODE_PORT \
    -e NODE_HTTPS_PORT \
    -e IDENTITY_SECRET_KEY \
    -e ENCRYPTION_SECRET_KEY \
    -e PING_INTERVAL_SECS \
    -e GLOBAL_IDENTITY_NAME \
    -e RUST_LOG \
    -e STARTING_NUM_QR_PROFILES \
    -e STARTING_NUM_QR_DEVICES \
    -e FIRST_DEVICE_NEEDS_REGISTRATION_CODE \
    -e LOG_SIMPLE \
    -e NO_SECRET_FILE \
    -e PROXY_IDENTITY \
    -e SHINKAI_TOOLS_RUNNER_DENO_BINARY_PATH \
    -e SHINKAI_TOOLS_RUNNER_UV_BINARY_PATH \
    -e LOG_ALL \
    -e INITIAL_AGENT_NAMES \
    -e INITIAL_AGENT_URLS \
    -e INITIAL_AGENT_MODELS \
    -e INITIAL_AGENT_API_KEYS \
    -e API_V2_KEY \
    -e EMBEDDINGS_SERVER_URL \
    -e SKIP_IMPORT_FROM_DIRECTORY \
    -p ${NODE_API_PORT}:${NODE_API_PORT} \
    -p ${NODE_WS_PORT}:${NODE_WS_PORT} \
    -p ${NODE_PORT}:${NODE_PORT} \
    -p ${NODE_HTTPS_PORT}:${NODE_HTTPS_PORT} \
    ${SHINKAI_NODE_IMAGE}
else
  # Download and run native binary
  if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
      curl --location https://github.com/dcSpark/shinkai-node/releases/download/v$SHINKAI_VERSION/shinkai-node-aarch64-apple-darwin.zip -o shinkai-node.zip
  elif [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]]; then
      curl --location https://github.com/dcSpark/shinkai-node/releases/download/v$SHINKAI_VERSION/shinkai-node-x86_64-unknown-linux-gnu.zip -o shinkai-node.zip
  else
      echo "Unsupported platform"
      exit 1
  fi

  mkdir -p shinkai-node
  unzip -o shinkai-node.zip -d shinkai-node/
  cd shinkai-node
  ./shinkai-node
fi
