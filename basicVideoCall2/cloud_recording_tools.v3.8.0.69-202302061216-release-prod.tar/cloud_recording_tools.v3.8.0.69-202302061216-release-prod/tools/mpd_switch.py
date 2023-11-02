#!/usr/bin/env python
import time
import re
import os
import sys
import glob
from optparse import OptionParser

def switch(url, web):
    if not os.path.isfile(url):
        return
    first_video = True
    frist_audio = True
    need_switch = True
    cur_list = "none"
    of_name = url + ".tmp"
    of = open(of_name, "w")
    with open(url) as f:
        for line in f:
            if line.find("<Initialization") > 0:
                if web:
                    need_switch = False
                    break
                else:
                    continue
            if line.find("video") > 0:
                cur_list = "video"
            elif line.find("audio") > 0:
                cur_list = "audio"
            #
            result = re.compile(r'(.*)media="(.*)"').match(line)
            if result:
                if cur_list == "video" and first_video and web:
                    first_video = False
                    of.write(line[0:line.find("<SegmentURL")] + "<Initialization sourceURL=\"" + result.group(2) + "\"/>\n")
                elif cur_list == "audio" and frist_audio and web:
                    frist_audio = False
                    of.write(line[0:line.find("<SegmentURL")] + "<Initialization sourceURL=\"" + result.group(2) + "\"/>\n")
            of.write(line)
    of.close()
    if need_switch:
        os.rename(of_name, url)
    else:
        os.remove(of_name)

def Transform(folder, web):
    path = os.path.dirname(os.path.realpath(__file__))
    os.chdir(folder)
    for url in glob.glob("*.mpd"):
        switch(url, web)

if __name__ == "__main__":
    parser = OptionParser()
    parser.add_option("-f", "--folder", type="string", dest="folder", help="switch folder", default="")
    parser.add_option("-w", "--web", action="store_true", dest="web", help="switch to web")
    parser.add_option("-d", "--default", action="store_false", dest="web", help="switch to default")

    (options, args) = parser.parse_args()
    if not options.folder:
        parser.print_help()
        parser.error("Not set folder")

    Transform(options.folder, options.web)
    if options.web:
        type = "web"
    else:
        type = "default"
    print("Switch To <" + type + "> Done.")