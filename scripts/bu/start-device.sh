#!/usr/bin/env bash

# export DASHPI_API=https://nnnnn.execute-api.region.amazonaws.com/dev
export CAPTURE_PARAMS="-v -cs 0 -t 0 -rot 180 -b 3000000 -sg 2000"
export DASHPI_ENV=device
node index.js