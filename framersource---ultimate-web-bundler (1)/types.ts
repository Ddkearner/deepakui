
export enum ScrapeStatus {
  IDLE = 'IDLE',
  FETCHING = 'FETCHING',
  PARSING = 'PARSING',
  INLINING_ASSETS = 'INLINING_ASSETS',
  COMPLETING = 'COMPLETING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ScrapeLog {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface ScrapeResult {
  html: string;
  title: string;
  assetCount: number;
  fileSize: number;
}
