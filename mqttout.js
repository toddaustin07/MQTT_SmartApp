/*

  Copyright 2022 Todd Austin

  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
  except in compliance with the License. You may obtain a copy of the License at:

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software distributed under the
  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied. See the License for the specific language governing permissions
  and limitations under the License.

  DESCRIPTION:  SmartThings SmartApp to send out MQTT messages for device capability state changes.  Requires
  a SmartApp webhook project defined in Developer Workspace.

*/


'use strict';

const SmartApp = require('@smartthings/smartapp');
const common = require('./common');
var mqtt=require('mqtt');
const fs = require('fs');

var mqttconfig = {
    ipaddr: '',
    port: 1883,
    userid: '',
    password: '',
    toptopic: 'smartthings',
    retain: false,
    qos: 1
}    
    
var status_topic;
var msg_topic;
var msg_queue = [];

var mqttClient;



var pub_options = {
        retain:false,
        qos:1};


/* Defines the SmartApp */
const app = new SmartApp()
    //.enableEventLogging(2)               // Log and pretty-print all lifecycle events and responses
    .configureI18n({prefix: 'mqttout_'})   // Use file from locales directory for configuration page localization
    .page('mainpage', (context, page, configData) => {
        page.section('main', section => {
            section.pageSetting('MQTTconfig')
                .description('Tap to configure')
                .page('mqttpage')
                
            section.pageSetting('deviceconfig')
                .description('Tap to configure')
                .page('devicepage')
        });
    })
        
    .page('mqttpage', (context, page, configData) => {
        page.previousPageId('mainpage')
        page.section('MQTT', section => {
            section.textSetting('brokerIP')
                   .minLength(7)
                   .maxLength(15)
                   .defaultValue('192.168.1.nnn')
                   .required(true)
                
            section.numberSetting('brokerPort')
                   .min(1)
                   .max(65535)
                   .defaultValue(1883)
                   .required(true)  
                
            section.textSetting('brokerUserid')
                   .required(false)
                   
            section.passwordSetting('brokerPW')
                   .minLength(4)
                   .required(false)
                   
            section.textSetting('topic')
                    .defaultValue('smartthings')
                    .required(true)
                   
            section.booleanSetting('retain')
                   .defaultValue(false)
                   .required(true)
                   
            section.enumSetting('qos')
                   .options(['0','1','2'])
                   .defaultValue('1')
                   .required(true)  

        });
    })
        
    .page('devicepage', (context, page, configData) => {
        page.previousPageId('mainpage')
        page.section('devices', section => {
            section.deviceSetting('buttonList')
                .capabilities(['button'])
                .multiple(true)
                .required(false)
                .permissions('r')
                
            section.deviceSetting('contactList')
                .capabilities(['contactSensor'])
                .multiple(true)
                .required(false)
                .permissions('r')
            
            section.deviceSetting('motionList')
                .capabilities(['motionSensor'])
                .multiple(true)
                .required(false)
                .permissions('r')
            
            section.deviceSetting('presenceList')
                .capabilities(['presenceSensor'])
                .multiple(true)
                .required(false)
                .permissions('r')
            
            section.deviceSetting('switchList')
                .capabilities(['switch'])
                .multiple(true)
                .required(false)
                .permissions('r')
            
        });
    })
    
    
    /* Handle SmartApp Configuration Updates (also called first time SmartApp is installed via mobile app */
    
    .updated(async (context, updateData) => {
        await context.api.subscriptions.unsubscribeAll();
        
        var sublist = [];
        
        if (context.config.hasOwnProperty('buttonList')) {
            sublist.push(context.api.subscriptions.subscribeToDevices(context.config.buttonList, 'button', 'button', 'buttonHandler'))
        }
        if (context.config.hasOwnProperty('contactList')) {
            sublist.push(context.api.subscriptions.subscribeToDevices(context.config.contactList, 'contactSensor', 'contact', 'contactHandler'))
        }
        if (context.config.hasOwnProperty('motionList')) {
            sublist.push(context.api.subscriptions.subscribeToDevices(context.config.motionList, 'motionSensor', 'motion', 'motionHandler'))
        }
        if (context.config.hasOwnProperty('presenceList')) {
            sublist.push(context.api.subscriptions.subscribeToDevices(context.config.presenceList, 'presenceSensor', 'presence', 'presenceHandler'))
        }
        if (context.config.hasOwnProperty('switchList')) {
            sublist.push(context.api.subscriptions.subscribeToDevices(context.config.switchList, 'switch', 'switch', 'switchHandler'))
        }

        // Take care of any MQTT-related setting changes
        maintain_mqttconfig(context.config);

        return Promise.all(sublist)
    })
    
    
    /* Event Handlers - Send MQTT message with updated value */
    
    .subscribedEventHandler('buttonHandler', (context, deviceEvent) => {
        common.mylog (`Subscribed event: Button device attribute changed to ${deviceEvent.value}`);
        proc_event(context, deviceEvent);
    })
    .subscribedEventHandler('contactHandler', (context, deviceEvent) => {
        common.mylog (`Subscribed event: Contact device attribute changed to ${deviceEvent.value}`);
        proc_event(context, deviceEvent);
    })
    .subscribedEventHandler('motionHandler', (context, deviceEvent) => {
        common.mylog (`Subscribed event: Motion device attribute changed to ${deviceEvent.value}`);
        proc_event(context, deviceEvent);
    })
    .subscribedEventHandler('presenceHandler', (context, deviceEvent) => {
        common.mylog (`Subscribed event: Presence device attribute changed to ${deviceEvent.value}`);
        proc_event(context, deviceEvent);
    })
    .subscribedEventHandler('switchHandler', (context, deviceEvent) => {
        common.mylog (`Subscribed event: Switch device attribute changed to ${deviceEvent.value}`);
        proc_event(context, deviceEvent);
    })
    

