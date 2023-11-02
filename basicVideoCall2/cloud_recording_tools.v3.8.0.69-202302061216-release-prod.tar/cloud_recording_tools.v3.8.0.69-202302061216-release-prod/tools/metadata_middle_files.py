#!/usr/bin/env python
import time
import re
import os
import sys
import traceback

class MiddleFilePerSession(object):
    def __init__(self, filename):
        self.dest_pat = {
                "start":'%s %s_%s.%s create \n',
                "close":'%s %s_%s.%s close \n',
                "info":'%s %s_%s.%s info width=%s height=%s rotation=%s \n'
                }

        self.dest_pat2 = {
                "start":'%s %s create \n',
                "close":'%s %s close \n',
                "info":'%s %s info width=%s height=%s rotation=%s \n',
                "rotate": '%s %s rotate rotation=%s \n'
                }

        self.dest_filename = filename
        self.cached_event_list = []


    def set_dest_filename(self,filename):
        self.dest_filename = filename

    #event_type:start, close, info
    def event_string(self, head_timestamp, uid, file_utc, container,
            event_type, width = 0, height = 0, rotation = 0):
        if event_type == 'start':
            return self.dest_pat[event_type] %(("%.3f" %head_timestamp), uid, file_utc,
                    container)
        elif event_type == 'close':
            return self.dest_pat[event_type] %(("%.3f" %head_timestamp), uid, file_utc,
                    container)
        elif event_type == 'info': 
            return self.dest_pat[event_type] %(("%.3f" %head_timestamp), uid, file_utc,
                    container, width, height, rotation)
        else:
            raise NameError("Not support event_type %s" %(event_type))

    #event_type:start, close, info
    def event_string(self, head_timestamp, filename,
            event_type, width = 0, height = 0, rotation = 0):
        if event_type == 'start':
            return self.dest_pat2[event_type] %(("%.3f" %head_timestamp), filename)
        elif event_type == 'close':
            return self.dest_pat2[event_type] %(("%.3f" %head_timestamp), filename)
        elif event_type == 'info': 
            return self.dest_pat2[event_type] %(("%.3f" %head_timestamp), filename, width, height, rotation)
        elif event_type == 'rotate':
            return self.dest_pat2[event_type] %(("%.3f" %head_timestamp), filename, rotation)
        else:
            raise NameError("Not support event_type %s" %(event_type))
 
    
    def update_cache_list(self, str):
        self.cached_event_list.append(str)

    def time_comp(self, x, y):
        first = float(x.split(" ")[0])
        second = float(y.split(" ")[0])
        return cmp(first, second)

    def write_cache_to_file(self):
        '''session audio&video data convert to middle data'''
        if len(self.dest_filename) != 0:
            if os.path.exists(self.dest_filename):
                print("Error:unexpted file has been existed!!!")
            else:
                fd = open(self.dest_filename,'w+')
                event_list = sorted(self.cached_event_list, cmp=self.time_comp)
                fd.writelines(event_list)
                fd.close()





