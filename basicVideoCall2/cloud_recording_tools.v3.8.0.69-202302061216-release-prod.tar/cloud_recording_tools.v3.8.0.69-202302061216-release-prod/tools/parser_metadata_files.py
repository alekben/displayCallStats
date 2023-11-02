#!/usr/bin/env python
import time
import re
import os
import sys
import signal
import glob

import traceback
import metadata_file
from metadata_file import MetadataFilePerUid
'''
1.Get all of m3u8 files, store m3u8 info info inner orig dict data structure
  a.if it's av m3u8, av media file need to splited as splited audio dict & vdieo dict 

  b.if it's splited m3u8, all of audio & video data merged into merged data structure

  c.dispose merged data structure, per audio& video started info &utc info 
  split the biggiest dict as each session small dict

  d.
  1.video convert need to support ts video & ts audio
  2.if ts audio is not easy to add in orignal script,
  need add some dispose to make audio ts to aac.
'''


class ParserMetadataFiles(object):
    '''all of m3u8 files has been stored in dict'''
    def __init__(self, folder_name, mode, uid, format='m3u8'):
        self.format = format
        self.uid = uid
        self.mode = mode
        self.path = folder_name
        self.metadata_fileformat = MetadataFilePerUid(format).get_fileformat()
        self.metadata_filepattern = MetadataFilePerUid(format).get_filepattern()
        self.metadata_filewithindexpatten = MetadataFilePerUid(format).get_filewithpatten()
        '''
        self.all_uid_metadatafiles = {
        '123':MetadataFilePeruid(format)
        '234':MetadataFilePeruid(format)
        }
        '''
        self.all_uid_metadatafiles = {}
        
        if not os.path.isdir(folder_name):
            raise IOError("Folder %s does not exist" %(folder_name))
    def get_file_size(self, file):
        size = 0
        try:
            size = os.path.getsize(file)
        except:
            pass
        return size

    def get_all_parse_files(self):
        os.chdir(self.path)
        all_files = sorted(glob.glob(self.metadata_fileformat))
        filename_pat_reged = re.compile(self.metadata_filepattern)
        filename_with_index_pat_reged = re.compile(self.metadata_filewithindexpatten)
        format_files = {}

        for file in all_files:
            result = filename_pat_reged.match(file)
            if not result:
                result = filename_with_index_pat_reged.match(file)
            if result:
                if self.uid and result.group(2) != self.uid:
                    continue
                    
                if self.mode == '2' and result.group(3) == "video":
                    continue
                    
                if self.mode == '3' and result.group(3) == "audio":
                    continue
                    
                if result.group(3) == "av":
                    continue

                key = result.group(1) + result.group(2) + result.group(3)
                if format_files.has_key(key):
                    if self.get_file_size(file) > self.get_file_size(format_files[key]['file']):
                        format_files[key]["file"] = file
                else:
                    file_info = {}
                    file_info["prefix"] = result.group(1)
                    file_info["uid"] = result.group(2)
                    file_info["type"] = result.group(3)
                    file_info["file"] = file
                    format_files[key] = file_info

        return format_files

    def parser_all_files(self):
        os.chdir(self.path)
        all_files = self.get_all_parse_files()
        for file in all_files.values():
            prefix = file["prefix"]
            uid = file["uid"]
            type = file["type"]

            if not self.all_uid_metadatafiles.has_key(uid):
                self.all_uid_metadatafiles[uid] = MetadataFilePerUid(self.format, uid, self.mode)

            self.all_uid_metadatafiles[uid].update_filename_dict(type,file["file"])


    def analysis_metadatafile(self):
        '''
        1.if it's av m3u8
            1.a if it's av mediafile, split av mediafile as audio &video,
            and then  jump to item b
            1.b if it's splited audio & video like ts + webm, directly convert
            it as middlefile
        
        2.if it's audio/ video splited m3u8
            audio&video need to merged in one file like 1.a to do this things
        '''

        #make all of m3u8 store in cache
        #and then seperated audio & video m3u8 need to be merged into 
        #one av media dict
        for metadatafile_per_uid in self.all_uid_metadatafiles.values():
            for audio_video_type in metadatafile_per_uid.filename_dict.keys():
                for mediafile_item in metadatafile_per_uid.filename_dict[audio_video_type].items():
                    mediafile_item[1].metadatafile_to_list(mediafile_item[0])


    def per_user_splited_metadata_dict_merged_in_one(self):
        for metadatafile_per_uid in self.all_uid_metadatafiles.values():
            metadatafile_per_uid.metadata_dict_merged_in_merged_dict()

    def per_user_merged_dict_splited_to_session(self):
        for metadatafile_per_uid in self.all_uid_metadatafiles.values():
            metadatafile_per_uid.merged_dict_splited_to_session()

    def create_middlefile_of_sessions_in_all_uids(self):
        for metadatafile_per_uid in self.all_uid_metadatafiles.values():
            metadatafile_per_uid.create_middlefile_of_sessions()


    def dispose(self):
        #stored in dict
        self.parser_all_files()
        #stored in cached buffer
        self.analysis_metadatafile()

        #stored all corner case as one merged file
        self.per_user_splited_metadata_dict_merged_in_one()

        #split one merged file as session per start key word
        self.per_user_merged_dict_splited_to_session()

        # create the uid_xxx.txt
        self.create_middlefile_of_sessions_in_all_uids()

 
def help():
    help_str='''Help:
    ./script dispose path
    eg.
     %s dispose .
    ''' %(sys.argv[0])
    print(help_str)

def clean_func(folder_name):
    if not os.path.isdir(folder_name[1]):
        print "Folder " + folder_name[1] + " does not exist"
        return

    os.chdir(folder_name[1])
    media_file = "media_file.mf"
    if os.path.exists(media_file):
        f = open(media_file, "r")
        lines = f.readlines()
        for line in lines:
            os.system('rm -f %s' % line)
        os.system('rm -f %s' % media_file)
    all_uid_file = sorted(glob.glob("uid_*.txt"))
    for uid_file in all_uid_file:
        os.system('rm -f %s' % uid_file)

def cmds1_func(cmds):
    parser = ParserMetadataFiles(cmds[1], cmds[2], cmds[3])
    parser.dispose()

def cmds_parse(input_cmd):
    dirname = r'[^ ]+'
    uid = ""
    mode = r'\d'
    
    if len(input_cmd) >= 3 and input_cmd[3]:
        uid = input_cmd[3].strip()
    
    cmds_func_list =  [
            [['dispose',dirname, mode, uid], cmds1_func],
            [['clean', dirname], clean_func]
            ]
    try:
        found=False
        for cmds_func in cmds_func_list:
            flag=True

            #skip different cmds_len
            if len(cmds_func[0]) != len(input_cmd):
#                print(cmds_func[0], input_cmd)
                continue

            #cmds len equal, but need to check param legal or not
            for pat,cmd_part in zip(cmds_func[0],input_cmd):
#                print(pat,cmd_part)
                if re.match(pat,cmd_part) == None:
                    flag=False
                    break

            if flag:
                found = True
                print("cmd pattern:%s" %(cmds_func[0]))
                print("input cmd:%s" %(input_cmd))

                cmds_func[1](input_cmd)
                break

        if found == False:
            print("input cmds:%s" %input_cmd)
            help()
    except Exception as e:
        print("Error input:%s!" %e)
        print("input cmds:%s" %input_cmd)
        help()
        traceback.print_exc()



if '__main__' == __name__:
    import sys
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGQUIT, signal.SIG_IGN)
    cmds_parse(sys.argv[1:])

