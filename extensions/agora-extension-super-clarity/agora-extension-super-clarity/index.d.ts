import { Extension } from 'agora-rte-extension';
import type { IBaseProcessor } from 'agora-rte-extension';
import type { IExtension } from 'agora-rte-extension';
import { IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { VideoProcessor } from 'agora-rte-extension';

declare type ISCExtension = IExtension<ISCProcessor>;

declare interface ISCProcessor extends IBaseProcessor {
    release(): Promise<void>;
    enableAutoAdjust(track: IRemoteVideoTrack, priority: number, onProcessorDisabled: () => void): void;
    disableAutoAdjust(): void;
    on(event: SuperClarityEvents.ERROR, listener: SuperClarityErrorFunction): void;
    off(event: SuperClarityEvents.ERROR, listener: SuperClarityErrorFunction): void;
    on(event: SuperClarityEvents.FIRST_VIDEO_FRAME, listener: SuperClarityFirstVideoFrameFunction): void;
    off(event: SuperClarityEvents.FIRST_VIDEO_FRAME, listener: SuperClarityFirstVideoFrameFunction): void;
    on(event: SuperClarityEvents.SKIPFRAME, listener: SuperClaritySkipFrameFunction): void;
    off(event: SuperClarityEvents.SKIPFRAME, listener: SuperClaritySkipFrameFunction): void;
    on(event: SuperClarityEvents.STATS, listener: SuperClarityStatsFunction): void;
    off(event: SuperClarityEvents.STATS, listener: SuperClarityStatsFunction): void;
    on(event: SuperClarityEvents.AUTOADJUST_PROCESSOR_DISABLED, listener: SuperClarityAutoAdjustCallback): void;
    off(event: SuperClarityEvents.AUTOADJUST_PROCESSOR_DISABLED, listener: SuperClarityAutoAdjustCallback): void;
}

declare type ISuperClarityErrorMessage = string;

declare interface ISuperClarityFirstVideoFrameMessage {
    enabled: boolean;
    time: number;
    cost: number;
}

declare interface ISuperClaritySkipFrameMessage {
    time: number;
    totalDropped: number;
}

declare interface ISuperClarityStatsMessage {
    enabled: boolean;
    time: number;
    cost: number;
    frameRate: number;
}

declare type SuperClarityAutoAdjustCallback = () => void | Promise<void>;

declare type SuperClarityErrorFunction = (error: ISuperClarityErrorMessage) => void | Promise<void>;

export declare enum SuperClarityEvents {
    ERROR = "error",
    FIRST_VIDEO_FRAME = "first-video-frame",
    SKIPFRAME = "skip-frame",
    STATS = "stats",
    AUTOADJUST_PROCESSOR_DISABLED = "autoadjust-processor-disabled"
}

export declare class SuperClarityExtension extends Extension<SuperClarityProcessor> implements ISCExtension {
    constructor();
    createProcessor(forceGpuProcessing?: boolean): SuperClarityProcessor;
}

declare type SuperClarityFirstVideoFrameFunction = (stats: ISuperClarityFirstVideoFrameMessage) => void | Promise<void>;

export declare class SuperClarityProcessor extends VideoProcessor implements ISCProcessor {
    name: string;
    private processed_track;
    private sourceTrackId;
    constructor(forceGpuProcessing?: boolean);
    enableAutoAdjust(track: IRemoteVideoTrack, priority: number, onProcessorDisabled: () => void): void;
    disableAutoAdjust(): void;
    on(event: SuperClarityEvents, listener: Function): void;
    release(): Promise<void>;
}

declare type SuperClaritySkipFrameFunction = (stats: ISuperClaritySkipFrameMessage) => void | Promise<void>;

declare type SuperClarityStatsFunction = (stats: ISuperClarityStatsMessage) => void | Promise<void>;

export { }
