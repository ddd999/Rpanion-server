const assert = require('assert')
const settings = require('settings-store')
const VideoStream = require('./videostream')
const winston = require('./winstonconfig')(module)

const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai
chai.use(require('sinon-chai'))
const { minimal, common } = require('node-mavlink')

describe('Video Functions', function () {
  it('#videomanagerinit()', function () {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    // check initial status
    assert.equal(vManager.active, false)
  })

  it('#videomanagerpopulateaddresses()', function () {
    // Getting a list of valid IP addresses
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.populateAddresses()

    // check initial status
    assert.notEqual(vManager.ifaces.length, 0)
    assert.notEqual(vManager.deviceAddresses.length, 0)
  })

  it('#videomanagerscan()', function (done) {
    // Scanning for video devices capable of streaming
    // in a CI environment, no devices will be returned
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.populateAddresses()
    vManager.getVideoDevices(function (err, devices, active, seldevice, selRes, selRot, selbitrate, selfps,
      SeluseUDP, SelusePhotoMode, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres,
      useCameraHeartbeat, useMavControl, selMavURI, selMediaPath) {
      assert.equal(err, null)
      assert.equal(active, false)
      assert.notEqual(seldevice, null)
      assert.notEqual(selRes, null)
      assert.notEqual(selRot, null)
      assert.notEqual(selbitrate, null)
      assert.notEqual(selfps, null)
      assert.equal(SeluseUDP, false)
      assert.equal(SelusePhotoMode, false)
      assert.equal(SeluseUDPIP, '127.0.0.1')
      assert.equal(SeluseUDPPort, 5400)
      assert.equal(timestamp, false)
      assert.notEqual(fps, null)
      assert.notEqual(FPSMax, null)
      assert.notEqual(vidres, null)
      assert.equal(useCameraHeartbeat, false)
      assert.equal(useMavControl, false)
      assert.notEqual(selMavURI, null)
      assert.equal(selMediaPath, '/home/pi/Rpanion-server/media/')
      done()
    })
  }).timeout(5000)

  it('#videomanagerisUbuntu()', async function () {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    const res = await vManager.isUbuntu()
    assert.equal(res, true)
  })

  it('#videomanagerstartStopStreaming()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.startStopStreaming(true, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, false, true, false, false, '0', '/home/pi/Rpanion-server/media/', function (err, status, addresses) {
      assert.equal(err, null)
      assert.equal(status, true)
      assert.notEqual(vManager.deviceStream.pid, null)
      vManager.startStopStreaming(false, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, false, true, false, false, '0', '/home/pi/Rpanion-server/media/', function (err, status, addresses) {
        assert.equal(err, null)
        assert.equal(status, false)
        done()
      })
    })
  })

  describe('#videomanagerstartInterval()', () => {
    let vManager
    let setIntervalStub
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      setIntervalStub = sinon.stub(global, 'setInterval')
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should start an interval and emit a "cameraheartbeat" event', () => {
      const intervalId = 12345
      setIntervalStub.returns(intervalId)

      vManager.startInterval()

      // Simulate the interval execution
      const mavType = minimal.MavType.CAMERA
      const autopilot = minimal.MavAutopilot.INVALID
      const component = minimal.MavComponent.CAMERA

      // Call the interval function manually
      const intervalFunction = setIntervalStub.firstCall.args[0] // Get the first argument (the callback)
      intervalFunction() // Manually invoke the callback

      expect(vManager.intervalObj).to.equal(intervalId)
      expect(emitStub).to.have.been.calledWith('cameraheartbeat', mavType, autopilot, component)
    })
  })

  describe('#videomanagercaptureStillPhoto()', () => {
    let vManager
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      // Mocking deviceStream with a kill method
      vManager.deviceStream = {
      kill: sinon.stub()
    };
      sinon.stub(Date, 'now').returns(1729137498022000); // Stub to return a fixed timestamp
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should emit a "cameratrigger" event', () => {

      // build a CAMERA_TRIGGER packet
      const expectedMsg = new common.CameraTrigger()
      expectedMsg.timeUsec = BigInt(Date.now() * 1000)
      expectedMsg.seq = 0

      vManager.captureStillPhoto(); // Call the method under test

      expect(emitStub).to.have.been.calledWith('cameratrigger', expectedMsg)
    })
  })

})
