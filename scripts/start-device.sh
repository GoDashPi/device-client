#!/usr/bin/env bash

# dev settings for Raspi

export CAPTURE_PARAMS="-v -cs 0 -t 0 -rot 180 -b 3000000 -sg 2000"
export API_KEY=$(cat .apikey | xargs)
export DASHPI_API=https://9fdbmnfvt1.execute-api.eu-west-1.amazonaws.com/dev
export DASHPI_ENV=device

node index.js
