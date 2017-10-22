#!/usr/bin/env bash

# dev settings for Mac

export CAPTURE_PARAMS="-r 30 -s 1280x720 -f avfoundation -i default -c copy -map 0 -segment_time 3 -c:v libx264 -preset fast -crf 30 -f segment"
export API_KEY=$(cat .apikey | xargs)
export DASHPI_API=https://9fdbmnfvt1.execute-api.eu-west-1.amazonaws.com/dev
export DASHPI_ENV=development

node index.js
