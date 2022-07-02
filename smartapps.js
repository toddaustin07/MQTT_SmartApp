/*

  Copyright 2022 Todd Austin

  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
  except in compliance with the License. You may obtain a copy of the License at:

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software distributed under the
  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied. See the License for the specific language governing permissions
  and limitations under the License.

  DESCRIPTION:  SmartThings SmartApp Manager - provides a framework to run multiple SmartApps off one ngrok tunnel

*/


'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const SmartApp = require('@smartthings/smartapp');
const common = require('./common')

const server = module.exports = express();
server.use(bodyParser.json());

// Load configuration
const { port, applist } = require('./config');

var appmodules = [];


/* Handles lifecycle events from SmartThings */
server.post('/', async (req, res) => {
    common.mylog ('HTTP POST received: ' + req.body.lifecycle + ' for App ID ' + req.body.appId)
    
    var appmodule = ''
    
    for (let i = 0; i < applist.length; i++) {
    
        if (req.body.appId == applist[i].appid) {
            appmodule = appmodules[i];
            break;
        }
        
    }
    
    if (appmodule == '') {
        common.mylog ('Unrecognized App ID - message ignored');
        return;
    }
    
    appmodule.app.handleHttpCallback(req, res);
    
});
    
    
/* *************** MAIN **************** */        

var i = 0

// Try to load each SmartApp module defined in config file
try {
    applist.forEach(function(appinfo) {
        appmodules[i++] = require('./'+appinfo.module)
    });
} catch (err) {
    common.mylog('Could not load SmartApp module configured in ./config.json')
    common.mylog(err);
    process.exit(1);
}


/* Starts the Express HTTP server */
server.listen(port, common.mylog(`Listening for SmartApp messages at ${port}`));

/* Allow for HTML Page requests */
server.use(express.static('public'));
