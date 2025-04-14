const { exec, spawn } = require('child_process')
const os = require('os')
const si = require('systeminformation')
const events = require('events')
const { minimal, common } = require('node-mavlink')

class videoStream {
  constructor (settings, winston) {
    this.winston = winston
    this.settings = settings
    // For sending events outside of object
    this.eventEmitter = new events.EventEmitter()

    // Properties used in all modes
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.cameraMode = null // options: 'streaming', 'photo', or 'video'
    this.photoSeq = 0
    // Interval to send camera heartbeat events
    this.intervalObj = null

    // Video streaming
    this.videoDevices = null
    this.videoSettings = null

    // Still camera
    this.stillDevices = null
    this.stillSettings = null
    this.photoSeq = 0

    // Load saved settings.
    this.active = this.settings.value('camera.active', false)
    this.cameraMode = this.settings.value('camera.mode', 'streaming')

    // Load mode-specific settings
    if (this.cameraMode === 'streaming') {
    this.videoSettings = this.settings.value('camera.videoSettings', null)
  } else if (this.cameraMode === 'photo') {
    this.stillSettings = this.settings.value('camera.stillSettings', null)
  } else if (this.cameraMode === 'video') {
    this.videoSettings = this.settings.value('camera.videoSettings', null)
  }

    // If active, initialize the camera system
    if (this.active) {
      this.active = false
      this.initialize()
    }
  }

  initialize() {
    // Reset camera first
    this.getVideoDevices((videoErr) => {
      if (videoErr) {
        console.log('Video device initialization error:', videoErr)
        this.winston.info('Video device initialization error:', videoErr)
        this.resetCamera()
        return
      }

      this.getStillDevices((stillErr) => {
        if (stillErr) {
          console.log('Still device initialization error:', stillErr)
          this.winston.info('Still device initialization error:', stillErr)
          this.resetCamera()
          return
        }

        // Now start the appropriate camera mode
        this.startCamera((err) => {
          if (err) {
            console.log('Camera start error:', err)
            this.winston.info('Camera start error:', err)
            this.resetCamera()
          } else {
            this.active = true
          }
        })
      })
    })
  }

  // Reset all camera settings
  resetCamera() {
    this.active = false
    this.videoSettings = null
    this.stillSettings = null

    try {
      this.settings.setValue('camera.active', false)
      this.settings.setValue('camera.mode', 'streaming')
      this.settings.setValue('camera.videoSettings', null)
      this.settings.setValue('camera.stillSettings', null)
    } catch (e) {
      console.log('Error resetting camera settings:', e)
      this.winston.info('Error resetting camera settings:', e)
    }

    console.log('Reset Camera Settings')
    this.winston.info('Reset Camera Settings')
  }


  //       // Now start streaming only once
  //       this.startStopStreaming(
  //         true,
  //         this.savedDevice.videoDevice, this.savedDevice.stillDevice,
  //         this.savedDevice.height,
  //         this.savedDevice.width, this.savedDevice.format,
  //         this.savedDevice.rotation, this.savedDevice.bitrate,
  //         this.savedDevice.fps, this.savedDevice.useUDP,
  //         this.savedDevice.useUDPIP, this.savedDevice.useUDPPort,
  //         this.savedDevice.useTimestamp,
  //         this.savedDevice.useCameraHeartbeat,
  //         this.savedDevice.mavStreamSelected,
  //         this.savedDevice.cameraMode,
  //         this.savedDevice.compression, (err) => {
  //           if (err) {
  //             console.log('Reset video4 (streaming)');
  //             this.resetVideo();
  //           } else {
  //             this.active = true;
  //           }
  //         }
  //       );
  //     });
  //   });

  // }
  // }


  // Format and store all the possible rtsp addresses
  populateAddresses (factory) {
    // set up the avail addresses
    const ifaces = this.scanInterfaces()
    this.deviceAddresses = []

    for (let j = 0; j < ifaces.length; j++) {
      this.deviceAddresses.push('rtsp://' + ifaces[j] + ':8554/' + factory)
    }
  }