// Publish MQTT messages for device attribute updates
function proc_event(context, deviceEvent) {
    
    // Take care of any MQTT-related setting changes
    // - Needed here when this module re-started and receives device event without prior .updated event
    msg_queue.push({context: context, event: deviceEvent});
    
    if (maintain_mqttconfig(context.config) == false) {
        
        sendMQTT();
        
    }
} 

// Publish whatever is in msg_queue
async function sendMQTT() {

    if (msg_queue.length > 0) {

        const msg_tosend = msg_queue.pop();

        const topic = await buildtopic(msg_tosend.context, msg_tosend.event, mqttconfig.topicsegs);
        if (topic != null) {
        
            mqttClient.publish(topic, msg_tosend.event.value, pub_options, (err) => {
                if (err) {
                    common.mylog("Error sending MQTT message: " + err);
                } else {
                    common.mylog("Published '" + msg_tosend.event.value + "' to " + topic);
                }
            });
        }
    }
}
  
/*
async function getdevinfo(context, deviceID) {
    
    const devinfo = await context.api.devices.get(deviceID);
    
    return (devinfo)
}

async function getroominfo(context, locationID, roomID) {
    
    await context.api.rooms.get(locationID, roomID)
        .then(roominfo => {
            console.log(roominfo);
            return (roominfo);
        })
        .catch(err => {
            console.log('Error fetching room info: ' + err);
        });
}
*/

async function buildtopic(context, event, segments) {

    var topic = "";
    var devinfo, roominfo;
    var nospace;

    for (let i=0; i< segments.length; i++) {
       
        switch(segments[i]) {
               
            case '|capability':
                topic = topic + event.capability + '/';
                break;
               
            case '|attribute':
                topic = topic + event.attribute + '/';
                break;
                
            case '|deviceid':
                topic = topic + event.deviceId + '/';
                break;
                
            case '|label':
                if (devinfo == null) {
                    devinfo = await context.api.devices.get(event.deviceId);
                    if (devinfo != null) {
                        nospace = devinfo.label.replaceAll(' ','_');
                        topic = topic + nospace + '/';
                    } else {
                        common.mylog ('Error occurred fetching device description');
                    }
                }
                break;
                
            case '|name':
                if (devinfo == null) {
                    devinfo = await context.api.devices.get(event.deviceId);
                    if (devinfo != null) {
                        nospace = devinfo.name.replaceAll(' ','_');
                        topic = topic + nospace + '/';
                    } else {
                        common.mylog ('Error occurred fetching device description');
                    }
                }
                break;
                                
            case '|room':
                console.log('devinfo: ' + devinfo);
                if (devinfo == null) {
                    devinfo = await context.api.devices.get(event.deviceId);
                }
                if (devinfo != null) {
                    console.log('roomId: ' + devinfo.roomId);
                    console.log('locationId: ' + event.locationId);
                    roominfo = await context.api.rooms.get(devinfo.roomId, event.locationId);
                    if (roominfo != null) {
                        topic = topic + roominfo.name + '/';
                    } else {
                       common.mylog ('Error occurred fetching room description'); 
                    }
                } else {
                    common.mylog ('Error occurred fetching device description');
                }
                break;
                
            default:
            
                topic = topic + segments[i] + '/';
        }
    }

    topic = topic.substring(0,topic.length - 1);
    
    return topic;

}

