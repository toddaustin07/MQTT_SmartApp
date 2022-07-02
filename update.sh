#!/bin/bash

#scp -P 1117 prometheus18x@192.168.1.145:/home/prometheus18x/smartthings/smartapps.js smartapps.js
scp -P 1117 prometheus18x@192.168.1.145:/home/prometheus18x/smartthings/mqttout.js mqttout.js
scp -P 1117 prometheus18x@192.168.1.145:/home/prometheus18x/smartthings/common.js common.js
scp -P 1117 prometheus18x@192.168.1.145:/home/prometheus18x/smartthings/locales/mqttout_en.json mqttout_en.json

