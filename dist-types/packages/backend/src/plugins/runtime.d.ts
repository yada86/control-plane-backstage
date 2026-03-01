import express from 'express';
import { Logger } from 'winston';
import { Config } from '@backstage/config';
export default function createRouter(options: {
    logger: Logger;
    config: Config;
}): Promise<express.Router>;
