#!/usr/bin/env bash

export API_KEY=$(cat .apikey | xargs)
export DASHPI_API=https://9fdbmnfvt1.execute-api.eu-west-1.amazonaws.com/dev
scripts/start-development.sh
