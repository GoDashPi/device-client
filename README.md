# GoDashPi Device Client

Work in progress!

setup sqlite db
```Bash
sqlite3 dashpi.db < dashpi.sql
```

start using [pm2](https://github.com/Unitech/pm2)
```
$ export API_KEY=api-key-for-register-endpoint
pm2 start process.device.yml
```
