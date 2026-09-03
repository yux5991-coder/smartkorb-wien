const stamp = () => new Date().toISOString().slice(11, 19);

export const log = (message: string): void => console.log(`[${stamp()}] ${message}`);
export const warn = (message: string): void => console.warn(`[${stamp()}] WARN  ${message}`);
export const fail = (message: string): void => console.error(`[${stamp()}] ERROR ${message}`);
