const { exec } = require('child_process');

addTransmissionMagnetlink("magnet?://randomdatagoeshere13245")

//add the magnetlink to the transmission demon
function addTransmissionMagnetlink(magnet){
    exec(`echo transmission-remote -n 'user:password' -a '${magnet}'`, (err, stdout, stderr) => {
        if (err) {
          // node couldn't execute the command
          console.log(`Could not execute the commeand: ${err}`)
          return;
        }
      
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      });
}