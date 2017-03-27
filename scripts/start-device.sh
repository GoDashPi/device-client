#!/usr/bin/env bash

export DASHPI_API=https://nnnnn.execute-api.region.amazonaws.com/dev
export CAPTURE_PARAMS="-r 30 -s 1280x720 -f avfoundation -i default -c copy -map 0 -segment_time 3 -c:v libx264 -preset fast -crf 30 -f segment"
npm start -- device