import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form';
import React from 'react'

import basePage from './basePage.jsx';

import './css/styles.css';

class VideoPage extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      // --- Video/Streaming State ---
      videoDevices: [], // Renamed from 'dev' for clarity
      videoDeviceSelected: null,
      videoCaps: [],
      videoCapSelected: null,
      ifaces: [],
      mavStreamSelected: null,
      rotations: [{ label: "0°", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }],
      rotSelected: { label: "0°", value: 0 },
      bitrate: 1100,
      UDPChecked: false,
      useUDPIP: "127.0.0.1",
      useUDPPort: 5600,
      FPSMax: 0,
      fpsOptions: [],   // Renamed from "fps"
      fpsSelected: null,
      timestamp: false,
      enableCameraHeartbeat: false,
      compression: { value: 'H264', label: 'H.264' },
      multicastString: " ",

      // --- Still Photo State ---
      stillDevices: [],
      stillDeviceSelected: null,
      stillCaps: [],
      stillCapSelected: null,

      // --- Common Camera State ---
      active: false, // Renamed from "streamingStatus"
      cameraMode: 'streaming', // Default to streaming
      streamAddresses: [],
    };
  }

componentDidMount() {
  this.setLoading(true); // Use basePage loading state
  Promise.all([
    // Fetch Video Devices Info
    fetch(`/api/videodevices`, { headers: { Authorization: `Bearer ${this.state.token}` } }),
    // Fetch Still Devices Info
    fetch(`/api/camera/still_devices`, { headers: { Authorization: `Bearer ${this.state.token}` } })
  ])
  .then(async ([videoRes, stillRes]) => {
    const videoData = await videoRes.json();
    const stillData = await stillRes.json();

    if (!videoRes.ok) throw new Error(`Video devices fetch failed: ${videoData.error || videoRes.statusText}`);
    if (!stillRes.ok) throw new Error(`Still devices fetch failed: ${stillData.error || stillRes.statusText}`);

    // --- Process Video Data ---
    const videoStateUpdate = {
      videoDevices: videoData.devices || [],
      active: videoData.active || false,
      cameraMode: videoData.cameraMode || this.state.cameraMode, // Use fetched mode if available
      streamAddresses: videoData.streamAddresses || [],
      ifaces: (videoData.devices && videoData.devices.length > 0) ? this.getNetworkInterfacesFromDevices(videoData.devices) : [],
    };

    // Set selected video settings ONLY if active or if defaults are needed
    if (videoData.selectedDevice) {
      videoStateUpdate.videoDeviceSelected = videoData.selectedDevice;
      videoStateUpdate.videoCaps = videoData.resolutionCaps || []; // Use allCaps from response
    }

    if (videoData.selectedCap) {
      videoStateUpdate.videoCapSelected = videoData.selectedCap;
      // Update FPS options based on selected cap
      videoStateUpdate.FPSMax = videoData.fpsMax !== undefined ? videoData.fpsMax : 0;
      videoStateUpdate.fpsOptions = videoData.fpsOptions || [];
      // Set selected FPS carefully (could be number or object)
      videoStateUpdate.fpsSelected = videoData.selectedFps || (videoData.fpsOptions && videoData.fpsOptions.length > 0 ? videoData.fpsOptions[0] : null);
       // Override compression if the format dictates it (e.g., native H.264)
      if (videoData.selectedCap.format === "video/x-h264") {
         videoStateUpdate.compression = { value: 'H264', label: 'H.264' };
      } else {
        // Keep existing or set default if needed (might need backend to send selected compression)
        videoStateUpdate.compression = this.state.compression;
      }
    }
     if (videoData.selectedRotation) videoStateUpdate.rotSelected = videoData.selectedRotation;
     if (videoData.selectedBitrate !== undefined) videoStateUpdate.bitrate = videoData.selectedBitrate;
     if (videoData.selectedUseUDP !== undefined) videoStateUpdate.UDPChecked = videoData.selectedUseUDP;
     if (videoData.selectedUseUDPIP) {
          videoStateUpdate.useUDPIP = videoData.selectedUseUDPIP;
          this.isMulticastUpdateIP(videoData.selectedUseUDPIP); // Update multicast string immediately
     }
     if (videoData.selectedUseUDPPort !== undefined) videoStateUpdate.useUDPPort = videoData.selectedUseUDPPort;
     if (videoData.selectedUseTimestamp !== undefined) videoStateUpdate.timestamp = videoData.selectedUseTimestamp;
     if (videoData.selectedUseCameraHeartbeat !== undefined) videoStateUpdate.enableCameraHeartbeat = videoData.selectedUseCameraHeartbeat;
     if (videoData.selectedMavStreamURI) videoStateUpdate.mavStreamSelected = videoData.selectedMavStreamURI;


    // --- Process Still Camera Data ---
    const stillStateUpdate = {
      stillDevices: stillData.devices || [],
    };
    if (stillData.selectedDevice) {
      stillStateUpdate.stillDeviceSelected = stillData.selectedDevice;
      stillStateUpdate.stillCaps = stillData.selectedDevice.caps || [];
    }
     if (stillData.selectedCap) {
      stillStateUpdate.stillCapSelected = stillData.selectedCap;
    }

    // --- Apply Combined State Updates ---
    this.setState({
      ...videoStateUpdate,
      ...stillStateUpdate,
      error: null // Clear previous errors on success
    });

  })
  .catch(error => {
    console.error("Error fetching camera devices:", error);
    this.setState({ error: error.message || 'Failed to load camera configuration.' });
  })
  .finally(() => {
    this.loadDone(); // Call basePage method
  });
}

  // TODO: FIX THIS MESS!
  // TODO: FIX THIS MESS!
  // Helper to get unique IPs for MAVLink dropdown (assuming backend provides this info now)
  // If not, you might need to fetch interfaces separately or adjust based on backend response
  getNetworkInterfacesFromDevices = (devices) => {
    // This is a placeholder. The backend /api/videodevices response
    // should ideally include the network interfaces directly if needed for mavStreamSelected.
    // Let's assume the backend sends 'ifaces' based on the old code structure,
    // otherwise this needs adaptation.
    // For now, returning a dummy value or relying on the fetched mavStreamSelected.
    // A better approach is for the backend to provide the options.
    // If 'ifaces' IS in the backend response, map it here:
    // return videoData.ifaces ? videoData.ifaces.map(ip => ({ label: ip, value: ip })) : [];
    return [{ label: '127.0.0.1', value: '127.0.0.1' }]; // Placeholder
 }

  // fetch(`/api/videodevices`, {headers: {Authorization: `Bearer ${this.state.token}`}})
  // .then(response => response.json())
  // .then(state => {
  //   this.setState(state);
  //   if (state.useUDPIP) {  // Check that the IP address exists
  //     this.isMulticastUpdateIP(state.useUDPIP);
  //   }
  //   this.loadDone()
  // });
