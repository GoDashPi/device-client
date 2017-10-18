#!/usr/bin/env bash
export API_KEY=$(cat .apikey | xargs)
cd "${0%/*}"
pm2 start process.device.yml