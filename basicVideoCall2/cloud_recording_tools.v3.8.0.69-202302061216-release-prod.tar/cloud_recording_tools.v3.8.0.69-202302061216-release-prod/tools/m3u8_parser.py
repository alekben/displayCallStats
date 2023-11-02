#!/usr/bin/env python
import time
import re
import os
import sys
import traceback
import copy
import subprocess
import helper


class PerUidCachedM3u8Dict(object):
    ''' merged_video_m3u8_dict should be better call fistly,
    but merged_audio_m3u8_dict & merged_av_m3u8_dict does dispose key conflict issue'''

    def __init__(self):
        self.merged_av_mediafile_dict = {}
        self.ordered_merged_av_mediafile_dict = None
        self.middle_file = "media_file.mf"
        self.fps = 15
        self.py_dir = os.path.split(os.path.realpath(__file__))[0]
        if os.environ.get('FPSARG') is not None:
            self.fps = int(os.environ['FPSARG'])
            if (self.fps <= 0):
                self.fps = 15

        #structure simlar with m3u8fileparser xxx_mediafile_dict
        ''' session1_start_utc:{
                                utc:{
                                    'fileinfos':{
                                        'name':xxxxx,
                                        'suffix':mp4,
                                        'duration':,
                                    },
                                    'start_event':None,
                                    'rotation_infos':{
                                        'width':
                                        'height':
                                        'rotate':
                                        'time':utc,
                                    },
                                    'mixed':None,
                                }
                            },
                            session2_start_utc:{
                                utc:{
                                    'fileinfos':{
                                        'name':xxxxx,
                                        'suffix':mp4,
                                        'duration':,
                                    },
                                    'start_event':None,
                                    'rotation_infos':{
                                        'width':
                                        'height':
                                        'rotate':
                                        'time':utc,
                                    },
                                    'mixed':None,
                                }
                            }
                            '''
        self.session_dict = {
                    }

        self.ordered_session_dict = None


    def take_session_from_whole_dict(self, delta = 15000):
        temp_session = {}
        start_time_tuple=()
        start_flag = False
        next_timestamp = 0.0
        if self.ordered_merged_av_mediafile_dict is not None:
            for item in self.ordered_merged_av_mediafile_dict:
                if item[1].has_key('fileinfos') and item[1]['fileinfos'].has_key('duration'):
                    utc = item[0]
                    duration = item[1]['fileinfos']['duration']
                    if not start_flag:
                        #new session start point
                        start_flag = True
                        start_time_tuple = (utc, helper.utc_convert(utc))

                    else:
                        #judge if it's session stop point
                        if next_timestamp + delta < helper.utc_convert(utc):
                            #save previous data in session_dict

                            z = zip(temp_session.keys(), temp_session.values())
                            sorted_temp_session = sorted(z)

                            self.session_dict[start_time_tuple[0]] = copy.deepcopy(sorted_temp_session)

                            #clear up  & init
                            temp_session.clear()

                            start_time_tuple = (utc, helper.utc_convert(utc))

                    #move to next utc_timestamp
                    next_timestamp = helper.utc_convert(utc) + float(duration)

                #store everything
                temp_session[item[0]] = item[1]
        z = zip(temp_session.keys(), temp_session.values())
        sorted_temp_session = sorted(z)

        self.session_dict[start_time_tuple[0]] = copy.deepcopy(sorted_temp_session)

    def sorted_session_dict(self):
        z = zip(self.session_dict.keys(), self.session_dict.values())
        self.ordered_session_dict = sorted(z)

    def sorted_mediafile_dict(self):
        if self.ordered_merged_av_mediafile_dict:
            return 
        z = zip(self.merged_av_mediafile_dict.keys(), self.merged_av_mediafile_dict.values())
        self.ordered_merged_av_mediafile_dict = sorted(z)

    def is_duration_zero(self, file_name):
        cmd = self.py_dir + "/ffmpeg -i %s 2>&1 | grep Duration | awk '{print $2}' | tr -d ," % file_name
        result = subprocess.check_output(cmd, shell=True).strip()
        return result == "" or result == "00:00:00.00"

    def merged_video_m3u8_dict(self, video_mediafile_dict):       
        '''this call should be better call fistly, because it doesn't dispose key conflict'''
        temp_files = []
        for item in video_mediafile_dict.items():
            utc = item[0]
            utc_item_value = copy.deepcopy(item[1])
            suffix = utc_item_value['fileinfos']['suffix']

            duration = utc_item_value['fileinfos']['duration']
            file_name = utc_item_value['fileinfos']['name']
            # skip corrupted ts files
            if duration < 1.0:
                if (self.is_duration_zero(file_name)):
                    continue

            if suffix != 'webm':
                media_filename = utc_item_value['fileinfos']['name']
                media_filename_prefix = media_filename.split(suffix)[0]
                #modify value
                new_suffix='mp4'
                temp_filename = media_filename_prefix + "_bat." + new_suffix
                target_filename = media_filename_prefix + new_suffix
                utc_item_value['fileinfos']['name'] = target_filename
                utc_item_value['fileinfos']['suffix'] = new_suffix

                #convert video from ts to mp4
                command = self.py_dir + "/ffmpeg -fflags +igndts -i " + media_filename + " -vcodec copy -copytb 1 -copyts -y " + temp_filename
                print(command)
                errorcode = subprocess.Popen(command, shell=True, env=None).wait()
                if errorcode:
                    os.system("rm -f " + temp_filename)
                    print "ffmpeg parse error, filename: %s" % media_filename
                    continue

                command = self.py_dir + "/ffmpeg -i %s -vcodec libx264 -vf 'fps=%d' -y %s -vsync 1" % (temp_filename, self.fps, target_filename)
                command +=  " 2>&1 | tee -a convert.log"
                print(command)
                errorcode = subprocess.Popen(command, shell=True, env=None).wait()
                os.system("rm -f " + temp_filename)
                if errorcode:
                    print "ffmpeg parse error, filename: %s" % media_filename
                    continue

                #recombine
                #if utc conflict, increase it 0.001f each time
                while self.merged_av_mediafile_dict.has_key(utc):
                    utc_float = float(utc) + 0.001
                    utc = ("%.3f" % utc_float)
                temp_files.append(target_filename + " \n")
            
            self.merged_av_mediafile_dict[utc] = utc_item_value

        if len(temp_files) > 0:
            fd = open(self.middle_file,'a')
            fd.writelines(temp_files)
            fd.close()
        #self.merged_av_mediafile_dict.update(video_mediafile_dict)
    def merged_audio_m3u8_dict(self, audio_mediafile_dict):       
        new_suffix='aac'
        temp_files = []
        for item in audio_mediafile_dict.items():
            utc = item[0]
            utc_item_value = copy.deepcopy(item[1])
            suffix = utc_item_value['fileinfos']['suffix']
            media_filename = utc_item_value['fileinfos']['name']
            media_filename_prefix = media_filename.split(suffix)[0]

            #modify value
            target_filename = media_filename_prefix + new_suffix
            utc_item_value['fileinfos']['name'] = target_filename
            utc_item_value['fileinfos']['suffix'] = new_suffix

            #extract audio from ts
            command = self.py_dir + '/ffmpeg -i ' + media_filename + ' -y ' + target_filename
            command += " 2>&1 | tee -a convert.log"
            print(command)
            subprocess.Popen(command, shell=True, env=None).wait()

            #recombine
            #if utc conflict, increase it 0.001f each time
            while self.merged_av_mediafile_dict.has_key(utc):
                utc_float = float(utc) + 0.001
                utc = ("%.3f" %utc_float)
                
            self.merged_av_mediafile_dict[utc] = utc_item_value

            temp_files.append(target_filename + " \n")
        if len(temp_files) > 0:
            fd = open(self.middle_file,'a')
            fd.writelines(temp_files)
            fd.close()

    def merged_av_m3u8_dict(self, av_media_file_dict):
        new_audio_suffix='aac'
        new_video_suffix='ts'

        temp_files = []
        for item in av_media_file_dict.items():
            utc = item[0]
            utc_audio_item_value = copy.deepcopy(item[1])
            utc_video_item_value = copy.deepcopy(item[1])

            suffix = utc_audio_item_value['fileinfos']['suffix']
            media_filename = utc_audio_item_value['fileinfos']['name']
            media_filename_prefix = media_filename.split(suffix)[0]


            #modify value
            #audio
            target_audio_filename = media_filename_prefix + '.' + new_audio_suffix
            utc_audio_item_value['fileinfos']['name'] = target_audio_filename
            utc_audio_item_value['fileinfos']['suffix'] = new_audio_suffix
            if utc_audio_item_value.has_key('rotation_infos'):
                del utc_audio_item_value['rotation_infos']

            #video
            target_video_filename = media_filename_prefix + '.' + new_video_suffix
            utc_video_item_value['fileinfos']['name'] = target_video_filename
            utc_video_item_value['fileinfos']['suffix'] = new_video_suffix

            #extract audio&video from ts
            command = self.py_dir + '/ffmpeg -i ' + media_filename + ' -y ' + target_audio_filename
            + ' -vcodec copy ' + target_video_filename
            command +=  " 2>&1 | tee -a convert.log"
            print(command)
            subprocess.Popen(command, shell=True, env=None).wait()


            #recombine
            #if utc conflict, increase it 0.001f each time
            while self.merged_av_mediafile_dict.has_key(utc):
                utc_float = float(utc) + 0.001
                utc = ("%.3f" %utc_float)
            self.merged_av_mediafile_dict[utc] = utc_audio_item_value

            #if utc conflict, increase it 0.001f each time
            while self.merged_av_mediafile_dict.has_key(utc):
                utc_float = float(utc) + 0.001
                utc = ("%.3f" %utc_float)
            self.merged_av_mediafile_dict[utc] = utc_video_item_value

            temp_files.append(target_audio_filename + " \n")
            temp_files.append(target_video_filename + " \n")

        if len(temp_files) > 0:
            fd = open(self.middle_file,'a')
            fd.writelines(temp_files)
            fd.close()
    

