#!/usr/bin/env python
import time
import re
import os
import sys
import glob
import signal
import subprocess
from collections import OrderedDict

class OrderedDictList:
    def __init__(self):
        self.list = OrderedDict()
    def append(self, key, item):
        if not key in self.list.keys():
            self.list[key] = []
        self.list[key].append(item)
    def getList(self):
        return self.list
    def Print(self):
        print(self.list)

class MergeList:
    def __init__(self, path):
        self.path = path
        self.video_list = OrderedDictList()
        self.audio_list = OrderedDictList()
        self.video_url = ""
        self.audio_url = ""
        self.video_max_duration = 0.0
        self.audio_max_duration = 0.0
        self.cur_list = OrderedDictList()
    def getDuration(self, file):
        remux_file = "remux_" + file + ".mkv"
        cmd = self.path + "/ffmpeg -y -i " + file + " -c copy " + remux_file
        os.system(cmd)
        cmd = self.path + "/ffmpeg -i " + remux_file + " 2>&1 | grep Duration"
        output = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, env=os.environ.copy()).communicate()[0]
        os.system("rm -f " + remux_file)
        result = re.compile(r'(.*)Duration: (.*), start: (.*),').match(output)
        if not result:
            return 0.0
        #
        dur_str = result.group(2)
        if dur_str == "N/A":
            return 0.0
        dot = dur_str.find(".")
        t = time.strptime(dur_str[0:dot], "%H:%M:%S")
        dur = t.tm_hour * 3600 + t.tm_min * 60 + t.tm_sec + float(dur_str[dot:])
        start = float(result.group(3))
        return dur - start
    def addHLSList(self, url):
        if url.find("video") > 0:
            list = self.video_list
            self.video_url = url
        else:
            list = self.audio_list
            self.audio_url = url
        # check
        if not os.path.isfile(url):
            return
        with open(url) as f:
            for line in f:
                result = re.compile(r'(.*),TIME=([0-9]+)').match(line)
                if result:
                    list.append(result.group(2), result.group(0))
                    continue
                result = re.compile(r'(.*)_([a-zA-Z]+)_([0-9]+).*').match(line)
                if result:
                    # count max duration
                    dur = self.getDuration(result.group(0))
                    if url.find("video") > 0 and dur > self.video_max_duration:
                        self.video_max_duration = dur
                    elif dur > self.audio_max_duration:
                        self.audio_max_duration = dur
                    # fill
                    list.append(result.group(3), "#EXTINF:%.6f" % dur)
                    list.append(result.group(3), result.group(0))
        #print "video_list: "
        #self.video_list.Print()
        #print "audio_list: "
        #self.audio_list.Print()
    def addDASHList(self, url):
        # check
        if not os.path.isfile(url):
            return
        with open(url) as f:
            for line in f:
                #
                if line.find("video") > 0:
                    self.cur_list = self.video_list
                elif line.find("audio") > 0:
                    self.cur_list = self.audio_list
                #
                result = re.compile(r'(.*)width="([0-9]+)" height="([0-9]+)" rotate="([0-9]+)" time="([0-9]+)"').match(line)
                if result:
                    event_line = "#EXT-X-AGORA-ROTATE:WIDTH=" + result.group(2) \
                               + ",HEIGHT=" + result.group(3) \
                               + ",ROTATE=" + result.group(4) \
                               + ",TIME=" + result.group(5)
                    self.cur_list.append(result.group(5), event_line)
                    continue
                result = re.compile(r'(.*)ExtDiscontinuity time="([0-9]+)"').match(line)
                if result:
                    if self.cur_list == self.video_list:
                        cur_type = "VIDEO"
                    else:
                        cur_type = "AUDIO"
                    event_line = "#EXT-X-AGORA-TRACK-EVENT:EVENT=START,TRACK_TYPE=" + cur_type \
                               + ",TIME=" + result.group(2)
                    self.cur_list.append(result.group(2), event_line)
                    continue
                result = re.compile(r'(.*)media="((.*)_([a-zA-Z]+)_([0-9]+).*)"').match(line)
                if result:
                     # count max duration
                    dur = self.getDuration(result.group(2))
                    if self.cur_list == self.video_list and dur > self.video_max_duration:
                        self.video_max_duration = dur
                    elif dur > self.audio_max_duration:
                        self.audio_max_duration = dur
                    # fill
                    self.cur_list.append(result.group(5), "#EXTINF:%.6f" % dur)
                    self.cur_list.append(result.group(5), result.group(2))
        #print "video_list: "
        #self.video_list.Print()
        #print "audio_list: "
        #self.audio_list.Print()
    def generateNewList(self):
        # video list
        file = self.video_url[0:self.video_url.rfind("_video") + 6] + "_999999_999.m3u8"
        with open(file, 'w') as f:
            f.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ALLOW-CACHE:YES\n#EXT-X-TARGETDURATION:%d\n" \
                % self.video_max_duration)
            #
            for lines in self.video_list.getList().values():
                for line in lines:
                    if line.find("EVENT=START") > 0:
                        f.write("#EXT-X-DISCONTINUITY\n")
                    f.write("%s\n" % line)
            f.write("#EXT-X-ENDLIST\n")

        # audio list
        file = self.audio_url[0:self.audio_url.rfind("_audio") + 6] + "_999999_999.m3u8"
        with open(file, 'w') as f:
            f.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ALLOW-CACHE:YES\n#EXT-X-TARGETDURATION:%d\n" \
                % self.audio_max_duration)
            #
            for lines in self.audio_list.getList().values():
                for line in lines:
                    if line.find("EVENT=START") > 0:
                        f.write("#EXT-X-DISCONTINUITY\n")
                    f.write("%s\n" % line)
            f.write("#EXT-X-ENDLIST\n")

def Clear():
    os.system("rm -rf *999999_999.m3u8")

def Transform(folder, uid):
    path = os.path.dirname(os.path.realpath(__file__))
    os.chdir(folder)
    # clear first
    Clear()
    # specify uid ?
    if uid:
        pattern = "*__uid_s_%s__uid_e_*.mpd" % uid
    else:
        pattern = "*.mpd"
    # parser
    for url in glob.glob(pattern):
        m = MergeList(path)
        m.addDASHList(url)
        prefix = url[0:url.rfind("av.mpd")]
        # find the largest video m3u8
        video_url = ""
        for l in glob.glob(prefix + "video*.m3u8"):
            if not video_url or (os.path.getsize(l) > os.path.getsize(video_url)):
                video_url = l
        if not video_url:
            video_url = prefix + "video.m3u8"
        m.addHLSList(video_url)

        # find the largest audio m3u8
        audio_url = ""
        for l in glob.glob(prefix + "audio*.m3u8"):
            if not audio_url or (os.path.getsize(l) > os.path.getsize(audio_url)):
                audio_url = l
        if not audio_url:
            audio_url = prefix + "audio.m3u8"
        m.addHLSList(audio_url)

        #
        m.generateNewList()

if __name__ == "__main__":
    Transform(".", "")