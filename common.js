'use strict';

function mylog (msg) {
   let dateTime = new Date();
   let dateTimestr = '\n\x1b[93m' + String(dateTime).replace(/GMT.+/, '')  + '\x1b[0m '
   
   console.log(dateTimestr + msg)
    
}

module.exports = { mylog };
