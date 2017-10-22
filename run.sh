#!/usr/bin/env bash
#export API_KEY=$(cat .apikey | xargs)
cd "${0%/*}"
sudo pm2 start process.device.yml