'use strict';

const { exec } = require('child_process');
const { log, logError } = require('../shared/logger');
const Rx = require('rxjs/Rx');

let run;

if (process.env.DASHPI_ENV === 'device') {
  const { BluetoothSerialPortServer } =
    require('bluetooth-serial-port'); // eslint-disable-line global-require

  const server = new BluetoothSerialPortServer();

// const channel = 1;
// const uuid = '1101';

  const write = (message) => {
    server.write(new Buffer(`${message}!\r\n`), (error, bytesWritten) => {
      if (error) {
        logError('Error!');
        return Promise.reject(error);
      }
      return Promise.resolve(bytesWritten);
    });
  };

  run = () => {
    // @todo check for better option + make discoverable only for 2 minutes
    exec('sudo hciconfig hci0 piscan', (error, stdout, stderr) => {
      if (error) {
        logError(error);
        return;
      }
      log(`stdout: ${stdout}`);
      log(`stderr: ${stderr}`);
    });

    return Rx.Observable.create((observer) => {
      log('Run controller');
      server.listen((clientAddress) => {
        log('client:', clientAddress);
        write('connected');
        server.on('data', (buffer) => {
          const stringBuffer = buffer.toString();
          log('Received data from client:', stringBuffer);
          write(stringBuffer);
          observer.next(stringBuffer);
        });
      }, (error) => {
        observer.next({ error });
      });
    });
  };
} else {
  run = () => Rx.Observable.create((observer) => {
    observer.next('controller-not-available');
  });
}

module.exports = {
  run,
};