//}

  handleCameraModeChange = (event) => {
    this.setState({ cameraMode: event.target.value });
  }

  handleVideoDeviceChange = (selectedOption) => {
    const newCaps = selectedOption.caps || [];
    const defaultCap = newCaps.length > 0 ? newCaps[0] : null;
    this.setState({
        videoDeviceSelected: selectedOption,
        videoCaps: newCaps,
        // Reset dependent selections to defaults for the new device
        videoCapSelected: defaultCap,
        fpsOptions: defaultCap?.fps || [],
        FPSMax: defaultCap?.fpsmax !== undefined ? defaultCap.fpsmax : 0,
        fpsSelected: defaultCap?.fps ? defaultCap.fps[0] : null // Select first FPS option
    }, () => {
        // If the default cap forces H.264, update compression
        if (defaultCap?.format === "video/x-h264") {
            this.setState({ compression: { value: 'H264', label: 'H.264' } });
        }
    });
  }

  handleVideoCapChange = (selectedOption) => {
    // Update selected resolution/capability and associated FPS options
    const fpsOptions = selectedOption.fps || [];
    const fpsMax = selectedOption.fpsmax !== undefined ? selectedOption.fpsmax : 0;
    const defaultFps = fpsOptions.length > 0 ? fpsOptions[0] : null; // Pick first available FPS

    this.setState({
        videoCapSelected: selectedOption,
        FPSMax: fpsMax,
        fpsOptions: fpsOptions,
        fpsSelected: fpsMax > 0 ? Math.min(fpsMax, 10) : defaultFps // Default to 10 or first option
    });

    // Override compression if the format dictates it
    if (selectedOption.format === "video/x-h264") {
        this.setState({ compression: { value: 'H264', label: 'H.264' } });
    }
  }

  handleRotChange = (value) => {
    //resolution box new selected value
    this.setState({ rotSelected: value });
  }

  handleBitrateChange = (event) => {
    //bitrate spinner new value
    this.setState({ bitrate: event.target.value });
  }

  handleStreamingModeChange = (event) => { // Renamed from handleUseUDPChange
    this.setState({ UDPChecked: event.target.value === "rtp" });
  }

  handleUDPIPChange = (event) => {
    //IP address new value
    this.isMulticastUpdateIP(event.target.value);
    this.setState({ useUDPIP: event.target.value});
  }

  handleUDPPortChange = (event) => {
    //bitrate spinner new value
    this.setState({ useUDPPort: event.target.value});
  }

  isMulticastUpdateIP(ip) {
    // Split the IP address into its four octets
    const octets = ip.split('.').map(Number);
    let udpmult = " ";

    // Check if the IP address has 4 octets and all are within the valid range
    if (octets.length !== 4 || octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
      udpmult = "multicast-group=" + ip + " ";
    }

    // Check if the first octet is within the multicast range (224-239)
    if (octets[0] >= 224 && octets[0] <= 239) {
      udpmult = "multicast-group=" + ip + " ";
    }

    this.setState({multicastString: udpmult});
  }

  handleFPSChange = (event) => {
    //bitrate spinner new value
    this.setState({ fpsSelected: event.target.value });
  }

  handleFPSChangeSelect = (value) => {
    //resolution box new selected value
    this.setState({ fpsSelected: value });
  }

  handleTimestampChange = () => {
    //use timestamp new value
    this.setState({ timestamp: !this.state.timestamp });
  }

  handleUseCameraHeartbeatChange = () => {
    // Toggle camera heartbeat events
    this.setState({ enableCameraHeartbeat: !this.state.enableCameraHeartbeat });
  }

  handleMavStreamChange = (value) => {
    //new value for selected stream IP
    this.setState({ mavStreamSelected: value });
  }

  handleStillDeviceChange = (selectedOption) => {
    const newCaps = selectedOption.caps || [];
    this.setState({
        stillDeviceSelected: selectedOption,
        stillCaps: newCaps,
        stillCapSelected: newCaps.length > 0 ? newCaps[0] : null // Select first cap by default
    });
  }

  handleStillCapChange = (selectedOption) => {
      this.setState({ stillCapSelected: selectedOption });
  }

  handleCaptureStill = () => {
    fetch('/api/capturestillphoto', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
  }

  handleToggleVideo = () => {
    fetch('/api/togglevideorecording', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
  }

  // handleStreaming = () => {
  //   //user clicked start/stop streaming
  //   this.setState({ waiting: true }, () => {
  //     fetch('/api/startstopvideo', {
  //       method: 'POST',
  //       headers: {
  //         'Accept': 'application/json',
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${this.state.token}`
  //       },
  //       body: JSON.stringify({
  //         active: !this.state.streamingStatus,
  //         device: this.state.vidDeviceSelected.value,
  //         height: this.state.vidResSelected.height,
  //         width: this.state.vidResSelected.width,
  //         format: this.state.vidResSelected.format,
  //         rotation: this.state.rotSelected.value,
  //         fps: this.state.FPSMax !== 0 ? this.state.fpsSelected : Number(this.state.fpsSelected.value),
  //         //fps: this.state.fpsSelected,
  //         bitrate: this.state.bitrate,
  //         useUDP: this.state.UDPChecked,
  //         useUDPIP: this.state.useUDPIP,
  //         useUDPPort: this.state.useUDPPort,
  //         useTimestamp: this.state.timestamp,
  //         useCameraHeartbeat: this.state.enableCameraHeartbeat,
  //         mavStreamSelected: this.state.mavStreamSelected.value,
  //         cameraMode: this.state.cameraMode,
  //         compression: this.state.compression.value
  //       })
  //     }).then(response => response.json()).then(state => { this.setState(state); this.setState({ waiting: false }) });
  //   });
  // }

  handleStartCamera = () => {
    this.setState({ waiting: true, error: null }); // Set waiting, clear error

    let body = {
      cameraMode: this.state.cameraMode,
    };

    // --- Validate and Build Request Body ---
    try {
        if (this.state.cameraMode === 'streaming' || this.state.cameraMode === 'video') {
             if (!this.state.videoDeviceSelected || !this.state.videoCapSelected) {
                throw new Error("Video Device and Resolution must be selected.");
            }
            body = {
                ...body,
                videoDevice: this.state.videoDeviceSelected.value,
                height: this.state.videoCapSelected.height,
                width: this.state.videoCapSelected.width,
                format: this.state.videoCapSelected.format,
                rotation: this.state.rotSelected.value,
                // Handle FPS based on input type
                fps: this.state.FPSMax > 0 ? parseInt(this.state.fpsSelected, 10) : parseInt(this.state.fpsSelected?.value, 10),
                bitrate: parseInt(this.state.bitrate, 10),
                useUDP: this.state.UDPChecked,
                useUDPIP: this.state.useUDPIP,
                useUDPPort: parseInt(this.state.useUDPPort, 10),
                useTimestamp: this.state.timestamp,
                useCameraHeartbeat: this.state.enableCameraHeartbeat,
                // Only send mavStreamSelected if heartbeat is enabled and RTSP is used
                mavStreamSelected: (this.state.enableCameraHeartbeat && !this.state.UDPChecked) ? this.state.mavStreamSelected?.value : '127.0.0.1', // Default if not applicable
                compression: this.state.compression.value,
            };
            // Basic validation for numbers
             if (isNaN(body.height) || isNaN(body.width) || isNaN(body.rotation) || isNaN(body.fps) || isNaN(body.bitrate) || isNaN(body.useUDPPort)) {
                 throw new Error("Invalid numeric value entered for video settings.");
             }
              if (body.useUDP && !body.useUDPIP) {
                 throw new Error("Destination IP is required for RTP mode.");
              }

        } else if (this.state.cameraMode === 'photo') {
             if (!this.state.stillDeviceSelected || !this.state.stillCapSelected) {
                throw new Error("Still Camera Device and Resolution must be selected.");
            }
            body = {
                ...body,
                stillDevicePath: this.state.stillDeviceSelected.path, // Assuming 'path' identifies the device
                stillWidth: this.state.stillCapSelected.width,
                stillHeight: this.state.stillCapSelected.height,
                stillFormat: this.state.stillCapSelected.format,
            };
             if (isNaN(body.stillWidth) || isNaN(body.stillHeight) ) {
                 throw new Error("Invalid numeric value entered for still photo settings.");
             }
        } else {
             throw new Error("Invalid camera mode selected.");
        }

    } catch (validationError) {
         this.setState({ waiting: false, error: validationError.message });
         return; // Stop before fetch
    }
    // --- ---

    fetch('/api/camera/start', { // Use new endpoint
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify(body)
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data }))) // Process JSON regardless of status
    .then(({ ok, data }) => {
      if (!ok) {
         throw new Error(data.error || 'Failed to start camera.');
      }
      // Update state on success
      this.setState({
          active: data.active,
          streamAddresses: data.addresses || [],
          error: null // Clear error on success
        });
    })
    .catch(error => {
        console.error("Error starting camera:", error);
        this.setState({ error: error.message }); // Display error message
    })
    .finally(() => {
        this.setState({ waiting: false }); // Clear waiting indicator
    });
  }

  handleStopCamera = () => {
    this.setState({ waiting: true, error: null });
    fetch('/api/camera/stop', { // Use new endpoint
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` }
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
       if (!ok) {
         throw new Error(data.error || 'Failed to stop camera cleanly.');
       }
        this.setState({
            active: data.active, // Should be false
            streamAddresses: [],
            error: null
         });
    })
    .catch(error => {
        console.error("Error stopping camera:", error);
        this.setState({ error: error.message });
    })
    .finally(() => {
       this.setState({ waiting: false });
    });
  }

  renderTitle() {
    return "Video Streaming";
  }

  renderContent() {

    const {
      active, cameraMode, videoDevices, videoDeviceSelected, videoCaps, videoCapSelected,
      stillDevices, stillDeviceSelected, stillCaps, stillCapSelected,
      rotations, rotSelected, bitrate, UDPChecked, useUDPIP, useUDPPort,
      FPSMax, fpsOptions, fpsSelected, timestamp, enableCameraHeartbeat,
      compression, mavStreamSelected, ifaces, streamAddresses, multicastString,
      loading, waiting, error // Use basePage state
  } = this.state;

  const isStreamingOrVideoMode = cameraMode === 'streaming' || cameraMode === 'video';
  const isPhotoMode = cameraMode === 'photo';
  const isStreamingMode = cameraMode === 'streaming';

  // Determine button text and action
  const mainButtonText = active
    ? `Stop ${cameraMode === 'streaming' ? 'Streaming' : (cameraMode === 'photo' ? 'Photo Mode' : 'Video Mode')}`
    : `Start ${cameraMode === 'streaming' ? 'Streaming' : (cameraMode === 'photo' ? 'Photo Mode' : 'Video Mode')}`;
  const mainButtonAction = active ? this.handleStopCamera : this.handleStartCamera;
  const mainButtonDisabled = waiting || loading; // Disable while loading initial data or performing action



    return (
      <Form style={{ width: 600 }}>
        {loading && <p>Loading configuration...</p>}
        {error && <Alert variant="danger">{error}</Alert>}

        <p><i>Stream live video from any connected camera devices. Only 1 camera can be streamed at a time. Multicast IP addresses are supported in RTP mode.</i></p>
        <h2>Configuration</h2>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Camera Mode</label>
              <div className="col-sm-8">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="cameramode" value="streaming" disabled={active} onChange={this.handleCameraModeChange} checked={cameraMode === "streaming" } />
                  <label className="form-check-label">Streaming Video (Default) </label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="cameramode" value="photo" disabled={active} onChange={this.handleUsePhotoModeChange} checked={cameraMode === "photo" } />
                  <label className="form-check-label">Still Photo Capture</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="cameramode" value="video" disabled={active} onChange={this.handleUsePhotoModeChange} checked={cameraMode === "video" } />
                  <label className="form-check-label">Local Video Recording</label>
                </div>
              </div>
        </div>

        <div style={{ display: (this.state.cameraMode === "streaming") ? "block" : "none"}}>
          <div className="form-group row" style={{ marginBottom: '5px'}}>
                <label className="col-sm-4 col-form-label">Streaming Mode</label>
                <div className="col-sm-8">
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="streamtype" value="rtp" disabled={this.state.streamingStatus} onChange={this.handleUseUDPChange} checked={this.state.UDPChecked} />
                    <label className="form-check-label">RTP (stream to single client)</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="streamtype" value="rtsp" disabled={this.state.streamingStatus} onChange={this.handleUseUDPChange} checked={!this.state.UDPChecked} />
                    <label className="form-check-label">RTSP (multiple clients can connect to stream)</label>
                  </div>
                </div>
            </div>
          </div>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Device</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.streamingStatus} onChange={this.handleVideoChange} options={this.state.dev} value={this.state.vidDeviceSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Resolution</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.streamingStatus} options={this.state.vidres} onChange={this.handleResChange} value={this.state.vidResSelected} />
          </div>
        </div>
        <div style={{ display: (typeof this.state.vidResSelected !== 'undefined' && this.state.vidResSelected.format !== "video/x-h264") ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Rotation</label>
            <div className="col-sm-8">
              <Select isDisabled={this.state.streamingStatus} options={this.state.rotations} onChange={this.handleRotChange} value={this.state.rotSelected} />
            </div>
          </div>

          <div style={{ display: (!this.state.UDPChecked && this.state.cameraMode != "photo") ? "block" : "none"}}>
            <div className="form-group row" style={{ marginBottom: '5px'}}>
              <label className="col-sm-4 col-form-label">Maximum Bitrate</label>
              <div className="col-sm-8">
                <input disabled={this.state.streamingStatus} type="number" name="bitrate" min="50" max="50000" step="10" onChange={this.handleBitrateChange} value={this.state.bitrate} />kbps
              </div>
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Timestamp Overlay</label>
            <div className="col-sm-8">
              <input type="checkbox" disabled={this.state.streamingStatus} onChange={this.handleTimestampChange} checked={this.state.timestamp} />
            </div>
          </div>

          <div style={{ display: (this.state.cameraMode === "streaming") ? "block" : "none"}}>
            <div className="form-group row" style={{ marginBottom: '5px'}}>
              <label className="col-sm-4 col-form-label">Compression</label>
              <div className="col-sm-8">
                <Select
                  isDisabled={this.state.streamingStatus}
                  options={[
                    { value: 'H264', label: 'H.264' },
                    { value: 'H265', label: 'H.265' }
                  ]}
                  onChange={(value) => this.setState({ compression: value })}
                  value={this.state.compression}
                />
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px'}}>
              <label className="col-sm-4 col-form-label">Framerate</label>
              <div className="col-sm-8" style={{ display: (this.state.FPSMax === 0) ? "block" : "none" }}>
                <Select isDisabled={this.state.streamingStatus} options={this.state.fps} value={this.state.fpsSelected} onChange={this.handleFPSChangeSelect} />
              </div>
              <div className="col-sm-8" style={{ display: (this.state.FPSMax !== 0) ? "block" : "none" }}>
                <input disabled={this.state.streamingStatus} type="number" name="fps" min="1" max={this.state.FPSMax} step="1" onChange={this.handleFPSChange} value={this.state.fpsSelected} />fps (max: {this.state.FPSMax})
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: (this.state.UDPChecked) ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label ">Destination IP</label>
            <div className="col-sm-8">
              <input type="text" name="ipaddress" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPIP} onChange={this.handleUDPIPChange} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Destination Port</label>
            <div className="col-sm-8">
              <input type="text" name="port" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPPort} onChange={this.handleUDPPortChange} />
            </div>
          </div>
        </div>

        <div style = {{display: ((this.state.cameraMode === "photo") ? "block" : "none")}}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-8" style={{ display: (this.state.streamingStatus) ? "block" : "none" }}>
              <Button onClick={this.handleCaptureStill} className="btn btn-primary" >Take Photo Now</Button>
            </div>
          </div>
          <br/>
        </div>

        <div style = {{display: ((this.state.cameraMode === "video") ? "block" : "none")}}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-8" style={{ display: (this.state.streamingStatus) ? "block" : "none" }}>
              <Button onClick={this.handleToggleVideo} className="btn btn-primary" >Start/stop Video Recording</Button>
            </div>
          </div>
          <br/>
        </div>

        <h3>MAVLink Video Streaming Service</h3>
        <p><i>Configuration for advertising the camera and associated video stream via MAVLink. See <a href='https://mavlink.io/en/services/camera.html#video_streaming'>here</a> for details.</i></p>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Enable camera heartbeats</label>
            <div className="col-sm-8">
              <input type="checkbox" disabled={this.state.streamingStatus} checked={this.state.enableCameraHeartbeat} onChange={this.handleUseCameraHeartbeatChange} />
            </div>
        </div>

        <div style={{ display: (this.state.enableCameraHeartbeat && !this.state.UDPChecked && this.state.cameraMode === "streaming") ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' } }>
              <label className="col-sm-4 col-form-label">Video source IP Address</label>
              <div className="col-sm-8">
                <Select isDisabled={this.state.streamingStatus} onChange={this.handleMavStreamChange} options={this.state.ifaces.map((item) => ({ value: item, label: item}))} value={this.state.mavStreamSelected} />
              </div>
          </div>
        </div>
        <br/>

        <div className = "videostreaming" style = {{display: (this.state.cameraMode === "streaming") ? "block" : "none"}}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-4"></div>
            <div className="col-sm-8">
              <Button onClick={this.handleStreaming} className="btn btn-primary">{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</Button>
            </div>
            <br/>
          </div>
        </div>
        <div className = "mavlink" style = {{display: (this.state.cameraMode != "streaming") ? "block" : "none"}}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-8">
              <Button onClick={this.handleStreaming} className="btn btn-primary">{this.state.streamingStatus ? "Stop MAVLink Camera Interface" : "Start MAVLink Camera Interface"}</Button>
            </div>
            <br/>
          </div>
        </div>

        <div style={{ display: (this.state.cameraMode === "streaming") ? "block" : "none"}}>
          <br />
          <h3 style={{ display: (this.state.streamingStatus && (this.state.cameraMode === "streaming")) ? "block" : "none" }}>Connection strings for video stream</h3>
          <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && !this.state.UDPChecked) ? "block" : "none" }}>
            <Accordion.Item eventKey="0">
              <Accordion.Header>
                + RTSP Streaming Addresses (for VLC, etc)
              </Accordion.Header>
              <Accordion.Body>
                {this.state.streamAddresses.map((item, index) => (
                  <p key={index} style={{ fontFamily: "monospace" }}>{item}</p>
                ))}
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="1">
              <Accordion.Header>
                + GStreamer Connection Strings
              </Accordion.Header>
              <Accordion.Body>
                {this.state.streamAddresses.map((item, index) => (
                  <p key={index} style={{ fontFamily: "monospace" }}>gst-launch-1.0 rtspsrc location={item} latency=0 is-live=True ! queue ! decodebin ! autovideosink</p>
                ))}
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="2">
              <Accordion.Header>
                + Mission Planner Connection Strings
              </Accordion.Header>
              <Accordion.Body>
                {this.state.streamAddresses.map((item, index) => (
                  <p key={index} style={{ fontFamily: "monospace" }}>rtspsrc location={item} latency=0 is-live=True ! queue ! application/x-rtp ! {this.state.compression.value == "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression.value == "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
                ))}
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
          <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && this.state.UDPChecked) ? "block" : "none" }}>
            <Accordion.Item eventKey="0">
              <Accordion.Header>
                + QGroundControl
              </Accordion.Header>
              <Accordion.Body>
                <p style={{ fontFamily: "monospace" }}>Video Source: UDP {this.state.compression.value == "H264" ? "h.264" : "h.265"} Video Stream</p>
                <p style={{ fontFamily: "monospace" }}>Port: {this.state.useUDPPort}</p>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="1">
              <Accordion.Header>
                + GStreamer
              </Accordion.Header>
              <Accordion.Body>
                <p style={{ fontFamily: "monospace" }}>gst-launch-1.0 udpsrc {this.state.multicastString}port={this.state.useUDPPort} caps=&apos;application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string){this.state.compression.value == "H264" ? "H264" : "H265"}&apos; ! rtpjitterbuffer ! {this.state.compression.value == "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression.value == "H264" ? "h264parse" : "h265parse"} ! {this.state.compression.value == "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! autovideosink sync=false</p>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="2">
              <Accordion.Header>
                + Mission Planner Connection Strings
              </Accordion.Header>
              <Accordion.Body>
                <p style={{ fontFamily: "monospace" }}>udpsrc {this.state.multicastString}port={this.state.useUDPPort} buffer-size=90000 ! application/x-rtp ! rtpjitterbuffer ! {this.state.compression.value == "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression.value == "H264" ? "h264parse" : "h265parse"} ! {this.state.compression.value == "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false</p>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </div>
      </Form>
    );
  }
}

export default VideoPage;
