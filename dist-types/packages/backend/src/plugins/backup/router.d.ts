import express from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import { BackupConfig } from './types';
export declare function createBackupRouter(opts: {
    logger: LoggerService;
    config: BackupConfig;
}): Promise<express.Router>;
