#!/usr/bin/env python
import time
import re
import os
import sys
import signal
import glob
import parser_metadata_files
import video_convert
import format_convert
import mpd_to_m3u8
import mpd_switch
from optparse import OptionParser

import traceback


if '__main__' == __name__:
    import sys

    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGQUIT, signal.SIG_IGN)

    parser = OptionParser()
    parser.add_option("-f", "--folder", type="string", dest="folder", help="Convert folder", default="")
    parser.add_option("-m", "--mode", type="int", dest="mode", help="Convert merge mode, \
        [0: txt merge A/V(Default); 1: uid merge A/V; 2: uid merge audio; 3: uid merge video; 4: remuxing]", default=0)
    parser.add_option("-p", "--fps", type="int", dest="fps", help="Convert fps, default 15", default=15)
    parser.add_option("-s", "--saving", action="store_true", dest="saving", help="Convert Do not time sync",
                      default=False)
    parser.add_option("-r", "--resolution", type="int", dest="resolution", nargs=2,
                      help="Specific resolution to convert '-r width height' \nEg:'-r 640 360'", default=(0, 0))
    parser.add_option("-a", "--audio", action='store_true',dest='audio', help="Save audio file", default=False)
    parser.add_option("-c", "--interval", type="int", dest="interval", help="Snapshot interval, unit: ms, min: 100ms")
    parser.add_option("-o", "--output", type="string", dest="output", help="Output filename, used with -u")
    parser.add_option("-u", "--uid", type="string", dest="uid", help="Convert uid")
    parser.add_option("-b", type="float", dest="start_time", help="Convert start timestamp, unit: second.millisecond \nEg:'-b 10.500'")
    parser.add_option("-t", type="float", dest="stop_time", help="Convert duration, unit: second.millisecond \nEg:'-t 5.500'")
    parser.add_option("-e", "--standardTS", action="store_true", dest="standard_ts", help="Transcoding to standard ts format", default=False)
    

    (options, args) = parser.parse_args()
    if not options.folder:
        parser.print_help()
        parser.error("Not set folder")
    
    if options.stop_time != None and options.start_time == None:
        parser.error("-t used with -b!")  
    
    if options.output != None and options.uid == None:
        parser.error("-o used with -u!")  
        
    if options.interval != None and options.interval <= 0:
        parser.error("-c option parameter invalid")
    
    if options.uid != None:
        if options.uid == "":
            parser.error("-u option parameter invalid")
    else:
        options.uid = ""
        
    if options.output != None:
        output_file, suffix = os.path.splitext(options.output.strip())
        if output_file == "" or suffix == "" or suffix == ".":
            parser.error("-o option parameter invalid")
        
        pattern = r'[\!@\#\$%^&\*\(\)\+=\[\]\{\}~\|;:\?<>\\\/ `\^,\'"\.]'
        if re.search(pattern, output_file) or output_file[0:1] == '-':
            parser.error("-o option parameter invalid")
        
        pattern = r'[\!@\#\$%^&\*\(\)\+=\[\]\{\}~\|;:\?<>\\\/ `\^,\'"\-\_]'
        if re.search(pattern, suffix):
            parser.error("-o option parameter invalid")
    else:
        options.output = ""
        
    if options.start_time != None and options.start_time < 0:
        parser.error("-b option parameter invalid")
            
    if options.stop_time != None and options.stop_time <= 0:
        parser.error("-t option parameter invalid")    
    
    if options.interval and (options.start_time > 0 or options.stop_time > 0):
        parser.error("-c is not supported options -b or -t!")
        
    try:
        mpd_switch.Transform(options.folder, False)
        if options.mode == 4:
            path = os.path.dirname(os.path.realpath(__file__))
            format_convert.Convert(path, options.folder, "m3u8", "mp4")
            format_convert.Convert(path, options.folder, "mpd", "mkv")
            mpd_switch.Transform(options.folder, True)
            exit(0)

        mpd_to_m3u8.Transform(options.folder, options.uid)

        os.environ['FPSARG'] = "%s" % options.fps
        parser_metadata_files.cmds_parse(["dispose", options.folder, str(options.mode), options.uid])
        video_convert.do_work()
        parser_metadata_files.cmds_parse(["clean", options.folder])

        mpd_to_m3u8.Clear()
        mpd_switch.Transform(options.folder, True)
    except Exception as e:
        traceback.print_exc()

    