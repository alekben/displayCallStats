#!/usr/bin/env python
import time
import re
import os
import sys
import traceback
from metadata_middle_files import MiddleFilePerSession
import helper
import m3u8_parser


'''consider about the bak file which from failover recovery'''
class MetadataFilePerUid(object):
    def __init__(self, format = 'm3u8', uid = None, mode = 0):
        if format == 'm3u8':
            self.fileformat = r'*.m3u8'
            self.filepattern = r'(.*)__uid_s_([0-9]+)__uid_e_([a-zA-Z]+).m3u8'
            self.filewithindexpatten = r'(.*)__uid_s_([0-9]+)__uid_e_([a-zA-Z]+)_([0-9]+)_([0-9]+).m3u8'
            self.uid = uid
            self.mode = int(mode)
            self.mix_metadata_mode = None
            self.mix_metadata_mode_const_hash_tbl = {
                    'audio':False,
                    'video':False,
                    'av':True
                    }

            self.filename_dict = {
                    'audio':{
                        #'file1_audio.m3u8':M3u8FileParser
                        },
                    'video':{
                        #'file1_video.m3u8':M3u8FileParser
                        },
                    'av':{
                        #'file1_av.m3u8':M3u8FileParser
                        },
                    }
           
            self.per_uid_cached_metadata_obj = m3u8_parser.PerUidCachedM3u8Dict()
        else:
            raise NameError("Not support format %s" %(format))

    
    def metadata_dict_merged_in_merged_dict(self):
        for audio_video_type in self.filename_dict.keys():
            if audio_video_type is 'video':
                #self.per_uid_cached_metadata_obj.merged_video_m3u8_dict()
                for mediafile_parser in self.filename_dict[audio_video_type].values():
                    self.per_uid_cached_metadata_obj.merged_video_m3u8_dict(mediafile_parser.video_mediafile_dict)

            elif audio_video_type is 'audio':
                for mediafile_parser in self.filename_dict[audio_video_type].values():
                    self.per_uid_cached_metadata_obj.merged_audio_m3u8_dict(mediafile_parser.audio_mediafile_dict)

            elif audio_video_type is 'av':
                #self.per_uid_cached_metadata_obj.merged_audio_m3u8_dict()
                for mediafile_parser in self.filename_dict[audio_video_type].values():
                    #split_av_to_audio_video()
                    if mediafile_parser.video_mediafile_dict:
                        self.per_uid_cached_metadata_obj.merged_video_m3u8_dict(mediafile_parser.av_mediafile_dict)
                    elif mediafile_parser.audio_mediafile_dict:
                        self.per_uid_cached_metadata_obj.merged_audio_m3u8_dict(mediafile_parser.av_mediafile_dict)
                    elif mediafile_parser.av_mediafile_dict:
                        self.per_uid_cached_metadata_obj.merged_av_m3u8_dict(mediafile_parser.av_mediafile_dict)

    def merged_dict_splited_to_session(self):
        #make it as sorted
        self.per_uid_cached_metadata_obj.sorted_mediafile_dict()
        #split it as many sessions
        self.per_uid_cached_metadata_obj.take_session_from_whole_dict()
        self.per_uid_cached_metadata_obj.sorted_session_dict()


    def create_middlefile_of_sessions(self):
        for session in self.per_uid_cached_metadata_obj.ordered_session_dict:
            utc = session[0]
            session_data = session[1]
            session_filename = 'uid_' + self.uid + "_" + utc + ".txt"
            middlefile = MiddleFilePerSession(session_filename)
            split_file = False            
            split_interval = 0.0
            video_close_time = 0.0
            audio_close_time = 0.0
            
            if self.filename_dict['audio'] and self.filename_dict['video']:
                split_interval = 15.0
            
            #container = None
            #parser session
            last_time = {}

            for utc_tuple_line in session_data:
                file_utc = utc_tuple_line[0]
                if utc_tuple_line[1].has_key('fileinfos'):
                    container = utc_tuple_line[1]['fileinfos']['suffix']
                    filename = utc_tuple_line[1]['fileinfos']['name']
                    
                    #filestart - session_start is timestamp offset for each file
                    start_time = helper.utc_convert(file_utc) - helper.utc_convert(utc)
                    close_time = start_time + float(utc_tuple_line[1]['fileinfos']["duration"])
                    
                    if split_file and start_time > video_close_time and start_time > audio_close_time:
                        middlefile.write_cache_to_file()
                        session_filename = 'uid_' + self.uid + "_" + file_utc + ".txt"
                        middlefile = MiddleFilePerSession(session_filename)
                        split_file = False
                        video_close_time = 0.0
                        audio_close_time = 0.0
                        
                    type = utc_tuple_line[1]['type']
                    if self.mode == 0 and type == 'video':
                        split_file = True
                        video_close_time = close_time + split_interval
                        
                    if type == 'audio':
                        audio_close_time = close_time + split_interval
                        
                    if last_time.has_key(type) and start_time <= last_time[type]:
                        start_time = last_time[type] + 0.001

                    start_str = middlefile.event_string(start_time, filename ,'start')
                    middlefile.update_cache_list(start_str)

                    info_time  = start_time
                    if utc_tuple_line[1].has_key('rotation_infos'):
                        event_type = 'info'
                        pre_rotate = 0
                        for info in utc_tuple_line[1]['rotation_infos']:
                            width = info['width']
                            height = info['height']
                            rotate = info['rotate']
                            if rotate == pre_rotate:
                                continue
                            info_time = helper.utc_convert(info['time']) - helper.utc_convert(utc)
                            if info_time <= start_time:
                                info_time = start_time + 0.001

                            rotate_str = middlefile.event_string(info_time, filename, event_type, width, height, rotate)
                            middlefile.update_cache_list(rotate_str)
                            if event_type == 'info':
                                event_type = 'rotate'

                            pre_rotate = rotate


                    if close_time <= info_time:
                        close_time = info_time + 0.001
                    close_str = middlefile.event_string(close_time, filename ,'close')

                    middlefile.update_cache_list(close_str)
                    last_time[type] = close_time


            middlefile.write_cache_to_file()


    def get_fileformat(self):
        return self.fileformat

    def get_filepattern(self):
        return self.filepattern

    def get_filewithpatten(self):
        return self.filewithindexpatten

    def is_mixed_metadata(self):
        return self.mix_metadata_mode


    '''
    def m3u8_file_name_parser(self, filename):
        metadata_file_pat= r'(.*)__uid__([0-9]+)_([a-zA-Z]+).m3u8'
        metadata_file_pat_regex = re.compile(metadata_file_pat)
        if metadata_file_pat_regex.match(filename) and not self.cached_middle_file_name :
            prefix = metadata_file_pat_regex.group(1)
            uid = metadata_file_pat_regex.group(2)
            utc = metadata_file_pat_regex.group(3)
            self.cached_middle_file_name = 'uid_' + uid + utc + ".txt"
    '''

    def update_filename_dict(self, type, filename):
        try:
            self.filename_dict[type][filename] = m3u8_parser.M3u8FileParser(self.uid, filename)
            self.mix_metadata_mode = self.mix_metadata_mode_const_hash_tbl[type]

        except Exception as e:
            print("Error %s" %(e))
            traceback.print_exc()

    '''
    def splited_av_to_merged_cache(self):           
        
        return 
        '''

    def set_uid(self, uid):
        if self.uid == None:
            self.uid = uid
    
    def dump(self):
        for key in self.filename_dict:
            print("=====type:%s" %(key))
            for file in self.filename_dict[key]:
                print("\t%s" %(key))  


