# MQTT SmartApp
This SmartApp provides a mechanism to externalize SmartThings device states using MQTT.  It runs on your local network so there is no need for any additional bridges.

With this SmartApp, users can select SmartThings devices and then for the chosen capability, any state (attribute) changes will be published as an MQTT message.  The topic used for the message allows message recipients to determine the source device, capability, and attribute.  The message itself simply contains the updated attribute value.

This will work with all SmartThings devices - whether new Edge-based devices, legacy Groovy/DTH-based devices, or cloud-based devices.

This SmartApp is intended to be run on a local computer with internet access, but could be modified fairly easily to run on AWS or other cloud server environment.

## Why??!
There already exist solutions to integrate SmartThings with MQTT, often using some kind of bridge.  These existing SmartApps were written in Groovy and run on SmartThings servers today.

As most users know already, SmartThings is kicking off all device drivers and SmartApps from their own infrastructure.  When the transition is completed, any SmartApp needs to be running on its own internet server or AWS.  As a result, all Groovy-based drivers and SmartApps are going to have to be re-written and re-platformed or they will no longer be available.

This SmartApp was developed for the new architecture using the new SmartApp SDK, and implemented as a supported webhook nodeJS application.  It is intended to run on your own local LAN server, using any available MQTT broker.  Therefore no bridge is required.  Although the nodeJS implementation of the SmartApp is running locally, it still is dependent on an internet connection to receive subscribed events from SmartThings.  (This is unlike the new Edge device drivers which can run on a local SmartThings hub even when the internet connection is down.)

## Caveats
This SmartApp is still being refined and tested as of July 2022.  Currently, the following device types are supported: `switch, button, contact, motion, presence`

The intention is to expand this list to nearly all relevant SmartThings device types, but the speed at which this support is expanded will depend entirely on community interest and priorities.

Testing has only been done so far with ngrok and Mosquitto-based configurations on a Raspberry Pi running Raspberry Pi OS (Linux), although there is nothing inherent in the code that would prevent it from running on other operating environments.  The operating environment needs to support nodeJS and provide the needed internet access.

Note: This document assumes the reader has at least a basic working knowledge of Linux, installing packages, editing files, etc.

## Requirements