#m3u8 ->whole  
class M3u8FileParser(object):
    '''analyse m3u8 parser'''
    def __init__(self, uid, m3u8file):
        self.uid = uid
        self.m3u8file = m3u8file
        self.middle_file = "media_file.mf"

        # media file format
        self.audio_file_name_pat = r'.*__uid_s_%s__uid_e_audio_(\d+)\.([a-zA-Z0-9]+)' %(uid)
        self.regex_audio_file_name_pat = re.compile(self.audio_file_name_pat)

        self.video_file_name_pat = r'.*__uid_s_%s__uid_e_video_(\d+)\.([a-zA-Z0-9]+)' %(uid)
        self.regex_video_file_name_pat = re.compile(self.video_file_name_pat)

        self.av_file_name_pat = r'.*__uid_s_%s__uid_e_av_(\d+)\.([a-zA-Z0-9]+)' %(uid)
        self.regex_av_file_name_pat = re.compile(self.av_file_name_pat)


        # event format
        ## agora specific
        self.track_event_pat = r'#EXT-X-AGORA-TRACK-EVENT:EVENT=(\w+),TRACK_TYPE=(\w+),TIME=(\d+)'
        self.regex_track_event_pat = re.compile(self.track_event_pat)

        self.track_video_rotate_pat = r'#EXT-X-AGORA-ROTATE:WIDTH=(\d+),HEIGHT=(\d+),ROTATE=(\d+),TIME=(\d+)'
        self.regex_track_video_rotate_pat = re.compile(self.track_video_rotate_pat)

        ## common part
        self.track_file_duration_pat = r'#EXTINF:(\d+\.\d+)'
        self.regex_track_file_duration_pat = re.compile(self.track_file_duration_pat)
        self.av_mediafile_dict = {
                '''utc:{
                    'fileinfos':{
                        'name':xxxxx,
                        'suffix':mp4,
                        'duration':,
                    },
                    'start_event':None,
                    'rotation_infos':{
                        'width':
                        'height':
                        'rotate':
                        'time':utc,
                    },
                    'mixed':None,
                }
                '''
                }

        self.audio_mediafile_dict = {
                #000k
                }

        self.video_mediafile_dict = {
                #000k
                }
        self.rotation_info_dict = []
        self.refresh_rotate_info = True

    def get_av_mediafile_dict(self):
        return self.av_mediafile_dict
    
    def get_audio_mediafile_dict(self):
        return self.audio_mediafile_dict

    def get_video_mediafile_dict(self):
        return self.video_mediafile_dict

    def metadatafile_to_list(self, file):
        event_dict={}
        f = open(file)
        lines = f.readlines()
        for line in lines:
            if self.is_event_info(line, event_dict):
                continue
            elif self.is_media_file_info(line, event_dict):
                event_dict.clear()
        self.merge_adjacent_video()

    def merge_adjacent_video(self):
        z = zip(self.video_mediafile_dict.keys(), self.video_mediafile_dict.values())
        ordered_video_mediafile_dict = sorted(z)
        new_video_mediafile_dict = {}
        adjacent_files = []
        last_end = 0.000
        event_dict = {}
        first_utc = 0
        new_utc = 0.000
        new_duration = 0.000
        duration = 0.000
        temp_file = []
        width = 0
        height = 0
        for item in ordered_video_mediafile_dict:
            if item[1]['fileinfos']['suffix'] != 'ts':
                new_video_mediafile_dict[item[0]] = copy.deepcopy(item[1])
                continue
            if last_end == 0:
                first_utc = item[0]
                new_utc = helper.utc_convert(item[0])
                new_duration += float(item[1]['fileinfos']['duration'])
                adjacent_files.append(item[1]['fileinfos']['name'])
                event_dict = copy.deepcopy(item[1])
                last_end = new_utc + new_duration
                width = item[1]['rotation_infos'][0]['width']
                height = item[1]['rotation_infos'][0]['height']
            elif (abs(helper.utc_convert(item[0]) - last_end) <= 0.001)\
                    and item[1]['fileinfos']['suffix'] == event_dict['fileinfos']['suffix']:
                adjacent_files.append(item[1]['fileinfos']['name'])
                event_dict['rotation_infos'].extend(item[1]['rotation_infos'])
                new_duration += float(item[1]['fileinfos']['duration'])
                last_end = new_utc + new_duration
            else:
                file_name = event_dict['fileinfos']['name'] + "_concat." + event_dict['fileinfos']['suffix']
                cmd = "cat "
                for ts_file in adjacent_files:
                    cmd += ts_file + " "
                cmd += ">> " + file_name
                print(cmd)
                subprocess.Popen(cmd, shell=True, env=None).wait()
                #os.system("rm -f " + concat_file)
                event_dict['fileinfos']['name'] = file_name
                event_dict['fileinfos']['duration'] = new_duration
                new_video_mediafile_dict[first_utc] = copy.deepcopy(event_dict)
                temp_file.append(file_name + '\n')
                adjacent_files = []
                adjacent_files.append(item[1]['fileinfos']['name'])

                width = item[1]['rotation_infos'][0]['width']
                height = item[1]['rotation_infos'][0]['height']
                first_utc = item[0]
                new_utc = helper.utc_convert(item[0])
                new_duration = float(item[1]['fileinfos']['duration'])
                last_end = new_utc + new_duration
                event_dict = copy.deepcopy(item[1])
        if new_utc != 0.0:
            file_name = event_dict['fileinfos']['name'] + "_concat." + event_dict['fileinfos']['suffix']
            cmd = "cat "
            for ts_file in adjacent_files:
                cmd += ts_file + " "
            cmd += ">> " + file_name
            print(cmd)
            subprocess.Popen(cmd, shell=True, env=None).wait()
            adjacent_files = []
            event_dict['fileinfos']['name'] = file_name
            event_dict['fileinfos']['duration'] = new_duration
            new_video_mediafile_dict[first_utc] = copy.deepcopy(event_dict)
            self.video_mediafile_dict = {}
            self.video_mediafile_dict.update(new_video_mediafile_dict)
            temp_file.append(file_name + '\n')

        if len(temp_file) > 0:
            fd = open(self.middle_file,'a')
            fd.writelines(temp_file)
            fd.close()

    def is_media_file_info(self, lineinfo, event_dict):
        audio_result = self.regex_audio_file_name_pat.match(lineinfo)
        video_result = self.regex_video_file_name_pat.match(lineinfo)
        av_result = self.regex_av_file_name_pat.match(lineinfo)
        if audio_result:
            utc = audio_result.group(1)
            
            event_dict['fileinfos']['name'] = audio_result.group(0)
            event_dict['fileinfos']['suffix'] = audio_result.group(2)
            event_dict['mixed'] = False
            event_dict['type'] = 'audio'

            self.audio_mediafile_dict[utc] = copy.deepcopy(event_dict)
            return True

        elif video_result:
            utc = video_result.group(1)
            event_dict['fileinfos']['name'] = video_result.group(0)
            event_dict['fileinfos']['suffix'] = video_result.group(2)
            event_dict['mixed'] = False
            event_dict['type'] = 'video'
            event_dict['rotation_infos'] = copy.deepcopy(self.rotation_info_dict)
            self.rotation_info_dict = []
            if len(event_dict['rotation_infos']) > 0:
                self.rotation_info_dict.append(copy.deepcopy(event_dict['rotation_infos'][len(event_dict['rotation_infos']) - 1]))
            self.refresh_rotate_info = True

            self.video_mediafile_dict[utc] = copy.deepcopy(event_dict)
            return True

        elif av_result:
            utc = av_result.group(1)
            event_dict['fileinfos']['name'] = av_result.group(0)
            event_dict['fileinfos']['suffix'] = av_result.group(2)
            event_dict['mixed'] = True
            event_dict['rotation_infos'] = copy.deepcopy(self.rotation_info_dict)
            event_dict['type'] = 'av'

            self.av_mediafile_dict[utc] = copy.deepcopy(event_dict)
            return True
        else:
            return False
        

    def is_event_info(self, lineinfo, event_dict):
        event_result = self.regex_track_event_pat.match(lineinfo)
        video_rotate_result = self.regex_track_video_rotate_pat.match(lineinfo)
        file_duration_result = self.regex_track_file_duration_pat.match(lineinfo)
        if event_result:
            event_dict['start_event'] = True
            return True

        elif video_rotate_result:
            if not event_dict.has_key('rotation_infos'):
                event_dict['rotation_infos'] = {}
            event_dict['rotation_infos']['width'] = video_rotate_result.group(1)
            event_dict['rotation_infos']['height'] = video_rotate_result.group(2)
            event_dict['rotation_infos']['rotate'] = video_rotate_result.group(3)
            event_dict['rotation_infos']['time'] = video_rotate_result.group(4)
            if self.refresh_rotate_info:
                self.rotation_info_dict = []
                self.refresh_rotate_info = False
            self.rotation_info_dict.append(copy.deepcopy(event_dict['rotation_infos']))
            return True

        elif file_duration_result:
            if not event_dict.has_key('fileinfos'):
                event_dict['fileinfos'] = {}
            event_dict['fileinfos']['duration'] = file_duration_result.group(1)
            return True
        else:
            return False

