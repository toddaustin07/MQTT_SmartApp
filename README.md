# MQTT SmartApp
This SmartApp provides a mechanism to externalize SmartThings device states using MQTT.  No additional MQTT bridges are needed besides an MQTT Broker.

With this SmartApp, users can select SmartThings devices and then for the chosen capability, any state (attribute) changes will be published as an MQTT message.  The topic used for the message allows message recipients to determine the source device, capability, and attribute.  The message itself simply contains the updated attribute value.

This will work with all SmartThings devices - whether new Edge-based devices, legacy Groovy/DTH-based devices, or cloud-based devices.

This SmartApp is intended to be run on a local computer with internet access, but could be modified fairly easily to run on AWS or other cloud server environment.

## Caveats
This SmartApp is still being refined and tested as of June 2022.  Currently, the following device types are supported: `switch, button, contact, motion, presence`

The intention is to expand this list to nearly all relevant SmartThings device types, but the speed at which this list is expanded will depend entirely on community interest.

Testing has been only done so far with ngrok and Mosquitto-based configurations on a Raspberry Pi.

## Requirements
### Network
- Fixed IP address, accessable *from* the internet
  - To avoid having to setup and maintain a full-blown internet server, a utility like [ngrok](https://ngrok.com/) or similar applications can be used to create a secure tunnel. This is very simple thing to do, and is safe and secure.
### Server
- nodeJS (this application was developed and tested on version 16.3.1)
- [SmartThings SmartApp SDK for nodeJS](https://github.com/SmartThingsCommunity/smartapp-sdk-nodejs)
- [ngrok](https://ngrok.com/) (free tier is sufficient) or alternative
### MQTT Broker
- Presumed to be running on your local network
- Commonly used: [Mosquitto](https://mosquitto.org/download/)
### SmartThings
- [Samsung SmartThings account](https://us.account.samsung.com/accounts/v1/STWS/terms#)
- Developer mode enabled in mobile app
- [Developer Workspace](https://smartthings.developer.samsung.com/workspace) project

## Setup
We will assume the use of ngrok and Mosquitto on a Raspberry PI 4 running Raspberry PI OS (Debian Linux)
### Server
#### Install nodeJS
- Download latest binary from https://nodejs.org/en/download/
- Extract the downloaded file using tar -xf \<filename\> (may need to apt-install xz-utils)
- Change to new subdirectory and run: sudo cp -R * /usr/local/
- Test by returning to home directory and run: node \-\-version
#### Install SmartApp SDK for nodeJS
- Create a project directory and change to it
- Install using npm:
```
npm i @smartthings/smartapp --save
```
#### Install Mosquitto
*Note that this can be installed on a separate server on your network.*
```
sudo apt update && sudo apt upgrade
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto.service
```
#### Install ngrok
- [Sign up](https://ngrok.com/) for ngrok's free tier account
- Follow the [Getting Started Guide](https://ngrok.com/docs/getting-started) for installing, starting, and testing ngrok
- Choose a port number to use for your SmartApp, e.g. 8083, and start ngrok
```
ngrok https 8083
```
- Open a browser window for URL:  http://localhost:4040/status
- Click on **Status** link at the top black menu bar
- Take note of your assigned command_line URL address (in the format: https://xxxx-xx-x-xxx-xxx.ngrok.io)
- Click on **Inspect** link at the top black menu bar: this page will show details of all received POST messages from SmartThings
### Create Developer Workplace project
- Sign in to Developer Workspace
- Create New Project and choose 'Automation for the SmartThings App'
- Name the project (e.g. MQTT Sender)
- Choose Register App, then WebHook Endpoint
- Enter the URL from ngrok (e.g. https://xxxx-xx-x-xxx-xxx.ngrok.io)
- Provide an App Display Name and Description
- Select Permissions required:  r:devices* and r:locations:*
- Leave *SmartApp Instances* and *Custom Parameters* empty and click **SAVE**
- Copy Client ID and Client Secret (although you won't use them) and click **GO TO PROJECT OVERVIEW**
- Click **VERIFY APP REGISTRATION**
  - SmartThings will send a CONFIRMATION request.  This message contains a confirmation URL that you must type into a browser in order to verify your URL address.  You will see this message back on the ngrok browser page if you have clicked the **Inspect** menu.  You should see a POST message displayed on the right sight of the page, which contents as follows:
```
{
  "lifecycle": "CONFIRMATION",
  "executionId": "8F8FA33E-2A5B-4BC5-826C-4B2AB73FE9DD",
  "appId": "fd9949ee-a3bf-4069-b4b3-3e9c1c922e29",
  "locale": "en",
  "version": "0.1.0",
  "confirmationData": {
    "appId": "fd9949ee-a3bf-4069-b4b3-3e9c1c922e29",
    "confirmationUrl": "{CONFIRMATION_URL}"      <<<<<=======
  },
  "settings": {}
}
```
The CONFIRMATION_URL should be copied and pasted into another browser tab and press enter.  This is will validate your URL, and the "VERIFY APP REGISTRATION" notice back on the Developer Workspace page should go away
- You can now click the **DEPLOY TO TEST** button.
- Optionally start *Live Logging*

### Download and configure SmartApp
- Clone this repository onto your server or otherwise download these files to your project directory:
```
smartapps.js
mqttout.js
mqttout_en.json   (goes in locals subdirectory)
config.json
```
- Edit config.json
  - Change port number if needed (defaults to 8083)
  - Copy the APPID generated by the Developer Workspace into the *applist.appid* element (where *"module": "mqttout"*)
- Start the SmartApp:
```
node smartapp.js
```
### Install the new smartapp in your SmartThings mobile app
- Go to the Automations page in the mobile app
- Tap on the '+' in the upper right and select *Add routine*
- Tap the *Discover* tab
- Scroll down the list of SmartApps until you see one with the name you choose in the Developer Workspace
  - You may see duplicate entries (this is a bug in SmartThings).  Usually the one that actually work is the one *missing* the description.
- Tap your SmartApp
- You now should see activity on your ngrok Inspect page, as well as console log messages from your SmartApp on your server
- Once the SmartApp is 'installed' in your mobile app, it should should be listed whenever you go to the *Automations* page and expand the *SmartApps* twisty.
#### Configuration
- When you open the MQTT smartapp in your mobile app, you will be taken to the main configuration page where you can rename the SmartApp and navigate to the Configuration options.
- There are two main parts of configuration: (1) MQTT settings and (2) Device capability selection
##### MQTT Settings
- **Broker IP Address**:  Enter the IP address of the server where your MQTT broker is running (e.g. Mosquitto)
- **Broker Port**:  This defaults to the standard MQTT port 1883, but can be modified if needed
- **Broker Authentication USERID**:  If you have configured your broker to require sign-in, provide the userid here
- **Broker Authentication Password**:  If you have configured your broker to require sign-in, provide the password here
- **Top-level Topic**:  All message published will begin with this topic; defaults to 'smartthings'
- **Retain Option**:  Turn on if you want the broker to retain the last message to send to the next subscriber
- **Quality of Service (QoS)**: Tap to choose level 0, 1, or 2
##### Device capability selection
Here you will choose devices based on their capabilities.  For each device chosen, an MQTT message will be published whenever the state changes for the capability.
- Once you have finished, tap *Done* and then tap *Allow* on the next page
- Your SmartApp configuration is now complete.
### Testing
When the nodeJS application initially run, it will log a message saying that MQTT configuration does not exist.  That is normal:  you'll need to configure your MQTT options in the SmartApp mobile app interface.  Once you have completed those steps (outlined above), you will see additional console log messages from the nodeJS application indicating if it successfully connected to the MQTT Broker.  And then additional messages when SmartThing device state changes are received and forwarded to MQTT.
## MQTT Messages
All MQTT messages sent by the SmartApp will use the following topic format:
`smartthings/<device_id>/<capability>/<attribute>`

*Note that the top-level of 'smartthings' can be changed in the SmartApp MQTT configuration.*
### Examples
| Topic                                      | Message       |
| -----------------------------------------------| ------------|
| smartthings/8b6d9e55-be64-4e61-a637-54524be04685/motionSensor/motion | active   |
| smartthings/8b6d9e55-be64-4e61-a637-54524be04685/motionSensor/motion | inactive |
| smartthings/2af6229b-ea39-2f03-f07b-920e103c8429/switch/switch       | on       |
| smartthings/2af6229b-ea39-2f03-f07b-920e103c8429/switch/switch       | off      |

### SmartThings Capabilities Reference
For a list of all capabilities and their attributes supported by SmartThings, see these links:

[Production Capabilities](https://developer-preview.smartthings.com/docs/devices/capabilities/capabilities-reference)

[Proposed Capabilities](https://developer-preview.smartthings.com/docs/devices/capabilities/proposed)

## Advanced
### Running additional SmartApps on your local server
The free tier of ngrok provides only one URL to use.  Therefore, all SmartApps you wish to run on your local server must operate over this one common network link.  The smartapps.js module provides a framework to enable multiple SmartApps.  The config.json file provides a mapping of SmartThings application ID to module name so that it can route SmartThings POST messages to the proper module.

If you want to run other SmartApps on your local server in addition to the MQTT Sender app, edit the config.json file to add the appid (SmartThings *APPID* assigned by Developer Workspace project) and module name (.js file) in the applist element.  Copy your other SmartApp .js files to the same directory, and copy any language files to the *locales* subdirectory.

Your module should export your instantiated SmartApp and an init() function that will be called after the module is loaded to perform any additional initialization required for your SmartApp.  Reference the mqttout.js file for an example.

Your module will be loaded by smartapps.js during startup and all POST messages will be routed to it.