  scanInterfaces () {
    // scan for available IP (v4 only) interfaces
    const iface = []
    const ifaces = os.networkInterfaces()

    for (const ifacename in ifaces) {
      let alias = 0
      for (let j = 0; j < ifaces[ifacename].length; j++) {
        if (ifaces[ifacename][j].family === 'IPv4' && alias >= 1) {
          // this single interface has multiple ipv4 addresses
          // console.log("Found IP " + ifacename + ':' + alias, ifaces[ifacename][j].address);
          iface.push(ifaces[ifacename][j].address)
        } else if (ifaces[ifacename][j].family === 'IPv4') {
          // this interface has only one ipv4 adress
          // console.log("Found IP " + ifacename, ifaces[ifacename][j].address);
          iface.push(ifaces[ifacename][j].address)
        }
        ++alias
      }
    }
    return iface
  }

  async isUbuntu () {
    // Check if we are running Ubuntu
    let ret
    const data = await si.osInfo()
    if (data.distro.toString().includes('Ubuntu')) {
      console.log('Video Running Ubuntu')
      this.winston.info('Video Running Ubuntu')
      ret = true
    } else {
      ret = false
    }
    return ret
  }


  // video streaming
  getVideoDevices (callback) {

    console.log("Retrieving video devices")
    this.winston.info("Retrieving video devices")

    // get all video device details
    // callback is: err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDP, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, selMavURI, cameraMode
    exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
      const warnstrings = ['DeprecationWarning', 'gst_element_message_full_with_details', 'camera_manager.cpp', 'Unsupported V4L2 pixel format']
      if (stderr && !warnstrings.some(wrn => stderr.includes(wrn))) {
        console.error(`exec error: ${error}`)
        this.winston.info('Error in getVideoDevices() ', { message: stderr })
        return callback(stderr)
      }

      try {
        console.log(stdout)
        this.winston.info(stdout)
        this.videoDevices = JSON.parse(stdout)

        if (!this.videoDevices || this.videoDevices.length === 0) {
          return callback('No video devices found')
        } else {
          console.log(this.videoDevices)
          this.winston.info(this.videoDevices)
        }

        const defaultDevice = this.videoDevices[0]
        const defaultCap = defaultDevice.caps[0]
        const defaultFps = defaultCap.fpsmax === 0 ? defaultCap.fps[0] : defaultCap.fpsmax

        // Return current settings or defaults
        if (!this.active || !this.videoSettings) {
          // Return default settings
          return callback(null, this.videoDevices, false, defaultDevice, defaultCap,
            { label: '0°', value: 0 }, 1100, defaultFps, false, '127.0.0.1', 5400,
            false, defaultCap.fps || [], defaultCap.fpsmax, defaultDevice.caps, false,
            { label: '127.0.0.1', value: 0 })
        } else {

        // Match saved device with available devices
        const selDevice = this.videoDevices.find(dev => dev.value === this.videoSettings.device)

          if (!selDevice) {
            console.error('Saved video device not found in available devices')
            this.winston.info('Saved video device not found')
            return this.resetAndReturnDefaults(callback, defaultDevice, defaultCap, defaultFps)
          }

          // Match saved resolution with available resolutions
          const formatString = `${this.videoSettings.width}x${this.videoSettings.height}x${this.videoSettings.format.toString().split('/')[1]}`
          const selRes = selDevice.caps.find(cap => cap.value === formatString)

          if (!selRes) {
            console.error('Saved video resolution not found in available resolutions')
            this.winston.info('Saved video resolution not found')
            return this.resetAndReturnDefaults(callback, defaultDevice, defaultCap, defaultFps)
          }

          // Format fps selection
          let selFps = this.videoSettings.fps
          if (selRes.fpsmax !== undefined && selRes.fpsmax === 0) {
            selFps = selRes.fps.find(fps => parseInt(fps.value) === this.videoSettings.fps) || defaultFps
          }

          // Populate RTSP addresses
          this.populateAddresses(selDevice.value.replace(/\W/g, ''))

          return callback(null, this.videoDevices, this.active, selDevice, selRes,
            { label: this.videoSettings.rotation.toString() + '°', value: this.videoSettings.rotation},
            this.videoSettings.bitrate, selFps, this.videoSettings.useUDP,
            this.videoSettings.useUDPIP, this.videoSettings.useUDPPort,
            this.videoSettings.useTimestamp, selRes.fps || [], selRes.fpsmax,
            selDevice.caps, this.videoSettings.useCameraHeartbeat,
            { label: this.videoSettings.mavStreamSelected.toString(), value: this.videoSettings.mavStreamSelected })
        }
      } catch (e) {
        console.error('Error parsing video devices:', e)
        this.winston.info('Error parsing video devices:', e)
        return callback('Failed to parse video device information')
      }
    })
  }

  resetAndReturnDefaults(callback, defaultDevice, defaultCap, defaultFps) {
    this.resetCamera()
    return callback(null, this.videoDevices, false, defaultDevice, defaultCap,
      { label: '0°', value: 0 }, 1100, defaultFps, false, '127.0.0.1', 5400,
      false, defaultCap.fps || [], defaultCap.fpsmax, defaultDevice.caps, false,
      { label: '127.0.0.1', value: 0 })
  }

    //     const fpsSelected = ((this.videoDevices.length > 0) ? (this.videoDevices[0].caps[0].fpsmax === 0 ? this.videoDevices[0].caps[0].fps[0] : this.videoDevices[0].caps[0].fpsmax) : 1)
    //     // and return current settings
    //     if (!this.active) {
    //       return callback(null, this.videoDevices, this.active, this.videoDevices[0], this.videoDevices[0].caps[0],
    //         { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
    //         (this.videoDevices[0].caps[0].fps !== undefined) ? this.videoDevices[0].caps[0].fps : [],
    //         this.videoDevices[0].caps[0].fpsmax, this.videoDevices[0].caps, false, { label: '127.0.0.1', value: 0 }, 'streaming')
    //     } else {
    //       // format saved settings
    //       const seldevice = this.videoDevices.filter(it => it.value === this.savedDevice.videoDevice)
    //       if (seldevice.length !== 1) {
    //         // bad settings
    //         console.error('Bad video settings1 Resetting')
    //         this.winston.info('Bad video settings. Resetting ', { message: this.savedDevice })
    //         this.resetVideo()
    //         return callback(null, this.videoDevices, this.active, this.videoDevices[0], this.videoDevices[0].caps[0],
    //           { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
    //           (this.videoDevices[0].caps[0].fps !== undefined) ? this.videoDevices[0].caps[0].fps : [],
    //           this.videoDevices[0].caps[0].fpsmax, this.videoDevices[0].caps, false, { label: '127.0.0.1', value: 0 }, 'streaming')
    //       }
    //       const selRes = seldevice[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])
    //       let selFPS = this.savedDevice.fps
    //       if (selRes.length === 1 && selRes[0].fpsmax !== undefined && selRes[0].fpsmax === 0) {
    //         selFPS = selRes[0].fps.filter(it => parseInt(it.value) === this.savedDevice.fps)[0]
    //       }
    //       if (seldevice.length === 1 && selRes.length === 1) {
    //         this.populateAddresses(seldevice[0].value.replace(/\W/g, ''))
    //         console.log(seldevice[0])
    //         return callback(null, this.videoDevices, this.active, seldevice[0], selRes[0],
    //           { label: this.savedDevice.rotation.toString() + '°', value: this.savedDevice.rotation },
    //           this.savedDevice.bitrate, selFPS, this.savedDevice.useUDP, this.savedDevice.useUDPIP,
    //           this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, (selRes[0].fps !== undefined) ? selRes[0].fps : [],
    //           selRes[0].fpsmax, seldevice[0].caps, this.savedDevice.useCameraHeartbeat,
    //           { label: this.savedDevice.mavStreamSelected.toString(), value: this.savedDevice.mavStreamSelected },
    //           this.savedDevice.cameraMode
    //         )
    //       } else {
    //         // bad settings
    //         console.error('Bad video settings. Resetting' + seldevice + ', ' + selRes)
    //         this.winston.info('Bad video settings. Resetting ', { message: JSON.stringify(this.savedDevice) })
    //         this.resetVideo()
    //         return callback(null, this.videoDevices, this.active, this.videoDevices[0], this.videoDevices[0].caps[0],
    //           { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
    //           (this.videoDevices[0].caps[0].fps !== undefined) ? this.videoDevices[0].caps[0].fps : [],
    //           this.videoDevices[0].caps[0].fpsmax, this.videoDevices[0].caps, false, { label: '127.0.0.1', value: 0 }, 'streaming')
    //       }
    //     }
    //   }
    // }

  getStillDevices(callback) {
    console.log("Retrieving still camera devices")
    this.winston.info("Retrieving still camera devices")

    exec('python3 ./python/get_camera_caps.py', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error in get_camera_caps.py: ${stderr || error.message}`);
        this.winston.info('Error in getStillDevices()', { message: stderr || error.message });
        return callback(stderr || error.message);
      }

      try {
        const cameraDevices = JSON.parse(stdout)

        if (!Array.isArray(cameraDevices) || cameraDevices.length === 0) {
          return callback('No still camera capabilities found');
        }

        // Pick first device with valid caps as default
        const defaultDevice = cameraDevices.find(dev => dev.caps && dev.caps.length > 0);
        const defaultCap = defaultDevice?.caps[0];

        if (!this.active || !this.stillSettings || !defaultCap) {
          return callback(null, cameraDevices, false, defaultDevice, defaultCap)
        }

        // Try to match the saved still device & resolution
        let selectedDevice = null
        let selectedCap = null

        for (const device of cameraDevices) {
          if (device.path === this.stillSettings.path) {
            selectedDevice = device

            selectedCap = device.caps.find(cap =>
              cap.width === this.stillSettings.width &&
              cap.height === this.stillSettings.height &&
              cap.format === this.stillSettings.format
            )

            if (selectedCap) break
          }
        }

        return callback(null, cameraDevices, true, selectedDevice || defaultDevice,
          selectedCap || defaultCap)
} catch (e) {
console.error('Failed to parse JSON output:', e)
this.winston.error('JSON Parsing Error in getStillDevices()', { message: e.message })
return callback('Invalid JSON output from get_camera_caps.py')
}
})
}

startCamera(callback) {
  if (this.cameraMode === 'streaming') {
    this.startVideoStreaming(callback)
  } else if (this.cameraMode === 'photo') {
    this.startPhotoMode(callback)
  } else if (this.cameraMode === 'video') {
    this.startVideoMode(callback)
  } else {
    callback(new Error(`Unsupported camera mode: ${this.cameraMode}`))
  }
}

  // // reset and save the video settings
  // resetVideo () {
  //   this.active = false
  //   this.savedDevice = null
  //   try {
  //     this.settings.setValue('videostream.active', this.active)
  //     this.settings.setValue('videostream.savedDevice', this.savedDevice)
  //   } catch (e) {
  //     console.log(e)
  //     this.winston.info(e)
  //   }
  //   console.log('Reset Video Settings')
  //   this.winston.info('Reset Video Settings')
  // }

  startVideoStreaming(callback) {
    console.log('Starting video streaming mode')
    this.winston.info('Starting video streaming mode')

    // Check if the video device is valid
    if (!this.videoDevices || !this.videoSettings) {
      console.log('No valid video device or settings')
      this.winston.info('No valid video device or settings')
      return callback(new Error('No valid video device or settings'))
    }

    const deviceExists = this.videoDevices.some(dev => dev.value === this.videoSettings.device)
    if (!deviceExists) {
      console.log(`No video device: ${this.videoSettings.device}`)
      this.winston.info(`No video device: ${this.videoSettings.device}`)
      return callback(new Error(`No video device: ${this.videoSettings.device}`))
    }

    // Populate RTSP addresses for the selected device
    this.populateAddresses(this.videoSettings.device.replace(/\W/g, ''))

    this.startRtspServer(callback)
  }

  async startRtspServer(callback) {
    let device = this.videoSettings.device
    let format = this.videoSettings.format

    // RPI camera has different name under Ubuntu
    if (await this.isUbuntu() && device === 'rpicam') {
      device = '/dev/video0'
      format = 'video/x-raw'
    }

    const args = [
      './python/rtsp-server.py',
      '--video=' + device,
      '--height=' + this.videoSettings.height,
      '--width=' + this.videoSettings.width,
      '--format=' + format,
      '--bitrate=' + this.videoSettings.bitrate,
      '--rotation=' + this.videoSettings.rotation,
      '--fps=' + this.videoSettings.fps,
      '--udp=' + ((this.videoSettings.useUDP === false) ? '0' :
                 this.videoSettings.useUDPIP + ':' + this.videoSettings.useUDPPort.toString()),
      '--compression=' + this.videoSettings.compression
    ]

    if (this.videoSettings.useTimestamp) {
      args.push('--timestamp')
    }

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning rtsp-server.py')
        this.winston.info('Error spawning rtsp-server.py')
        return callback(new Error('Failed to start RTSP server'))
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('RTSP')

      if (this.videoSettings.useCameraHeartbeat) {
        this.startHeartbeatInterval()
      }

      console.log('Started Video Streaming of ' + device)
      this.winston.info('Started Video Streaming of ' + device)
      return callback(null, this.active, this.deviceAddresses)
    } catch (e) {
      console.log('Error starting RTSP server:', e)
      this.winston.info('Error starting RTSP server:', e)
      return callback(e)
    }
  }

  // async startStopStreaming (active, device, height, width, format, rotation, bitrate, fps, useUDP, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, mavStreamSelected, cameraMode, compression, callback) {
  //   // if current state same, don't do anything
  //   if (this.active === active) {
  //     console.log('Video current same')
  //     this.winston.info('Video current same')
  //     return callback(null, this.active, this.deviceAddresses)
  //   }
  //   // user wants to start or stop streaming
  //   if (active) {
  //     // check it's a valid video device
  //     let found = false
  //     if (this.videoDevices !== null) {
  //       for (let j = 0; j < this.videoDevices.length; j++) {
  //         if (device === this.videoDevices[j].value) {
  //           found = true
  //         }
  //       }
  //       if (!found) {
  //         console.log('No video device: ' + device)
  //         this.winston.info('No video device: ' + device)
  //         return callback(new Error('No video device: ' + device))
  //       }
  //     } else {
  //       console.log('No video devices in list')
  //       this.winston.info('No video devices in list')
  //     }

  //     this.active = true
  //     this.savedDevice = {
  //       device,
  //       height,
  //       width,
  //       format,
  //       bitrate,
  //       fps,
  //       rotation,
  //       useUDP,
  //       useUDPIP,
  //       useUDPPort,
  //       useTimestamp,
  //       useCameraHeartbeat,
  //       mavStreamSelected,
  //       cameraMode,
  //       compression
  //     }

  //       console.log("startStopStreaming: camera mode is:", this.savedDevice.cameraMode)
  //     // If photo mode was selected, start the libcamera server
  //     if (this.savedDevice.cameraMode === "photo") {
  //       console.log('Entering photo mode')

  //       // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
  //       this.populateAddresses(device.replace(/\W/g, ''))

  //       const args = ['./python/photomode.py',
  //         '--mode=' + "photo",]

  //       this.deviceStream = spawn('python3', args)

  //       try {
  //         if (this.deviceStream === null) {
  //           this.settings.setValue('photomode.active', false)
  //           console.log('Error spawning photomode.py')
  //           this.winston.info('Error spawning photomode.py')
  //           return callback(null, this.active, this.deviceAddresses)
  //         }
  //         this.settings.setValue('photomode.active', this.active)
  //         this.settings.setValue('photomode.savedDevice', this.savedDevice)
  //       } catch (e) {
  //         console.log(e)
  //         this.winston.info(e)
  //       }

  //       this.deviceStream.stdout.on('data', (data) => {
  //         this.winston.info('photoMode: startStopStreaming() data ' + data)
  //         console.log(`photoMode:  stdout: ${data}`)
  //       })

  //       this.deviceStream.stderr.on('data', (data) => {
  //         this.winston.error('photoMode: startStopStreaming() err ', { message: data })
  //         console.error(`photoMode:  stderr: ${data}`)
  //       })

  //       this.deviceStream.on('close', (code) => {
  //         console.log(`photoMode:  process exited with code ${code}`)
  //         this.winston.info('photoMode: startStopStreaming() close ' + code)
  //         this.deviceStream.stdin.pause()
  //         this.deviceStream.kill()
  //         this.resetVideo()
  //       })

  //       console.log('Started Photo Mode of ' + device)
  //       this.winston.info('Started Photo Mode of ' + device)

  //     } else if (this.savedDevice.cameraMode === "video"){
  //       console.log('Entering video mode')
  //       // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
  //       this.populateAddresses(device.replace(/\W/g, ''))

  //       const args = ['./python/photomode.py',
  //         '--mode=' + "video",]

  //       this.deviceStream = spawn('python3', args)

  //       try {
  //         if (this.deviceStream === null) {
  //           this.settings.setValue('photomode.active', false)
  //           console.log('Error spawning photomode.py')
  //           this.winston.info('Error spawning photomode.py')
  //           return callback(null, this.active, this.deviceAddresses)
  //         }
  //         this.settings.setValue('videomode.active', this.active)
  //         this.settings.setValue('videomode.savedDevice', this.savedDevice)
  //       } catch (e) {
  //         console.log(e)
  //         this.winston.info(e)
  //       }

  //       this.deviceStream.stdout.on('data', (data) => {
  //         this.winston.info('videoMode: startStopStreaming() data ' + data)
  //         console.log(`videoMode:  stdout: ${data}`)
  //       })

  //       this.deviceStream.stderr.on('data', (data) => {
  //         this.winston.error('videoMode: startStopStreaming() err ', { message: data })
  //         console.error(`videoMode:  stderr: ${data}`)
  //       })

  //       this.deviceStream.on('close', (code) => {
  //         console.log(`videoMode:  process exited with code ${code}`)
  //         this.winston.info('videoMode: startStopStreaming() close ' + code)
  //         this.deviceStream.stdin.pause()
  //         this.deviceStream.kill()
  //         this.resetVideo()
  //       })

  //       console.log('Started Video Mode of ' + device)
  //       this.winston.info('Started Video Mode of ' + device)

  //     } else {
  //     // Start a regular video stream
  //     // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
  //     this.populateAddresses(device.replace(/\W/g, ''))

  //     // rpi camera has different name under Ubuntu
  //     if (await this.isUbuntu() && device === 'rpicam') {
  //       device = '/dev/video0'
  //       format = 'video/x-raw'
  //     }

  //     const args = ['./python/rtsp-server.py',
  //       '--video=' + device,
  //       '--height=' + height,
  //       '--width=' + width,
  //       '--format=' + format,
  //       '--bitrate=' + bitrate,
  //       '--rotation=' + rotation,
  //       '--fps=' + fps,
  //       '--udp=' + ((useUDP === false) ? '0' : useUDPIP + ':' + useUDPPort.toString()),
  //       '--compression=' + compression
  //     ]

  //     if (useTimestamp) {
  //       args.push('--timestamp')
  //     }

  //     this.deviceStream = spawn('python3', args)

  //     try {
  //       if (this.deviceStream === null) {
  //         this.settings.setValue('videostream.active', false)
  //         console.log('Error spawning rtsp-server.py')
  //         this.winston.info('Error spawning rtsp-server.py')
  //         return callback(null, this.active, this.deviceAddresses)
  //       }
  //       this.settings.setValue('videostream.active', this.active)
  //       this.settings.setValue('videostream.savedDevice', this.savedDevice)
  //     } catch (e) {
  //       console.log(e)
  //       this.winston.info(e)
  //     }

  //     this.deviceStream.stdout.on('data', (data) => {
  //       this.winston.info('startStopStreaming() data ' + data)
  //       console.log(`GST stdout: ${data}`)
  //     })

  //     this.deviceStream.stderr.on('data', (data) => {
  //       this.winston.info('startStopStreaming() err ', { message: data })
  //       console.error(`GST stderr: ${data}`)
  //     })

  //     this.deviceStream.on('close', (code) => {
  //       console.log(`GST process exited with code ${code}`)
  //       this.winston.info('startStopStreaming() close ' + code)
  //       this.deviceStream.stdin.pause()
  //       this.deviceStream.kill()
  //       this.resetVideo()
  //     })

  //     console.log('Started Video Streaming of ' + device)
  //     this.winston.info('Started Video Streaming of ' + device)
  //   }
  //     if (this.savedDevice.useCameraHeartbeat === true) {
  //       this.startInterval()
  //     }

  //     return callback(null, this.active, this.deviceAddresses)
  //   } else {
  //     // stop streaming
  //     // if mavlink advertising is on, clear the interval

  //     if (this.savedDevice.useCameraHeartbeat) {
  //       clearInterval(this.intervalObj)
  //     }
  //     this.deviceStream.stdin.pause()
  //     this.deviceStream.kill()
  //     this.resetVideo()
  //   }
  //   return callback(null, this.active, this.deviceAddresses)
  // }

  startPhotoMode(callback) {
    console.log('Starting photo mode')
    this.winston.info('Starting photo mode')

    if (!this.stillSettings) {
      console.log('No valid still camera settings')
      this.winston.info('No valid still camera settings')
      return callback(new Error('No valid still camera settings'))
    }

    // Populate addresses if needed
    if (this.stillSettings.device) {
      this.populateAddresses(this.stillSettings.device.replace(/\W/g, ''))
    }

    const args = ['./python/photomode.py', '--mode=photo']

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning photomode.py')
        this.winston.info('Error spawning photomode.py')
        return callback(new Error('Failed to start photo mode'))
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('Photo Mode')

      console.log('Started Photo Mode')
      this.winston.info('Started Photo Mode')
      return callback(null, this.active, this.deviceAddresses)
    } catch (e) {
      console.log('Error starting photo mode:', e)
      this.winston.info('Error starting photo mode:', e)
      return callback(e)
    }
  }

  startVideoMode(callback) {
    console.log('Starting video recording mode')
    this.winston.info('Starting video recording mode')

    if (!this.videoSettings) {
      console.log('No valid video settings')
      this.winston.info('No valid video settings')
      return callback(new Error('No valid video settings'))
    }

    // Populate addresses if needed
    if (this.videoSettings.device) {
      this.populateAddresses(this.videoSettings.device.replace(/\W/g, ''))
    }

    const args = ['./python/photomode.py', '--mode=video']

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning photomode.py for video mode')
        this.winston.info('Error spawning photomode.py for video mode')
        return callback(new Error('Failed to start video recording mode'))
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('Video Mode')

      console.log('Started Video Recording Mode')
      this.winston.info('Started Video Recording Mode')
      return callback(null, this.active, this.deviceAddresses)
    } catch (e) {
      console.log('Error starting video recording mode:', e)
      this.winston.info('Error starting video recording mode:', e)
      return callback(e)
    }
  }

  setupStreamEvents(modeName) {
    this.deviceStream.stdout.on('data', (data) => {
      this.winston.info(`${modeName}: data: ${data}`)
      console.log(`${modeName} stdout: ${data}`)
    })

    this.deviceStream.stderr.on('data', (data) => {
      this.winston.error(`${modeName}: error: ${data}`)
      console.error(`${modeName} stderr: ${data}`)
    })

    this.deviceStream.on('close', (code) => {
      console.log(`${modeName} process exited with code ${code}`)
      this.winston.info(`${modeName}: close: ${code}`)

      if (this.deviceStream) {
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
      }

      this.resetCamera()
    })
  }

  saveSettings() {
    try {
      this.settings.setValue('camera.active', this.active)
      this.settings.setValue('camera.mode', this.cameraMode)

      if (this.cameraMode === 'streaming' || this.cameraMode === 'video') {
        this.settings.setValue('camera.videoSettings', this.videoSettings)
      } else if (this.cameraMode === 'photo') {
        this.settings.setValue('camera.stillSettings', this.stillSettings)
      }
    } catch (e) {
      console.log('Error saving camera settings:', e)
      this.winston.info('Error saving camera settings:', e)
    }
  }

  stopCamera(callback) {
    if (!this.active) {
      return callback(null, false)
    }

    // Stop any heartbeat interval if running
    if (this.intervalObj) {
      clearInterval(this.intervalObj)
      this.intervalObj = null
    }

    // Kill the running process
    if (this.deviceStream) {
      this.deviceStream.stdin.pause()
      this.deviceStream.kill()
      this.deviceStream = null
    }

    this.resetCamera()
    return callback(null, false)
  }

  startHeartbeatInterval () {
    // start the 1-sec loop to send heartbeat events
    this.intervalObj = setInterval(() => {
      const mavType = minimal.MavType.CAMERA
      const autopilot = minimal.MavAutopilot.INVALID
      const component = minimal.MavComponent.CAMERA

      this.eventEmitter.emit('cameraheartbeat', mavType, autopilot, component)
    }, 1000)
  }


  captureStillPhoto (senderSysId, senderCompId, targetComponent) {
    // Capture a single still photo
    console.log('Capturing still photo')

    if (!this.active || !this.deviceStream) {
      console.log('Cannot capture photo - camera not active')
      return
    }

    // Signal the Python process to capture a photo
    this.deviceStream.kill('SIGUSR1')

    // build a CAMERA_TRIGGER packet
    const msg = new common.CameraTrigger()

    // Date.now() returns time in milliseconds
    msg.timeUsec = BigInt(Date.now() * 1000)
    msg.seq = this.photoSeq

    this.photoSeq++

    this.eventEmitter.emit('digicamcontrol', senderSysId, senderCompId, targetComponent)
    this.eventEmitter.emit('cameratrigger', msg, senderCompId)

  }

  toggleVideoRecording() {
    // Toggle local video recording on/off

    console.log('Toggling video recording')

    if (!this.active || !this.deviceStream) {
      console.log('Cannot toggle video - camera not active')
      return
    }

    // Signal the Python process to toggle video recording
    this.deviceStream.kill('SIGUSR1')

    //TODO: add MAVLink control option

  }

  sendCameraInformation (senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraInformation packet')
    this.winston.info('Sending MAVLink CameraInformation packet')

    // build a CAMERA_INFORMATION packet
    const msg = new common.CameraInformation()

    // TODO: implement missing attributes here
    msg.timeBootMs = 0
    msg.vendorName = 0
    msg.modelName = 0
    msg.firmwareVersion = 0
    msg.focalLength = null
    msg.sensorSizeH = null
    msg.sensorSizeV = null

    // Set resolution based on current mode
    if (this.cameraMode === 'streaming' || this.cameraMode === 'video') {
      msg.resolutionH = this.videoSettings?.width || 0
      msg.resolutionV = this.videoSettings?.height || 0
    } else if (this.cameraMode === 'photo') {
      msg.resolutionH = this.stillSettings?.width || 0
      msg.resolutionV = this.stillSettings?.height || 0
    }

    msg.lensId = 0

    // Set capabilities flags based on mode
    if (this.cameraMode === 'photo') {
      // 2 = CAMERA_CAP_FLAGS_CAPTURE_IMAGE
      msg.flags = 2
    } else {
      // 256 = CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM
      msg.flags = 256
    }

    msg.camDefinitionVersion = 0
    msg.camDefinitionUri = ''
    msg.gimbalDeviceId = 0

    this.eventEmitter.emit('camerainfo', msg, senderSysId, senderCompId, targetComponent)
  }

  sendVideoStreamInformation (senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLinkr VideoStreamInformation packet')
    this.winston.info('Sending MAVLinkr VideoStreamInformation packet')

    if (!this.videoSettings) {
      console.log('No video settings available')
      return
    }

    // build a VIDEO_STREAM_INFORMATION packet
    const msg = new common.VideoStreamInformation()

    // rpanion only supports a single stream, so streamId and count will always be 1
    msg.streamId = 1
    msg.count = 1

    // msg.type and msg.uri need to be different depending on whether RTP or RTSP is selected
    if (this.videoSettings.useUDP) {
      // msg.type = 0 = VIDEO_STREAM_TYPE_RTSP
      // msg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
      msg.type = 1
      // For RTP, just send the destination UDP port instead of a full URI
      msg.uri = this.videoSettings.useUDPPort.toString()
    } else {
      msg.type = 0
      msg.uri = `rtsp://${this.videoSettings.mavStreamSelected}:8554/${this.videoSettings.videoDevice}`
    }

    // 1 = VIDEO_STREAM_STATUS_FLAGS_RUNNING
    // 2 = VIDEO_STREAM_STATUS_FLAGS_THERMAL
    msg.flags = 1
    msg.framerate = this.videoSettings.fps
    msg.resolutionH = this.videoSettings.width
    msg.resolutionV = this.videoSettings.height
    msg.bitrate = this.videoSettings.bitrate
    msg.rotation = this.videoSettings.rotation
    // Rpanion doesn't collect field of view values, so just set to zero
    msg.hfov = 0
    msg.name = this.videoSettings.videoDevice

    this.eventEmitter.emit('videostreaminfo', msg, senderSysId, senderCompId, targetComponent)
  }

  sendCameraSettings (senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraSettings packet')
    this.winston.info('Sending MAVLink CameraSettings packet')

    // build a CAMERA_SETTINGS packet
    const msg = new common.CameraSettings()

    msg.timeBootMs = 0

    // Camera modes: 0 = IMAGE, 1 = VIDEO, 2 = IMAGE_SURVEY
    if (this.cameraMode === 'photo') {
      msg.modeId = 0
    } else {
      msg.modeId = 1
    }

    msg.zoomLevel = null
    msg.focusLevel = null

    this.eventEmitter.emit('camerasettings', msg, senderSysId, senderCompId, targetComponent)
  }

  onMavPacket (packet, data) {
    // Ignore if camera is not active
    if (!this.active) {
      return
    }

    if (data.targetComponent === minimal.MavComponent.CAMERA &&
      packet.header.msgid === common.CommandLong.MSG_ID) {

      // TODO
      if (data._param1 === common.CameraInformation.MSG_ID) {
        this.sendCameraInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.VideoStreamInformation.MSG_ID && this.cameraMode === "streaming") {
        this.sendVideoStreamInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.CameraSettings.MSG_ID) {
        this.sendCameraSettings(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      // 203 = MAV_CMD_DO_DIGICAM_CONTROL
      } else if (data.command === 203) {
        console.log('Received DoDigicamControl command')
        this.captureStillPhoto(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      }
    }
  }
}
module.exports = videoStream