function maintain_mqttconfig(config) {
    
    const changed = mqttconfig_changed(config);
    if (changed) {
        common.mylog('SmartApp MQTT configuration was updated');
        if (mqttClient != null) {
            if (mqttClient.connected) {
                mqttClient.publish(status_topic, "SmartThings MQTT SmartApp config was updated", {retain:false, qos:0});
            }
        }
        update_mqttconfig(config);
    }
    
    return changed;
}    
        
// Returns true if we received any updates to MQTT-related settings
function mqttconfig_changed(config) {

    var changeflag = false;
    
    if (config.brokerIP[0].stringConfig.value !== mqttconfig.ipaddr) { changeflag = true }
    if (Number(config.brokerPort[0].stringConfig.value) !== mqttconfig.port) { changeflag = true }
    
    var new_userid = "";
    var new_password = "";
    if (config.hasOwnProperty('brokerUserid')) { new_userid = config.brokerUserid[0].stringConfig.value }
    if (config.hasOwnProperty('brokerPassword')) { new_password = config.brokerPassword[0].stringConfig.value }
    
    if (new_userid !== mqttconfig.userid) { changeflag = true }
    if (new_password !== mqttconfig.password) { changeflag = true }
        
    if (config.topic[0].stringConfig.value !== mqttconfig.topictemplate) { changeflag = true }
    
    var bool_retain = false;
    if (config.retain[0].stringConfig.value === 'true') { bool_retain = true }
    if (bool_retain !== mqttconfig.retain) { changeflag = true }
    
    if (Number(config.qos[0].stringConfig.value) !== mqttconfig.qos) { changeflag = true }

    return (changeflag)
}    
    

// Update MQTT config file with latest values and restart MQTT connection
function update_mqttconfig(config) {

    mqttconfig.ipaddr = config.brokerIP[0].stringConfig.value
    mqttconfig.port = Number(config.brokerPort[0].stringConfig.value)
    
    mqttconfig.userid = ''
    if (config.hasOwnProperty('brokerUserid')) {
        mqttconfig.userid = config.brokerUserid[0].stringConfig.value
    }
    mqttconfig.password = ''
    if  (config.hasOwnProperty('brokerPassword')) {
        mqttconfig.password = config.brokerPassword[0].stringConfig.value
    }
    
    mqttconfig.topictemplate = config.topic[0].stringConfig.value
    mqttconfig.topicsegs = config.topic[0].stringConfig.value.split('/')
    
    if (config.retain[0].stringConfig.value == 'true') {
        mqttconfig.retain = true;
    } else {
        mqttconfig.retain = false;
    }
    mqttconfig.qos = Number(config.qos[0].stringConfig.value)

    mqttinit();

}

function mqttconnect(url, options) {
    
    mqttClient = mqtt.connect(url, options)
    
        .on("connect", () => {
            common.mylog("MQTT Broker connected");
            mqttClient.publish(status_topic, "SmartThings MQTT SmartApp has (re)connected", {retain:false, qos:0});
            sendMQTT();       // send any outstanding message
        });

    mqttClient.stream.on("error", (error) => {
        common.mylog("Can't connect to MQTT Broker: " + error);
        mqttClient.end(true)
    });
}        

// Initialize MQTT Broker connection
function mqttinit() {
 
    var connect_options = {
            clientId: "smartthings",
            clean: true };

    if (mqttconfig.userid !== "" && mqttconfig.password !== "") {
        connect_options.username = mqttconfig.userid
        connect_options.password = mqttconfig.password
    }

    pub_options.retain = mqttconfig.retain
    pub_options.qos = mqttconfig.qos
    status_topic = mqttconfig.topicsegs[0] + "/status"
    
    const brokeraddr = "http://" + mqttconfig.ipaddr + ":" + mqttconfig.port.toString()

    if (mqttClient != null) {
        if (mqttClient.connected) {
            mqttClient.end(true, {reasonString: "User reset"}, () => {
                common.mylog("MQTT Broker connection is being reset");
                mqttconnect(brokeraddr, connect_options);
                
            });
        } else {
            mqttconnect(brokeraddr, connect_options);
        }
    } else {
        mqttconnect(brokeraddr, connect_options);
    }
}
    
module.exports = { app };
