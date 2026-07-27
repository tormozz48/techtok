export const speak = jest.fn();
export const stop = jest.fn().mockResolvedValue(undefined);
export const isSpeakingAsync = jest.fn().mockResolvedValue(false);
export const getAvailableVoicesAsync = jest.fn().mockResolvedValue([]);
