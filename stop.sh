#!/usr/bin/env bash
cd "${0%/*}"
pm2 delete godashpi
pm2 restart godashpi-uploader