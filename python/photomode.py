#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

from picamera2 import Picamera2
import argparse
import time, signal, os

from gi.repository import GLib

# Reset the signal flag
GOT_SIGNAL = 0
# Get the PID. Might not need if NodeJS can send signals
pid = os.getpid()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Camera control server using libcamera")
    parser.add_argument("-d", "--destination", dest="mediaPath",
                        help="Save captured image to DESTPATH", metavar="DESTPATH")
    args = parser.parse_args()

mediaPath = args.mediaPath
print("Media storage location is:", mediaPath)

def receive_signal(signum, stack):
    global GOT_SIGNAL
    GOT_SIGNAL = 1

# Register the signal handler function to fire when signals are received
signal.signal(signal.SIGUSR1, receive_signal)
print("PID is : ", pid)

# Initialize the camera
picam2 = Picamera2()
# By default, use the full resolution of the sensor
config = picam2.create_still_configuration(
    main={"size": picam2.sensor_resolution},
    buffer_count=2
)
picam2.configure(config)
# Keep the camera active to make responses faster
picam2.start()
print("Waiting 2 seconds for camera to stabilize...")
time.sleep(2)
print("Camera is ready")

loop = GLib.MainLoop()

try:
    # Wait for a signal to arrive
    while True:
        if GOT_SIGNAL == 1:
            print("Received signal.SIGUSR1. Capturing photo.")
            filename = time.strftime("/home/pi/Rpanion-server/media/RPN%Y%m%d_%H%M%S.jpg")
            print(filename)
            output_orig = picam2.capture_file(filename)
            GOT_SIGNAL = 0
        # Wait for a signal
        signal.pause()
        #loop.run()
except:
    print("Exiting Photo Server")
    #pipeline.set_state(Gst.State.NULL)
    #loop.quit()
