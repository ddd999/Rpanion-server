#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

import subprocess
import re
import sys
import json

# Check if v4l2-ctl is installed
def check_if_v4l2_ctl_avail():
    try:
        subprocess.run(['v4l2-ctl', '--help'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError:
        print("v4l2-ctl is not installed. Exiting.")
        sys.exit(1)

def get_mbus_codes():
    # Run the command to get the MBUS codes
    command = "v4l2-ctl -d /dev/v4l-subdev0 --list-subdev-mbus-codes 0"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)

    if result.returncode != 0:
        print(f"Error running command for MBUS codes: {result.stderr}")
        return []

    # Regular expression to capture MBUS codes and their corresponding formats
    pattern = r"0x([0-9a-fA-F]+):\s+([A-Za-z0-9_]+)"
    return re.findall(pattern, result.stdout)

def get_resolutions_for_code(mbus_code):
    # Run the command to get the resolutions for a given MBUS code
    command = f"v4l2-ctl -d /dev/v4l-subdev0 --list-subdev-framesizes pad=0,code=0x{mbus_code}"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)

    if result.returncode != 0:
        print(f"Error running command for resolutions with MBUS code 0x{mbus_code}: {result.stderr}")
        return []

    # Regular expression to capture resolution sizes
    pattern = r"Size Range: (\d+)x(\d+)"
    matches =  re.findall(pattern, result.stdout)

    # Return list of resolutions as tuples of (width, height)
    return [{'width': int(w), 'height': int(h)} for w, h in matches]

check_if_v4l2_ctl_avail()

mbus_codes = get_mbus_codes()

if not mbus_codes:
    print("No MBUS codes found.")
    exit

stillCamCaps = []

for mbus_code, pixel_format in mbus_codes:
    # Get resolutions for the current MBUS code
    resolutions = get_resolutions_for_code(mbus_code)

    # Loop through the resolutions and build the structure like capsTest
    for res in resolutions:

        # Extract the part after "MEDIA_BUS_FMT_" in the pixel format
        if "MEDIA_BUS_FMT_" in pixel_format:
            pixel_format_short = pixel_format.split("MEDIA_BUS_FMT_")[1]
        else:
            pixel_format_short = pixel_format  # If no "MEDIA_BUS_FMT_", use the full format

        camera_info = {
        'value': f"{mbus_code}_{pixel_format_short}_{res['width']}x{res['height']}",
        'label': f"{res['width']}x{res['height']}_{pixel_format_short}",
        'width': res['width'],
        'height': res['height'],
        }
        stillCamCaps.append(camera_info)


    # # Store resolutions grouped by pixel format
    # if pixel_format not in resolutions_by_pixel_format:
    #     resolutions_by_pixel_format[pixel_format] = []
    # resolutions_by_pixel_format[pixel_format].append(resolutions)

print(json.dumps(stillCamCaps, indent=4))