### Network
- Fixed internet IP address
  - To avoid (1) having to pay extra to your ISP for a fixed IP (not even an option from some ISPs), or (2) setting up and maintaining a full-blown internet server (yikes!), a utility like [ngrok](https://ngrok.com/) or similar can be used to create a secure tunnel from the internet to your server, and assigns you a 'fixed' URL to use. This is very simple thing to do, and is sufficiently safe and secure for most personal uses.
### Server
- nodeJS (this application was developed and tested on version 16.3.1)
- [SmartThings SmartApp SDK for nodeJS](https://github.com/SmartThingsCommunity/smartapp-sdk-nodejs)
- [ngrok](https://ngrok.com/) (free tier is sufficient) or alternative
- If intending to run on a Raspberry Pi, I would strongly recommend the full GUI-based OS so you can use the ngrok browser-based console
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
Although ngrok is a safe and secure method to access your server from the internet, it is still a good idea to do everything you can to secure your computer from malicious attacks.  See the 'Advanced' section below for some tips on doing that.
#### Install nodeJS
- Download latest binary from https://nodejs.org/en/download/
- Extract the downloaded file using tar -xf \<filename\> (may need to apt-install xz-utils)
- Change to the new extraction subdirectory and run: sudo cp -R * /usr/local/
- Test by returning to home directory and run: node \-\-version
#### Install SmartApp SDK for nodeJS
- Create a project directory and cd into it (e.g. ~/smartthings/smartapps)
- Install the SDK using npm:
```
npm i @smartthings/smartapp --save
```
#### Install Mosquitto
*Note that the MQTT broker can be installed on a separate server on your network.*
```
sudo apt update && sudo apt upgrade
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto.service
```
#### Install ngrok
- [Sign up](https://ngrok.com/) for ngrok's free tier account
- Follow the [Getting Started Guide](https://ngrok.com/docs/getting-started) for installing and testing ngrok
- Choose a port number to use for your SmartApp, e.g. 8083, and start ngrok:
```
ngrok https 8083
```
- Open a browser window for URL:  http://localhost:4040/status
  - This is ngrok's browser-based console
- Click on the **Status** link at the top black menu bar
- Take note of your assigned 'command_line URL' address (in the format: https://xxxx-xx-x-xxx-xxx.ngrok.io)
- Click on the **Inspect** link at the top black menu bar: this page will show details of all received POST messages from SmartThings

### Create Developer Workplace project
- Sign in to Samsung SmartThings [Developer Workspace](https://smartthings.developer.samsung.com/workspace)
- Create New Project and choose 'Automation for the SmartThings App'
- Name the project (e.g. MQTT Sender)
- Choose *Register App*, then *WebHook Endpoint*
- Enter the URL from ngrok (e.g. https://xxxx-xx-x-xxx-xxx.ngrok.io)
- Provide an App Display Name and Description
- Select Permissions required:  r:devices* and r:locations:\* (and also r:customcapability, if desired)
- Leave *SmartApp Instances* and *Custom Parameters* empty and click **SAVE**
- Copy Client ID and Client Secret (although you won't use them) and click **GO TO PROJECT OVERVIEW**
- Click **VERIFY APP REGISTRATION**
  - This will cause SmartThings to send a CONFIRMATION request to your ngrok address.  This message contains a confirmation URL that you must type into a browser in order to verify your URL address.  You will see this message back on the ngrok browser console page if you have clicked the **Inspect** menu there.  You should see a POST message displayed on the right side of the page, with contents similar to the following:
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
The *CONFIRMATION_URL* should be copied and pasted into the address bar of another browser tab.  Press enter, and this will validate your URL, and the "VERIFY APP REGISTRATION" notice back on the Developer Workspace page should disappear.
- You can now click the **DEPLOY TO TEST** button.
- Optionally start *Live Logging*
  - This will log messages from the SmartThings side of things whenever there is activity with your SmartApp

### Download and configure the nodeJS SmartApp
- Clone [this github repository](https://github.com/toddaustin07/MQTT_SmartApp.git) onto your server and copy these files to the project directory you created earlier (and installed the SDK into):
```
smartapps.js
mqttout.js
mqttout_en.json   (goes in locales subdirectory)
config.json
```
- Edit config.json
  - Change port number if needed (defaults to 8083)
  - Copy the APPID generated by the Developer Workspace into the *applist.appid* json element
- Start the SmartApp:
```
node smartapp.js
```
- You should see a console log message indicating the SmartApp is listening on port 8083 (or whatever you are using).
- Once you complete installing & configuring the SmartApp in the mobile app (outlined below), you will see additional console log messages from the nodeJS application indicating if it successfully connected to the MQTT Broker.  And then additional messages will be logged whenever SmartThing device state changes are received and forwarded to MQTT.

### Install the new SmartApp in your SmartThings mobile app
- Go to the Automations page in the mobile app
- Tap on the '+' in the upper right and select *Add routine*
- Tap the *Discover* tab
- Scroll down the list of SmartApps until you see one with the name you chose in the Developer Workspace
  - You may see duplicate entries (this is a bug in SmartThings).  Usually the one that actually works is the one *missing* the description.
  - If you don't find your SmartApp listed, make sure you have developer mode enabled (in SmartThings mobile app settings), and that you completed the Developer Workspace project steps outlined earlier.
- Tap your SmartApp
- You now should see activity on your ngrok Inspect page, as well as console log messages from your nodeJS SmartApp on your server indicating POST messages received
- Once the SmartApp is 'installed' in your mobile app (after configuring for the first time - see below), it should be listed whenever you go to the *Automations* page and expand the *SmartApps* twisty.
#### Configuration
- When you open the MQTT smartapp in your mobile app, you will be taken to the main configuration page where you can rename the SmartApp and navigate to the Configuration options.
- There are two main parts of configuration: (1) MQTT settings and (2) Device selection by capability
##### MQTT Settings
- **Broker IP Address**:  Enter the IP address of the server where your MQTT broker is running (e.g. Mosquitto)
- **Broker Port**:  This defaults to the standard MQTT port 1883, but can be modified if needed
- **Broker Authentication USERID**:  If you have configured your broker to require sign-in, provide the userid here
- **Broker Authentication Password**:  If you have configured your broker to require sign-in, provide the password here
- **Topic Template**:  All device state change MQTT messages published will be sent using this topic; see below for details
- **Retain Option**:  Turn on if you want the broker to retain the last message to send to the next subscriber
- **Quality of Service (QoS)**: Tap to choose level 0, 1, or 2
##### Device Selection
Here you will choose devices based on their capabilities.  (For each device chosen, an MQTT message will be published whenever the state changes for the capability)
- Once you have finished selecting devices, return to the main page, tap *Done*, and then tap *Allow* on the next page.
- Your SmartApp configuration is now complete.
- Monitor the console log messages on your server to be sure the broker connection was successful and no errors occurred.

## Topic Template
The topic used to send MQTT messages will be based on the 'Topic Template' field in the SmartApp MQTT configuration screen.  The template allows you to specify what topic string to use, and can contain topic levels that are dynamic, as outlined below.

### Dynamic topic levels
Using certain special string elements in the Topic Template will result in dynamic substituion of their value.  These special identifiers will always begin with a '|' character (vertical bar).  These special strings are to be used as a level element of a topic (*level1/level2/level3*), and cannot be combined with fixed strings *within* the same level element.

Currently supported are the following:
| String element | Dynamically Substituted Value                |
| -------------- | -------------------------------------------- |
| \|deviceid     | SmartThings UUID-format deviceId             |
| \|label        | SmartThings user-defined device label\*      |
| \|name         | SmartThings integration-assigned device name |
| \|capability   | SmartThings capability name\*\*                |
| \|attribute    | SmartThings capability attribute\*\*           |

\* If a label value contains blanks, they will be replace with '\_' (underscore) characters.  For example "My motion device" becomes "My_motion_device".

\*\* See *SmartThings Capabilities Reference* below for more info on SmartThings capabilities.

#### Examples
| Topic Template                                     | Example Topics                                                                        |
| ---------------------------------------------------| -------------------------------------------------------------------------------------|
| smartthings/alert/node1                            | smartthings/alert/node1                                                              |
| mytoplevel/alert/node2                             | mytoplevel/alert/node2                                                               |
| smartthings/\|deviceid/\|capability/\|attribute       | smartthings/8b6d9e55-be64-4e61-a637-54524be04685/switch/switch                       |
| smartthings/\|deviceid/\|capability/\|attribute       | smartthings/2af6229b-ea39-2f03-f07b-920e103c8429/motionSensor/motion                 |
| smartthings/\|label/mynotice                       | smartthings/some_device_label/mynotice                                               |

- Fixed string elements should be limited to the character set \[a-zA-Z0-9_] to avoid any unexpected problems.

- Combining a dynamic element with a fixed string is not current supported (i.e. 'mydeviceid_|deviceid').

- Note that Topic Templates can contain any combination of fixed string elements and dynamic elements.  Any element not beginning with a '|' or not one of the special dynamic elements listed above, will be treated as a fixed string element.  

- Of course, the overall Topic Template should conform to the standard MQTT addressing format consisting of one or more topic levels separated by '/'.

### Status Messages
The top level topic from the Topic Template will be used to send various status messages such as indications of MQTT (re)connection or SmartApp configuration changes.  For example, if the top level topic is 'smartthings', the following topic will be used for these status messages: 'smartthings/status'.  This topic can be subscribed-to for notification of the operational status of the nodeJS SmartApp.

## Testing/Verification
Start up an MQTT subscription utility and subscribe to the topic level topic you configured in Topic Template, e.g. 'smartthings/#':
- mosquitto_sub
  ```
  mosquitto_sub -v -h localhost -t "smartthings/#"
  ```
- nodeJS mqtt
  ```
  mqtt sub -t 'smartthings/#' -h <broker_ip> -v
  ``` 
You can monitor all messages that are being sent by the SmartApp.  

## SmartThings Capabilities Reference
For a list of all capabilities and their attributes supported by SmartThings, see these links:

[Production Capabilities](https://developer-preview.smartthings.com/docs/devices/capabilities/capabilities-reference)

[Proposed Capabilities](https://developer-preview.smartthings.com/docs/devices/capabilities/proposed)
- although in 'proposed' status, these capabilities are also available but may not be 100% functional

## Advanced
### Securing your server
These tips are tailored for a Linux-based Raspberry Pi server, but can apply to any internet-accessable server with the appropriate modifications.  You can choose to implement any or all of these tips, depending upon your level of paranoia!

#### Create new user account with admin and sudo priviledges
Don't keep using the default 'pi' account.
```
  sudo adduser <username>
  sudo gpasswd -a <username> adm
  sudo gpasswd -a <username> sudo
```
- lock 'pi' user account
```
  passwd -l pi
```

#### Setup auto updates with unattended-upgrades package
It's important to keep all packages upgraded to the latest versions to pick up any security issue fixes
- Install unattended-upgrades package
- Add lines to /etc/apt/apt.conf.d/50unattended-upgrades
```
Unattended-Upgrade:Origins-Pattern {  
  "origin=Debian,codename=${distro_codename},label=Debian";
  "origin=Debian,codename=${distro_codename},label=Debian-Security";
  "origin=Raspian,codename=${distro_codename},label=Raspian";
  "origin=Raspberry Pi Foundation,codename=${distro_codename},label=Raspberry Pi Foundation";
};
```
  - create file /etc/apt/apt.conf.d/02periodic
```
APT::Periodic::Enable "1";
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "1";
APT::Periodic::Verbose "2";
```
  - Periodically monitor logs in:  /var/log/unattended-upgrades

#### Disable unneeded services/port usage with systemctl
The fewer running services & open ports you have, the fewer exposures you have.
```
  systemctl --type=service --state=active
  sudo systemctl disable --now <servicename>
```

#### Install a firewall (ufw)
- First, be aware of all open ports on your server:
```
sudo ss -tupln -OR- netstat -an | grep 'LISTENING'
```
- Disable any ports/services you don't want (see above)
- Install ufw
```
sudo apt install ufw
```
- Explictly allow only selected services:
```
sudo ufw allow <port></[tcp|udp]> comment "<whatever you want>"
sudo ufw status
```
- Block pings
  - Edit /etc/ufw/before.rules
  - Add line in 'ok icmp codes for INPUT' section:
  ```
  -A ufw-before-input -p icmp --icmp-type echo-request -j DROP
  ```
- Enable the firewall
```
sudo ufw enable
sudo ufw status verbose
```
- More ufw config info:  https://www.youtube.com/watch?v=9dXdmJCHAGQ

#### Create key pairs for SSH access
This is more secure than using passwords, and more convenient once set up.
1. Setup Pi directory
```
mkdir ~/.ssh && chmod 700 ~/.ssh
```

2. Create keys:
  - On *client* machine (e.g. Windows, Mac, or Linux):
    ```
    ssh-keygen -b 4096
    ```
  - Keys are in ~/.ssh

3. Copy public key to the server (Raspberry Pi)
  - From a Windows powershell:
    ```
    scp $env:USERPROFILE/.ssh/id_rsa.pub <username>@192.168.1.nnn:~/.ssh/authorized_keys
    ```
  - From a Linux client
    ```
    ssh-copy-id <username>@192.168.1.nnn
    ```
  - From a Mac client:
    ```
    scp ~/.ssh/id_rsa.pub <username>@192.168.1.nnn:~/.ssh/authorized_keys
    ```

#### Restrict SSH
Clamp down on who can sign in through SSH.
- Edit  /etc/ssh/sshd_config
- Change port number to something *other* than the standard SSH port (22) 
- Change AddressFamily to inet (ipv4 only)
- Disable root login
- Allow only specific users
```
Port <nnnn>
AddressFamily inet
PermitRootLogin no
AllowUsers <username>
```
- Optional:  disable all password authentication (key pair only): `PasswordAuthentication no`
- Restart sshd
```
sudo systemctl restart sshd
```

#### Install fail2ban
This package will prevent brute force authentication attempts
- Install the package
- Create jail.local in /etc/fail2ban:
```
    [DEFAULT]
    bantime = 1h
    banaction = ufw

    [sshd]
    enabled = true
```

#### Regularly Monitor Logs
Keep an eye on all the logs below to spot any malicious access attemps.
- /var/log/ufw.log (firewall)
- /var/log/fail2ban.log (limits brute force authentication attempts)
- /var/log/auth.log  (all authentication attempts)
- /var/log/unattended-upgrades  (auto upgrades)

---

### Running additional SmartApps on your local server
The free tier of ngrok provides only one URL to use.  Therefore, all SmartApps you wish to run on your local server must share this one common network tunnel.  The smartapps.js module used in this package provides a framework to enable multiple installed SmartApps over the same port and ngrok URL.

If you want to run other SmartApps on your local server in addition to the MQTT Sender app:
1. Edit the config.json file and add the appid (SmartThings *APPID* assigned by Developer Workspace project) and module name (.js file) in the applist array element.  
```
{
  "port": 8083,
  "applist": [ { "appid": "12345678-cdef-abcd-1234-f1e2d3c4b5a6", "module": "mqttout" },
               { "appid": "87654321-fedc-12ea-19a2-9a8b7c6d5e5f", "module": "mysecondapp" }
             ]
}
```

Copy your other SmartApp .js files (e.g. mysecondapp.js, etc) to your smartapp project directory, and copy any language files (e.g. mysecondapp_en.json) to the *locales* subdirectory.

Your nodeJS module should export your instantiated SmartApp object as 'app'.  Reference the mqttout.js file for an example.

Your nodeJS module will be loaded by smartapps.js during startup and all POST messages for your application will be routed to it.
