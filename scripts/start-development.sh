#!/usr/bin/env bash

# dev settings for Mac

export CAPTURE_PARAMS="-r 30 -s 1280x720 -f avfoundation -i default -c copy -map 0 -segment_time 3 -c:v libx264 -preset fast -crf 30 -f segment"
npm start -- development